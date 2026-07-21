/**
 * Helper de upload (PutObject direto ou multipart via `@aws-sdk/lib-storage`).
 *
 * **Padrão (training/object-storage-standard.md §11.4):**
 * - Multipart upload para arquivos >5MB (paralelo, streaming, sem buffer).
 * - Hash SHA-256 calculado durante o upload (streaming, sem double-read).
 * - Metadados via `x-amz-meta-*` headers (preservados pelo Garage).
 */
import { Upload } from "@aws-sdk/lib-storage";
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Readable as NodeReadable } from "node:stream";
import { createStorageClient } from "./client.server";
import { STORAGE_CONFIG } from "./config.server";
import { localPutObject, localDeleteObject } from "./local.server";

export type UploadBody = Buffer | Readable | string;

export interface UploadOpts {
  bucket: string;
  key: string;
  body: UploadBody;
  contentType: string;
  metadata?: Record<string, string>;
  /** Hash streaming (SHA-256). Default: true. */
  hashSha256?: boolean;
}

export interface UploadResult {
  etag?: string;
  sha256?: string;
  versionId?: string;
}

/**
 * Upload single-shot via `PutObject`. Para arquivos <5MB.
 * Retorna ETag (md5) e opcionalmente SHA-256 calculado em paralelo.
 */
export async function uploadObject(opts: UploadOpts): Promise<UploadResult> {
  const body = normalizeBody(opts.body);
  let sha256: string | undefined;

  if (opts.hashSha256 !== false && Buffer.isBuffer(opts.body)) {
    sha256 = createHash("sha256").update(opts.body).digest("hex");
  }

  if (STORAGE_CONFIG.provider === "local") {
    const out = await localPutObject({
      bucket: opts.bucket,
      key: opts.key,
      body,
      contentType: opts.contentType,
      metadata: opts.metadata,
    });
    return { etag: out.etag, sha256 };
  }

  const client = createStorageClient();
  const out = await client.send(
    new PutObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      Body: body,
      ContentType: opts.contentType,
      // Garage NÃO suporta SSE — omitir `ServerSideEncryption`.
      // Garage NÃO suporta versioning — `VersionId` ficará undefined.
      Metadata: opts.metadata,
    }),
  );
  return { etag: out.ETag, sha256 };
}

/**
 * Upload multipart (arquivos >5MB recomendado).
 * Usa `Upload` de `@aws-sdk/lib-storage` — chunks paralelos + retry automático.
 *
 * Calcula SHA-256 em streaming via Transform stream (sem double-read).
 */
export async function uploadObjectMultipart(opts: UploadOpts): Promise<UploadResult> {
  const client = createStorageClient();
  const body = normalizeBody(opts.body);

  let sha256: string | undefined;
  let uploadBody: Readable | Buffer | string = body;

  if (opts.hashSha256 !== false && !Buffer.isBuffer(body) && typeof body !== "string") {
    // Streaming SHA-256 — sem carregar tudo em memória.
    const hasher = createHash("sha256");
    const source = body;
    const hashStream = NodeReadable.from(
      (async function* () {
        for await (const chunk of source) {
          hasher.update(chunk as Buffer);
          yield chunk;
        }
        sha256 = hasher.digest("hex");
      })(),
    );
    uploadBody = hashStream;
  }

  const upload = new Upload({
    client,
    params: {
      Bucket: opts.bucket,
      Key: opts.key,
      Body: uploadBody,
      ContentType: opts.contentType,
      Metadata: opts.metadata,
    },
    queueSize: 4, // 4 partes em paralelo
    partSize: 5 * 1024 * 1024, // 5MB mínimo
    leavePartsOnError: false,
  });

  const out = await upload.done();
  return { etag: out.ETag, sha256 };
}

/**
 * Deleta um objeto (usado no cleanup pós-upload bem-sucedido).
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  if (STORAGE_CONFIG.provider === "local") {
    await localDeleteObject(bucket, key);
    return;
  }
  const client = createStorageClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function normalizeBody(body: UploadBody): Readable | Buffer | string {
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body;
  return body;
}

/**
 * Helper: cria um NodeJS.ReadableStream a partir de um caminho de arquivo.
 */
export function streamFromFile(path: string): Readable {
  return createReadStream(path);
}
