/**
 * "Signed URLs" para o driver local (`STORAGE_PROVIDER=local`).
 *
 * S3 assina URLs com a secret key da conta; aqui não existe esse conceito,
 * então geramos um token HMAC-SHA256 (assinado com `SESSION_SECRET`) com
 * expiração embutida, verificado pela rota `/api/files/:bucket/*`.
 *
 * **Não é um substituto de autenticação** — a rota de serving também
 * deveria, idealmente, checar a sessão; o token por si só já garante que
 * a URL não pode ser adivinhada/reusada além do prazo (mesma garantia de
 * LGPD que os presigned URLs do S3 davam).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { STORAGE_CONFIG } from "./config.server";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[storage/local] SESSION_SECRET é obrigatório em produção");
    }
    return "dev-insecure-secret-change-me";
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function buildPayload(
  bucket: string,
  key: string,
  exp: number,
  disposition: string,
  filename: string,
): string {
  return `${bucket}:${key}:${exp}:${disposition}:${filename}`;
}

export interface LocalSignedUrlOpts {
  bucket: string;
  key: string;
  expiresIn?: number;
}

/** Gera URL de preview (inline) para o driver local. */
export function getLocalSignedPreviewUrl(opts: LocalSignedUrlOpts): string {
  return buildSignedUrl({ ...opts, disposition: "inline", filename: "" });
}

/** Gera URL de download (attachment) para o driver local. */
export function getLocalSignedDownloadUrl(
  opts: LocalSignedUrlOpts & { filename: string },
): string {
  return buildSignedUrl({ ...opts, disposition: "attachment" });
}

function buildSignedUrl(opts: {
  bucket: string;
  key: string;
  expiresIn?: number;
  disposition: "inline" | "attachment";
  filename?: string;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.expiresIn ?? STORAGE_CONFIG.signedUrlExpiry);
  const filename = opts.filename ?? "";
  const sig = sign(buildPayload(opts.bucket, opts.key, exp, opts.disposition, filename));

  const params = new URLSearchParams({
    exp: String(exp),
    disposition: opts.disposition,
    sig,
  });
  if (filename) params.set("filename", filename);

  const encodedKey = opts.key.split("/").map(encodeURIComponent).join("/");
  return `/api/files/${encodeURIComponent(opts.bucket)}/${encodedKey}?${params.toString()}`;
}

/**
 * Valida um token de acesso vindo da query string. Retorna `true` se
 * a assinatura é válida e o token não expirou.
 */
export function verifyLocalSignedUrl(
  bucket: string,
  key: string,
  searchParams: URLSearchParams,
): boolean {
  const exp = Number(searchParams.get("exp"));
  const disposition = searchParams.get("disposition") ?? "inline";
  const filename = searchParams.get("filename") ?? "";
  const sig = searchParams.get("sig") ?? "";

  if (!exp || !Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;
  if (!sig) return false;

  const expected = sign(buildPayload(bucket, key, exp, disposition, filename));

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
