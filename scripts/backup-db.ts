import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

// file:./path → path absoluto/relativo
// file:/app/data/prod.db → /app/data/prod.db
const dbPath = databaseUrl.replace(/^file:\/\//, "").replace(/^file:/, "");

if (!existsSync(dbPath)) {
  console.log(`Banco não encontrado em ${dbPath}, nada para fazer backup.`);
  process.exit(0);
}

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, "-");
const backupDir = databaseUrl.startsWith("file:/app/data")
  ? "/app/data/backups"
  : `${dirname(dbPath)}/backups`;

if (!existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

const backupPath = `${backupDir}/prod-${timestamp}.db`;
copyFileSync(dbPath, backupPath);
console.log(`Backup criado: ${backupPath}`);
