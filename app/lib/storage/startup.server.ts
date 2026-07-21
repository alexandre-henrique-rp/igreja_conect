/**
 * Startup do storage — garante que o worker de processamento de mídia
 * está rodando. Auto-executa ao ser importado (idempotente via globalThis).
 *
 * **Boot path:** importado via side-effect em `app/db/prisma.server.ts`,
 * que é carregado por toda rota server-side. Resultado: worker inicia no
 * primeiro request e persiste em HMR (graças ao guard `globalThis.__storage_worker_started__`).
 *
 * **Por que não em `vite.config.ts`?** Vite carrega o próprio config ANTES
 * do plugin de tsconfig-paths ativar, então qualquer import `~/...` resolve
 * como módulo externo e quebra o boot. Carregar de uma rota é mais seguro.
 *
 * **Em prod:** idealmente um processo Node separado (`node worker.js`),
 * rodando sob systemd/PM2/Docker. Por enquanto, mesmo processo do RR7.
 */
import { startWorker, _setWorkerRunning } from "./worker.server";

declare global {
  // eslint-disable-next-line no-var
  var __storage_worker_started__: boolean | undefined;
}

export function ensureStorageStarted(): void {
  if (globalThis.__storage_worker_started__) return;
  globalThis.__storage_worker_started__ = true;
  _setWorkerRunning(true);
  startWorker();
}

// Auto-executa no momento do import (idempotente).
ensureStorageStarted();
