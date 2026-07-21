/**
 * Configuração do storage S3-compatible (Garage).
 *
 * Provider atual: **Garage** (self-host S3-compatible).
 * Porta padrão S3: **3900**. Region: `"garage"` (any string funciona).
 * Path-style addressing: **obrigatório** para Garage/MinIO.
 *
 * Variáveis de ambiente (todas REQUIRED em produção):
 * - `STORAGE_ENDPOINT`         ex: `https://garage.example.com:3900`
 * - `STORAGE_REGION`           ex: `garage`
 * - `STORAGE_ACCESS_KEY_ID`    ex: `GK3515373e4c851ebaad366558`
 * - `STORAGE_SECRET_ACCESS_KEY` ex: hex 64-char
 * - `STORAGE_PROJECT_PREFIX`   prefixo dos buckets (default: `igreja-conect`)
 *
 * **Garage NÃO suporta:**
 * - ACL / bucket policies (gerenciar via `garage bucket allow --key`)
 * - Bucket versioning (overwrites são literais)
 * - Server-side encryption (encrypt no FS / client-side)
 * - Storage class transitions (só `Expiration` e `AbortIncompleteMultipartUpload`)
 *
 * Ver `https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/`.
 */

export type StorageProvider = "garage" | "minio" | "rustfs" | "aws" | "r2" | "local";

const PROJECT_PREFIX =
  process.env.STORAGE_PROJECT_PREFIX ?? "";

export const STORAGE_CONFIG = {
  provider: (process.env.STORAGE_PROVIDER ?? "garage") as StorageProvider,

  endpoint: process.env.STORAGE_ENDPOINT ?? "http://localhost:3900",
  region: process.env.STORAGE_REGION ?? "garage",
  accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "",

  /** Usado apenas quando `provider === "local"` (fallback sem object storage). */
  localDir: process.env.STORAGE_LOCAL_DIR ?? "./data/storage",

  /** Buckets — 6 padrão conforme `training/object-storage-standard.md`. */
  buckets: {
    staging: `${PROJECT_PREFIX}-staging`,
    images: `${PROJECT_PREFIX}-images`,
    videos: `${PROJECT_PREFIX}-videos`,
    audios: `${PROJECT_PREFIX}-audios`,
    documents: `${PROJECT_PREFIX}-documents`,
    quarantine: `${PROJECT_PREFIX}-quarantine`,
  } as const,

  /** Limites por kind (RN: validar ANTES de processar). */
  maxSize: {
    image: 20 * 1024 * 1024, // 20MB
    video: 5 * 1024 * 1024 * 1024, // 5GB
    audio: 200 * 1024 * 1024, // 200MB
    document: 100 * 1024 * 1024, // 100MB
  } as const,

  signedUrlExpiry: 15 * 60, // 15min (LGPD-safe default)

  /** ClamAV — best-effort; se daemon off, upload segue sem scan (log warning). */
  virusScan: {
    enabled: process.env.STORAGE_CLAMAV_ENABLED !== "false", // default true
    host: process.env.CLAMAV_HOST ?? "127.0.0.1",
    port: parseInt(process.env.CLAMAV_PORT ?? "3310", 10),
    timeoutMs: 30_000,
  },
} as const;

export type StorageKind = keyof typeof STORAGE_CONFIG.maxSize;
export type BucketName = (typeof STORAGE_CONFIG.buckets)[keyof typeof STORAGE_CONFIG.buckets];

/**
 * Mapeia `kind` do upload → bucket final (staging é sempre `staging`).
 * Use `getTargetBucket("image")` para resolver o bucket destino no worker.
 */
export function getTargetBucket(kind: StorageKind): BucketName {
  const map: Record<StorageKind, BucketName> = {
    image: STORAGE_CONFIG.buckets.images,
    video: STORAGE_CONFIG.buckets.videos,
    audio: STORAGE_CONFIG.buckets.audios,
    document: STORAGE_CONFIG.buckets.documents,
  };
  return map[kind];
}

/**
 * Valida se a config está completa (em produção, falha hard).
 * Em dev, apenas loga warning se faltar.
 */
export function assertStorageConfigured(): void {
  if (STORAGE_CONFIG.provider === "local") {
    if (!STORAGE_CONFIG.localDir) {
      const msg = "[storage] Missing env var: STORAGE_LOCAL_DIR";
      if (process.env.NODE_ENV === "production") throw new Error(msg);
      console.warn(msg);
    }
    return;
  }

  const missing: string[] = [];
  if (!STORAGE_CONFIG.endpoint) missing.push("STORAGE_ENDPOINT");
  if (!STORAGE_CONFIG.accessKeyId) missing.push("STORAGE_ACCESS_KEY_ID");
  if (!STORAGE_CONFIG.secretAccessKey) missing.push("STORAGE_SECRET_ACCESS_KEY");
  if (missing.length > 0) {
    const msg = `[storage] Missing env vars: ${missing.join(", ")}`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(msg);
    }
    console.warn(msg);
  }
}
