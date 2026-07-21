-- Storage / Uploads module (S3-compatible / Garage)
-- Adiciona tracking de uploads, audit log LGPD, e fila assíncrona SQLite-based.
-- Segue training/object-storage-standard.md (perfil "Completo" adaptado pra SQLite).

-- 1) Membro.avatarUploadId (FK opcional)
ALTER TABLE "membros" ADD COLUMN "avatarUploadId" TEXT;
CREATE INDEX "membros_avatarUploadId_idx" ON "membros"("avatarUploadId");

-- 2) Tabela uploads (metadata do arquivo no Garage)
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "contextId" TEXT,
    "contextType" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT 0,
    "originalFilename" TEXT NOT NULL,
    "declaredMime" TEXT NOT NULL,
    "detectedMime" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "ext" TEXT,
    "bucket" TEXT NOT NULL,
    "storageKeyPrefix" TEXT NOT NULL,
    "variants" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "rejectionReason" TEXT,
    "rejectionDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "failedAt" DATETIME,
    "deletedAt" DATETIME,
    "retentionUntil" DATETIME,
    "isPii" BOOLEAN NOT NULL DEFAULT 0
);
CREATE INDEX "uploads_userId_idx" ON "uploads"("userId");
CREATE INDEX "uploads_contextType_contextId_idx" ON "uploads"("contextType", "contextId");
CREATE INDEX "uploads_status_idx" ON "uploads"("status");
CREATE INDEX "uploads_deletedAt_idx" ON "uploads"("deletedAt");

-- 3) Audit log LGPD (art. 46)
CREATE TABLE "upload_audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "details" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "upload_audit_log_uploadId_idx" ON "upload_audit_log"("uploadId");
CREATE INDEX "upload_audit_log_event_createdAt_idx" ON "upload_audit_log"("event", "createdAt");

-- 4) Fila assíncrona SQLite-based (sem Redis/BullMQ)
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queue" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "jobs_queue_status_scheduledAt_idx" ON "jobs"("queue", "status", "scheduledAt");
