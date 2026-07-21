/**
 * Factory de S3Client para Garage (ou qualquer S3-compatible).
 *
 * Garage requer **path-style** addressing (`host.tld/bucket/key`),
 * `forcePathStyle: true` força isso no AWS SDK.
 *
 * Singleton lazy: cliente criado sob demanda e cacheado em `globalThis`
 * pra sobreviver a HMR do Vite sem recriar a cada request.
 */
import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "node:https";
import { STORAGE_CONFIG } from "./config.server";

const GLOBAL_KEY = "__storage_s3_client__" as const;

declare global {
  // eslint-disable-next-line no-var
  var __storage_s3_client__: S3Client | undefined;
}

/**
 * Retorna o S3Client singleton (lazy + cacheado em globalThis).
 *
 * **Garage/MinIO:** `forcePathStyle: true` (vhost-style não funciona
 * com DNS que não tem wildcard para o bucket).
 *
 * **AWS S3 / R2:** path-style desabilitado (default vhost).
 */
export function createStorageClient(): S3Client {
  if (globalThis[GLOBAL_KEY]) return globalThis[GLOBAL_KEY]!;

  const usesPathStyle =
    STORAGE_CONFIG.provider === "garage" || STORAGE_CONFIG.provider === "minio";

  const endpointIsHttps =
    typeof STORAGE_CONFIG.endpoint === "string" &&
    STORAGE_CONFIG.endpoint.startsWith("https://");

  const disableTlsVerification =
    process.env.STORAGE_TLS_REJECT_UNAUTHORIZED === "false" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

  const client = new S3Client({
    endpoint: STORAGE_CONFIG.endpoint,
    region: STORAGE_CONFIG.region,
    credentials: {
      accessKeyId: STORAGE_CONFIG.accessKeyId,
      secretAccessKey: STORAGE_CONFIG.secretAccessKey,
    },
    forcePathStyle: usesPathStyle,
    requestHandler:
      endpointIsHttps && disableTlsVerification
        ? new NodeHttpHandler({
            httpsAgent: new HttpsAgent({ rejectUnauthorized: false }),
          })
        : undefined,
  });

  globalThis[GLOBAL_KEY] = client;
  return client;
}

/** Reseta o singleton (usar só em testes). */
export function _resetStorageClient(): void {
  globalThis[GLOBAL_KEY] = undefined;
}
