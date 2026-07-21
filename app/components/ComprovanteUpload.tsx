/**
 * ComprovanteUpload — upload de comprovante (NF, recibo, cupom) para um
 * lançamento financeiro. **1:1** — substituir o anexo anterior apaga
 * o antigo (soft-delete LGPD).
 *
 * **Fluxo:**
 * 1. Usuário seleciona arquivo via `<input type="file">`
 * 2. Auto-submete via `useFetcher` → `POST /api/uploads` (kind=document)
 * 3. Polling `GET /api/uploads/:id` até status=READY
 * 4. Quando READY → `POST /api/lancamentos/:id/anexo` vincula
 * 5. Preview: thumbnail (image) OU ícone PDF com nome
 * 6. "Ver" → signed URL (open in new tab)
 * 7. "Remover" → DELETE + desvincula
 *
 * **Estados visuais:**
 * - IDLE / READY / ERROR (igual AvatarUpload)
 *
 * **Diferenças vs AvatarUpload:**
 * - Aceita image/* + application/pdf (não só image/*)
 * - Layout horizontal compacto (cabe em linha de tabela)
 * - Mostra nome do arquivo + tamanho
 */
import { useFetcher } from "react-router";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/cn";

export interface ComprovanteUploadProps {
  lancamentoId: string;
  currentUrl: string | null;
  currentFilename: string | null;
  currentUploadId: string | null;
  currentStatus: string | null;
  /** MIME detectado (para decidir ícone). */
  currentMime: string | null;
}

type LocalStatus = "idle" | "uploading" | "processing" | "ready" | "error";

const POLL_INTERVAL_MS = 1_500;
const MAX_POLL_ATTEMPTS = 30;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ComprovanteUpload({
  lancamentoId,
  currentUrl,
  currentFilename,
  currentUploadId,
  currentStatus,
  currentMime,
}: ComprovanteUploadProps) {
  const uploadFetcher = useFetcher<{
    uploadId?: string;
    status?: string;
    error?: string;
  }>();
  const linkFetcher = useFetcher<{ error?: string }>();
  const deleteFetcher = useFetcher<{ error?: string }>();

  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [filename, setFilename] = useState<string | null>(currentFilename);
  const [mime, setMime] = useState<string | null>(currentMime);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(
    currentUploadId,
  );
  const [status, setStatus] = useState<LocalStatus>(
    currentStatus === "READY"
      ? "ready"
      : currentUploadId
        ? "processing"
        : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isBusy =
    uploadFetcher.state !== "idle" ||
    linkFetcher.state !== "idle" ||
    deleteFetcher.state !== "idle";

  // === Polling ===
  useEffect(() => {
    if (!activeUploadId || status !== "processing") return;

    if (pollCount >= MAX_POLL_ATTEMPTS) {
      setError("Timeout: processamento demorou demais.");
      setStatus("error");
      return;
    }

    pollTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/uploads/${activeUploadId}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = (await res.json()) as {
          status: string;
          urls?: { preview: string | null; variants?: Record<string, string> };
          metadata?: { originalFilename?: string; detectedMime?: string };
        };

        if (data.status === "READY" && data.urls?.preview) {
          setPreviewUrl(data.urls.preview);
          if (data.metadata?.originalFilename)
            setFilename(data.metadata.originalFilename);
          if (data.metadata?.detectedMime) setMime(data.metadata.detectedMime);
          setStatus("ready");
          setError(null);
          return;
        }

        if (data.status === "REJECTED" || data.status === "FAILED") {
          setError(`Upload rejeitado: ${data.status}`);
          setStatus("error");
          return;
        }

        setPollCount((c) => c + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro no polling");
        setStatus("error");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [activeUploadId, status, pollCount]);

  // === Após upload inicial, começar polling ===
  useEffect(() => {
    if (uploadFetcher.data?.uploadId && uploadFetcher.state === "idle") {
      const newId = uploadFetcher.data.uploadId;
      setActiveUploadId(newId);
      setStatus("processing");
      setPollCount(0);
      setError(null);
    }
  }, [uploadFetcher.data, uploadFetcher.state]);

  // === Quando READY, vincular ao lançamento ===
  useEffect(() => {
    if (
      status === "ready" &&
      activeUploadId &&
      linkFetcher.state === "idle" &&
      activeUploadId !== currentUploadId
    ) {
      const formData = new FormData();
      formData.append("uploadId", activeUploadId);
      linkFetcher.submit(formData, {
        method: "POST",
        action: `/api/lancamentos/${lancamentoId}/anexo`,
      });
    }
  }, [status, activeUploadId, currentUploadId, linkFetcher, lancamentoId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setStatus("uploading");
    setFilename(file.name);
    setMime(file.type || "application/octet-stream");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", "document");
    formData.append("contextType", "lancamento.comprovante");
    formData.append("contextId", lancamentoId);
    formData.append("isPublic", "false"); // comprovante é privado

    uploadFetcher.submit(formData, {
      method: "POST",
      action: "/api/uploads",
      encType: "multipart/form-data",
    });
  };

  const handleRemove = () => {
    if (!activeUploadId) return;
    if (!window.confirm("Remover comprovante?")) return;

    deleteFetcher.submit(null, {
      method: "POST",
      action: `/api/uploads/${activeUploadId}/delete`,
    });

    setPreviewUrl(null);
    setFilename(null);
    setActiveUploadId(null);
    setStatus("idle");
    setError(null);
  };

  const handleRetry = () => {
    setError(null);
    setStatus("idle");
    fileInputRef.current?.click();
  };

  const isImage = mime?.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Selecionar comprovante"
      />

      {/* Preview: thumbnail (image) OU ícone */}
      <div className="h-10 w-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
        {previewUrl && isImage ? (
          <img
            src={previewUrl}
            alt={filename ?? "Comprovante"}
            className="h-full w-full object-cover"
          />
        ) : isPdf ? (
          <svg
            className="h-5 w-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )}
      </div>

      {/* Status + Filename */}
      <div className="flex-1 min-w-0">
        {status === "idle" && !filename && (
          <p className="text-xs text-slate-400">Sem comprovante</p>
        )}
        {filename && (
          <p
            className="text-xs font-medium text-slate-700 truncate max-w-[200px]"
            title={filename}
          >
            {filename}
          </p>
        )}
        <p className="text-[10px] text-slate-400">
          {status === "uploading" && "Enviando..."}
          {status === "processing" && "Processando..."}
          {status === "ready" && mime && `${mime.split("/")[1]?.toUpperCase()}`}
          {status === "error" && (
            <span className="text-red-600">
              {error}{" "}
              <button
                type="button"
                onClick={handleRetry}
                className="underline"
              >
                Tentar novamente
              </button>
            </span>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {status === "ready" && previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 w-7 rounded inline-flex items-center justify-center text-cyan-700 hover:bg-cyan-50 transition-colors"
            title="Abrir comprovante em nova aba"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}

        {status === "idle" || status === "error" ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className={cn(
              "h-7 px-2 rounded text-xs font-bold bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200/50 transition-colors",
              isBusy && "opacity-50 cursor-not-allowed",
            )}
          >
            {previewUrl ? "Trocar" : "Anexar"}
          </button>
        ) : null}

        {previewUrl && status === "ready" && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isBusy}
            className={cn(
              "h-7 w-7 rounded inline-flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors",
              isBusy && "opacity-50 cursor-not-allowed",
            )}
            title="Remover comprovante"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
