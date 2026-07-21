/**
 * Script de diagnostico de conexão S3/Garage.
 * Roda: pnpm tsx scripts/test-storage.ts
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

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function main() {
  console.log("=== Teste de conexão S3/Garage ===\n");
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

  console.log("\n=== Fim do teste ===");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
