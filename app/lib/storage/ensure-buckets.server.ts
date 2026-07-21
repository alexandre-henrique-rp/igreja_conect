/**
 * Auto-criação de buckets (dev only).
 *
 * **Padrão (training/object-storage-standard.md §11.6):**
 * > "Auto-criação: só em dev (LocalStack/MinIO). Produção = IaC (Terraform/Pulumi)."
 *
 * Idempotente: se o bucket já existe (HeadBucket OK), skip. Senão
 * cria (CreateBucket).
 *
 * Falha em produção se chamado por engano.
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { createStorageClient } from "./client.server";
import { STORAGE_CONFIG } from "./config.server";
import { localEnsureBucket, localHeadBucket } from "./local.server";

export interface EnsureBucketsResult {
  created: string[];
  skipped: string[];
  failed: { bucket: string; error: string }[];
}

/**
 * Garante que os 6 buckets padrão existem. Idempotente.
 *
 * @throws Error se `NODE_ENV === "production"` (use Terraform/Pulumi).
 */
export async function ensureBucketsExist(): Promise<EnsureBucketsResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[storage] ensureBucketsExist() must NOT run in production. Use IaC (Terraform/Pulumi).",
    );
  }

  const result: EnsureBucketsResult = { created: [], skipped: [], failed: [] };

  if (STORAGE_CONFIG.provider === "local") {
    for (const [, bucket] of Object.entries(STORAGE_CONFIG.buckets)) {
      try {
        const exists = await localHeadBucket(bucket);
        await localEnsureBucket(bucket);
        if (exists) {
          result.skipped.push(bucket);
        } else {
          result.created.push(bucket);
          console.log(`[storage] ✓ Created bucket dir: ${bucket}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.failed.push({ bucket, error: msg });
        console.error(`[storage] ✗ Failed to create ${bucket}: ${msg}`);
      }
    }
    return result;
  }

  const client = createStorageClient();

  for (const [, bucket] of Object.entries(STORAGE_CONFIG.buckets)) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      result.skipped.push(bucket);
    } catch (err: unknown) {
      const e = err as { $metadata?: { httpStatusCode?: number }; name?: string };
      const isNotFound =
        e.$metadata?.httpStatusCode === 404 ||
        e.name === "NotFound" ||
        e.name === "NoSuchBucket";

      if (isNotFound) {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          result.created.push(bucket);
          console.log(`[storage] ✓ Created bucket: ${bucket}`);
        } catch (createErr: unknown) {
          const msg =
            createErr instanceof Error ? createErr.message : String(createErr);
          result.failed.push({ bucket, error: msg });
          console.error(`[storage] ✗ Failed to create ${bucket}: ${msg}`);
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        result.failed.push({ bucket, error: msg });
        console.error(`[storage] ✗ HeadBucket failed for ${bucket}: ${msg}`);
      }
    }
  }

  return result;
}
