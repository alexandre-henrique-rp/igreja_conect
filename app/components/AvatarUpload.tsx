/**
 * AvatarUpload — componente de upload de avatar com preview + polling + remove.
 *
 * **Fluxo:**
 * 1. Usuário seleciona arquivo via `<input type="file">`
 * 2. Auto-submete via `useFetcher` → `POST /api/uploads`
 *    (kind=image, contextType=membro.avatar, contextId=membroId)
 * 3. Polling a cada 1.5s em `GET /api/uploads/:id` até status=READY
 * 4. Quando READY, linka ao membro via `POST /api/membros/:id/avatar`
 * 5. Exibe preview com signed URL
 * 6. Botão "Remover" chama `DELETE /api/uploads/:id/delete` e revalida
 *
 * **Estados visuais:**
 * - IDLE       → placeholder cinza com botão "Escolher foto"
 * - UPLOADING  → spinner "Enviando..."
 * - PROCESSING → spinner "Processando..." + polling
 * - READY      → preview + botão "Trocar" / "Remover"
 * - ERROR      → mensagem + retry
 *
 * **Garage/S3:** tudo via signed URLs (LGPD art. 46 — bucket privado).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/cn";

export interface AvatarUploadProps {
  /** ID do membro (para vinculação automática). Se omitido, o upload fica pendente e `onUploadReady` é chamado. */
  membroId?: string;
  /** URL atual do avatar (signed, 15min expiry). Null = sem avatar. */
  currentUrl?: string | null;
  /** ID do Upload atual vinculado (pra polling de status). */
  currentUploadId?: string | null;
  /** Status atual do upload (caso ainda esteja processando). */
  currentStatus?: string | null;
  /** Chamado quando o upload fica READY (modo sem membroId). */
  onUploadReady?: (uploadId: string) => void;
  /** Chamado quando o usuário remove o upload selecionado. */
  onRemove?: () => void;
}

type LocalStatus = "idle" | "uploading" | "processing" | "ready" | "error";

const POLL_INTERVAL_MS = 1_500;
const MAX_POLL_ATTEMPTS = 30; // ~45s

export function AvatarUpload({
  membroId,
  currentUrl = null,
  currentUploadId = null,
  currentStatus = null,
  onUploadReady,
  onRemove,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
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
    uploading ||
    linking ||
    deleting;

  // === Polling enquanto PROCESSING/SCANNING/TRANSCODING ===
  useEffect(() => {
    if (!activeUploadId || status !== "processing") return;

    if (pollCount >= MAX_POLL_ATTEMPTS) {
      setError("Timeout: processamento demorou demais. Tente novamente.");
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
        };

        if (data.status === "READY" && data.urls?.preview) {
          setPreviewUrl(data.urls.variants?.sm ?? data.urls.preview);
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

  // === Upload inicial via fetch direto (bypassa single fetch do RR7) ===
  const doUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", "image");
        formData.append("contextType", "membro.avatar");
        if (membroId) {
          formData.append("contextId", membroId);
        }
        formData.append("isPublic", "true");

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Upload falhou (${res.status})`);
        }

        const result = (await res.json()) as { uploadId: string };
        setActiveUploadId(result.uploadId);
        setStatus("processing");
        setPollCount(0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro no upload");
        setStatus("error");
      } finally {
        setUploading(false);
      }
    },
    [membroId],
  );

  // === Após upload READY, linka ao membro via fetch direto ===
  useEffect(() => {
    if (
      status === "ready" &&
      activeUploadId &&
      !linking &&
      activeUploadId !== currentUploadId
    ) {
      if (membroId) {
        setLinking(true);
        const formData = new FormData();
        formData.append("uploadId", activeUploadId);
        fetch(`/api/membros/${membroId}/avatar`, {
          method: "POST",
          body: formData,
          credentials: "include",
        }).finally(() => setLinking(false));
      } else if (onUploadReady) {
        onUploadReady(activeUploadId);
      }
    }
  }, [status, activeUploadId, currentUploadId, linking, membroId, onUploadReady]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset
    setError(null);
    setStatus("uploading");

    // Mostra preview local imediatamente (blob URL)
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);

    // Submete via fetch direto (bypassa single fetch do RR7)
    doUpload(file);
  };

  // Quando o upload inicial retornar READY, vincula ao membro
  // (efect movido para acima)

  const handleRemove = async () => {
    if (!activeUploadId) return;
    if (!window.confirm("Remover avatar? Esta ação não pode ser desfeita.")) return;

    setDeleting(true);
    try {
      await fetch(`/api/uploads/${activeUploadId}/delete`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setDeleting(false);
    }

    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setActiveUploadId(null);
    setStatus("idle");
    setError(null);
    onRemove?.();
  };

  const handleRetry = () => {
    setError(null);
    setStatus("idle");
    fileInputRef.current?.click();
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Selecionar foto de perfil"
      />

      {/* Preview / Placeholder */}
      <div className="h-20 w-20 rounded-full overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center relative">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Foto de perfil"
            className="h-full w-full object-cover"
          />
        ) : (
          <svg
            className="h-8 w-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}

        {status === "uploading" || status === "processing" ? (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-white animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                className="opacity-75"
              />
            </svg>
          </div>
        ) : null}
      </div>

      {/* Controls + Status */}
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-900">Foto de Perfil</p>
        <p className="text-xs text-slate-500">
          JPG, PNG, GIF ou WebP. Máximo 20MB.
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePickFile}
            disabled={isBusy}
            className={cn(
              "px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200/50 rounded-lg text-xs font-bold transition-colors",
              isBusy && "opacity-50 cursor-not-allowed",
            )}
          >
            {previewUrl ? "Trocar foto" : "Escolher foto"}
          </button>

          {previewUrl && status !== "uploading" && status !== "processing" && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isBusy}
              className={cn(
                "px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/50 rounded-lg text-xs font-bold transition-colors",
                isBusy && "opacity-50 cursor-not-allowed",
              )}
            >
              Remover
            </button>
          )}
        </div>

        {/* Status text */}
        <p className="mt-1 text-xs text-slate-500">
          {status === "uploading" && "Enviando arquivo..."}
          {status === "processing" && "Processando (scan + validação)..."}
          {status === "ready" && previewUrl && "Foto atualizada"}
          {status === "idle" && !previewUrl && "Nenhuma foto definida"}
          {status === "error" && (
            <span className="text-red-600">
              {error}{" "}
              <button
                type="button"
                onClick={handleRetry}
                className="underline font-medium"
              >
                Tentar novamente
              </button>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
