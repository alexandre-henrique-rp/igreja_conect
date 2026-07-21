/**
 * Script de diagnostico de conexão S3 (Garage/MinIO/RustFS/AWS/R2).
 * Roda: pnpm storage:test
 */
import "dotenv/config";
import {
  S3Client,
  ListBucketsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { STORAGE_CONFIG } from "../app/lib/storage/config.server";
import { createStorageClient } from "../app/lib/storage/client.server";
import { uploadObject, deleteObject } from "../app/lib/storage/upload.server";
import { localGetObject, localEnsureBucket } from "../app/lib/storage/local.server";

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/** Fluxo de teste simplificado para o driver local (sem rede/S3). */
async function testLocalDriver() {
  console.log(`=== Teste de storage local (${STORAGE_CONFIG.provider}) ===\n`);
  console.log("Diretório:", STORAGE_CONFIG.localDir);
  console.log("Project prefix:", STORAGE_CONFIG.buckets.staging.split("-")[0]);
  console.log();

  const bucket = STORAGE_CONFIG.buckets.staging;
  const testKey = `test/${Date.now()}.txt`;

  await localEnsureBucket(bucket);
  console.log(`✅ Bucket '${bucket}' garantido (mkdir)`);

  await uploadObject({
    bucket,
    key: testKey,
    body: Buffer.from("teste de conexão"),
    contentType: "text/plain",
  });
  console.log(`✅ PutObject: ${bucket}/${testKey}`);

  const obj = await localGetObject(bucket, testKey);
  console.log("✅ GetObject:", obj?.body.toString("utf-8"));

  await deleteObject(bucket, testKey);
  console.log("✅ DeleteObject OK");

  console.log("\n=== Fim do teste ===");
}

async function main() {
  if (STORAGE_CONFIG.provider === "local") {
    return testLocalDriver();
  }

  console.log(`=== Teste de conexão S3 (${STORAGE_CONFIG.provider}) ===\n`);
  console.log("Provider:", STORAGE_CONFIG.provider);
  console.log("Endpoint:", STORAGE_CONFIG.endpoint);
  console.log("Region:", STORAGE_CONFIG.region);
  console.log("AccessKeyId:", STORAGE_CONFIG.accessKeyId.slice(0, 20) + "...");
  console.log("Project prefix:", STORAGE_CONFIG.buckets.staging.split("-")[0]);
  console.log();

  let client: S3Client;
  try {
    client = createStorageClient();
    console.log("✅ Cliente S3 criado");
  } catch (err) {
    console.error("❌ Erro ao criar cliente S3:", err);
    process.exit(1);
  }

  // Timeout global: evita o script travar indefinidamente se o endpoint
  // não responder (ex: porta bloqueada por firewall).
  const TIMEOUT_MS = 10_000;
  const timeout = setTimeout(() => {
    console.error(`❌ Timeout de ${TIMEOUT_MS}ms atingido — endpoint '${STORAGE_CONFIG.endpoint}' não respondeu. Verifique firewall/DNS/porta.`);
    process.exit(1);
  }, TIMEOUT_MS);
  timeout.unref?.();

  // 1. Listar buckets
  try {
    const list = await client.send(new ListBucketsCommand({}));
    console.log("✅ ListBuckets:", list.Buckets?.map((b) => b.Name).join(", ") || "(nenhum)");
  } catch (err) {
    console.error("❌ ListBuckets falhou:", err);
  }

  const bucket = STORAGE_CONFIG.buckets.staging;
  const testKey = `test/${Date.now()}.txt`;

  // 2. Verificar/criar bucket
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ Bucket '${bucket}' existe`);
  } catch (err: any) {
    console.warn(`⚠️ Bucket '${bucket}' não encontrado ou sem acesso:`, err.message || err);
    console.log(`Tentando criar bucket '${bucket}'...`);
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`✅ Bucket '${bucket}' criado`);
    } catch (createErr) {
      console.error(`❌ Não foi possível criar bucket '${bucket}':`, createErr);
      process.exit(1);
    }
  }

  // 3. PutObject
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from("teste de conexão"),
        ContentType: "text/plain",
      })
    );
    console.log(`✅ PutObject: ${bucket}/${testKey}`);
  } catch (err) {
    console.error("❌ PutObject falhou:", err);
    process.exit(1);
  }

  // 4. GetObject
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
    const body = obj.Body ? await streamToString(obj.Body) : "";
    console.log("✅ GetObject:", body);
  } catch (err) {
    console.error("❌ GetObject falhou:", err);
  }

  // 5. DeleteObject
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    console.log("✅ DeleteObject OK");
  } catch (err) {
    console.warn("⚠️ DeleteObject falhou:", err);
  }

  clearTimeout(timeout);
  console.log("\n=== Fim do teste ===");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
