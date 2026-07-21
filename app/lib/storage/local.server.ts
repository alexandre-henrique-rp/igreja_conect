/**
 * Driver de storage em filesystem local (fallback enquanto object storage
 * externo — Garage/RustFS — não está disponível/configurado).
 *
 * **Layout no disco:** `<STORAGE_LOCAL_DIR>/<bucket>/<key>`.
 * Metadados (content-type + metadata custom) ficam num sidecar
 * `<key>.meta.json` ao lado do arquivo (S3 guarda isso no objeto; aqui
 * não temos esse conceito nativo).
 *
 * **Segurança:** `key` é sempre normalizado com `path.normalize` +
 * validação de que o resultado final continua dentro do bucket dir —
 * evita path traversal via `../../etc/passwd`.
 */
import { promises as fs, createWriteStream } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { STORAGE_CONFIG } from "./config.server";

export interface LocalObjectMeta {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface LocalObject {
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

function getBaseDir(): string {
  return path.resolve(STORAGE_CONFIG.localDir);
}

/** Resolve o path físico do objeto, validando que fica dentro do bucket dir. */
function resolveObjectPath(bucket: string, key: string): string {
  const bucketDir = path.join(getBaseDir(), bucket);
  const fullPath = path.normalize(path.join(bucketDir, key));
  if (!fullPath.startsWith(path.normalize(bucketDir + path.sep)) && fullPath !== bucketDir) {
    throw new Error(`[storage/local] Path traversal detectado: ${bucket}/${key}`);
  }
  return fullPath;
}

function resolveMetaPath(bucket: string, key: string): string {
  return `${resolveObjectPath(bucket, key)}.meta.json`;
}

/** Garante que o diretório de um bucket existe (equivalente a CreateBucket). */
export async function localEnsureBucket(bucket: string): Promise<void> {
  await fs.mkdir(path.join(getBaseDir(), bucket), { recursive: true });
}

/** Equivalente a HeadBucket — retorna true se o diretório existe. */
export async function localHeadBucket(bucket: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(getBaseDir(), bucket));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function normalizeToBuffer(body: Buffer | Readable | string): Promise<Buffer> | Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  return streamToBuffer(body);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export interface LocalPutOpts {
  bucket: string;
  key: string;
  body: Buffer | Readable | string;
  contentType: string;
  metadata?: Record<string, string>;
}

/** Escreve um objeto no filesystem local. Cria diretórios pai se necessário. */
export async function localPutObject(
  opts: LocalPutOpts,
): Promise<{ etag: string }> {
  const objectPath = resolveObjectPath(opts.bucket, opts.key);
  await fs.mkdir(path.dirname(objectPath), { recursive: true });

  const buffer = await normalizeToBuffer(opts.body);
  await fs.writeFile(objectPath, buffer);

  const meta: LocalObjectMeta = {
    contentType: opts.contentType,
    metadata: opts.metadata,
  };
  await fs.writeFile(resolveMetaPath(opts.bucket, opts.key), JSON.stringify(meta));

  const { createHash } = await import("node:crypto");
  const etag = createHash("md5").update(buffer).digest("hex");
  return { etag };
}

/** Lê um objeto do filesystem local. Retorna `null` se não existir. */
export async function localGetObject(
  bucket: string,
  key: string,
): Promise<LocalObject | null> {
  const objectPath = resolveObjectPath(bucket, key);
  try {
    const body = await fs.readFile(objectPath);
    let meta: LocalObjectMeta = { contentType: "application/octet-stream" };
    try {
      const rawMeta = await fs.readFile(resolveMetaPath(bucket, key), "utf-8");
      meta = JSON.parse(rawMeta);
    } catch {
      // sem sidecar — usa default
    }
    return { body, contentType: meta.contentType, metadata: meta.metadata };
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

/** Deleta um objeto (+ sidecar de metadata) do filesystem local. */
export async function localDeleteObject(bucket: string, key: string): Promise<void> {
  const objectPath = resolveObjectPath(bucket, key);
  await fs.rm(objectPath, { force: true });
  await fs.rm(resolveMetaPath(bucket, key), { force: true });
}

/** Escreve um objeto via streaming (usado para arquivos grandes). */
export async function localPutObjectStream(
  opts: LocalPutOpts & { body: Readable },
): Promise<{ etag: string }> {
  const objectPath = resolveObjectPath(opts.bucket, opts.key);
  await fs.mkdir(path.dirname(objectPath), { recursive: true });

  const { createHash } = await import("node:crypto");
  const hash = createHash("md5");
  opts.body.on("data", (chunk) => hash.update(chunk));

  await pipeline(opts.body, createWriteStream(objectPath));

  const meta: LocalObjectMeta = {
    contentType: opts.contentType,
    metadata: opts.metadata,
  };
  await fs.writeFile(resolveMetaPath(opts.bucket, opts.key), JSON.stringify(meta));

  return { etag: hash.digest("hex") };
}
