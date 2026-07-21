/**
 * Signed URLs (preview inline + download attachment).
 *
 * **Padrão (training/object-storage-standard.md §7):**
 * - Preview: `ResponseContentDisposition: "inline"` (abre no browser)
 * - Download: `ResponseContentDisposition: "attachment; filename=..."`
 * - Expiração: 15min default (`STORAGE_CONFIG.signedUrlExpiry`)
 * - Bucket SEMPRE privado; URL pública = LGPD art. 46 violado.
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createStorageClient } from "./client.server";
import { STORAGE_CONFIG } from "./config.server";
import { getLocalSignedPreviewUrl, getLocalSignedDownloadUrl } from "./local-signed-url.server";

export interface SignedUrlOpts {
  bucket: string;
  key: string;
  /** Expiração em segundos. Default: STORAGE_CONFIG.signedUrlExpiry. */
  expiresIn?: number;
}

/**
 * Signed URL para **preview** (exibe no browser, sem forçar download).
 *
 * Útil para avatares, thumbnails inline em listas, etc.
 */
export async function getSignedPreviewUrl(opts: SignedUrlOpts): Promise<string> {
  if (STORAGE_CONFIG.provider === "local") {
    return getLocalSignedPreviewUrl(opts);
  }

  const client = createStorageClient();
  const command = new GetObjectCommand({
    Bucket: opts.bucket,
    Key: opts.key,
    ResponseContentDisposition: "inline",
  });
  return getSignedUrl(client, command, {
    expiresIn: opts.expiresIn ?? STORAGE_CONFIG.signedUrlExpiry,
  });
}

/**
 * Signed URL para **download** (força `attachment; filename=...`).
 *
 * Use para botões "Baixar" — usuário recebe o arquivo em vez de abrir inline.
 */
export async function getSignedDownloadUrl(
  opts: SignedUrlOpts & { filename: string },
): Promise<string> {
  if (STORAGE_CONFIG.provider === "local") {
    return getLocalSignedDownloadUrl(opts);
  }

  const client = createStorageClient();
  const command = new GetObjectCommand({
    Bucket: opts.bucket,
    Key: opts.key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(opts.filename)}"`,
    ResponseContentType: "application/octet-stream",
  });
  return getSignedUrl(client, command, {
    expiresIn: opts.expiresIn ?? STORAGE_CONFIG.signedUrlExpiry,
  });
}
