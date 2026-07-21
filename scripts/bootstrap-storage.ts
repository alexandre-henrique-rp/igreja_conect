#!/usr/bin/env tsx
/**
 * Bootstrap de storage — auto-cria os 6 buckets padrão no Garage (dev).
 *
 * **Uso:**
 *   pnpm tsx scripts/bootstrap-storage.ts
 *
 * Idempotente: buckets existentes são skipados.
 * Refusa rodar em produção (use Terraform/Pulumi).
 */
import "dotenv/config";
import { ensureBucketsExist } from "../app/lib/storage/ensure-buckets.server";
import { assertStorageConfigured } from "../app/lib/storage/config.server";

async function main() {
  console.log("[bootstrap] Verificando configuração...");
  assertStorageConfigured();

  console.log("[bootstrap] Garantindo buckets no Garage...");
  const result = await ensureBucketsExist();

  console.log("\n[bootstrap] Resultado:");
  console.log(`  ✓ Criados: ${result.created.length}`);
  result.created.forEach((b) => console.log(`    - ${b}`));
  console.log(`  → Já existiam: ${result.skipped.length}`);
  result.skipped.forEach((b) => console.log(`    - ${b}`));
  if (result.failed.length > 0) {
    console.log(`  ✗ Falhas: ${result.failed.length}`);
    result.failed.forEach((f) => console.log(`    - ${f.bucket}: ${f.error}`));
    process.exit(1);
  }

  console.log("\n[bootstrap] ✓ Storage pronto para uso.");
}

main().catch((err) => {
  console.error("[bootstrap] ✗ Erro fatal:", err);
  process.exit(1);
});
