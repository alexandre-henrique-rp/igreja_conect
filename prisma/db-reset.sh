#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# prisma/db-reset.sh — workflow de banco SQLite (S05-T08/T09)
#
# Subcomandos:
#   reset   (default) — backup do banco atual, drop, migrate, seed
#   backup           — apenas backup rotativo (mantém últimos 5)
#   restore          — restaura o backup mais recente
#   help             — exibe esta ajuda
#
# Localização: `prisma/` (junto de seed.ts e prisma.config.ts). O capability
# grant original sugeria `scripts/`, mas o path-boundary hook global não
# permite `scripts/**` — `prisma/**` é o allowlist equivalente.
#
# Responsabilidades:
#   - Validar SESSION_SECRET (>= 16 chars) e .env.development presente.
#   - Bloquear execução em NODE_ENV=production (SEC-L-04 do audit S05).
#   - Backup rotativo (mantém últimos BACKUP_KEEP=5).
#
# Uso:
#   pnpm db:reset                       # via package.json (default: reset)
#   ./prisma/db-reset.sh                # equivalente
#   ./prisma/db-reset.sh backup         # só backup
#   ./prisma/db-reset.sh restore        # restaura o mais recente
#   DB_PATH=/caminho/db.sqlite ./prisma/db-reset.sh   # custom path
# ------------------------------------------------------------------------------
set -euo pipefail

# --- Configuração -------------------------------------------------------------
COMMAND="${1:-reset}"
DB_PATH="${DB_PATH:-}"
BACKUP_DIR="${BACKUP_DIR:-prisma/.backups}"
BACKUP_KEEP=5
ENV_FILE="${ENV_FILE:-.env.development}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Cores (TTY only)
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; BLUE=''; NC=''
fi

log()   { printf "${BLUE}[db-reset]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[db-reset] WARN:${NC} %s\n" "$*"; }
err()   { printf "${RED}[db-reset] ERROR:${NC} %s\n" "$*" >&2; }
ok()    { printf "${GREEN}[db-reset] OK:${NC} %s\n" "$*"; }

# --- Help ---------------------------------------------------------------------
print_help() {
  cat <<'EOF'
prisma/db-reset.sh — workflow de banco SQLite (S05-T08/T09)

Subcomandos:
  reset    (default) Backup rotativo, drop, prisma migrate deploy, seed.
  backup              Cria backup rotativo do banco atual (mantém últimos 5).
  restore             Restaura o backup mais recente (padrão: dev.db).
  help                Exibe esta ajuda.

Variáveis de ambiente (todas opcionais):
  DB_PATH       Caminho do dev.db. Default: autodetecta (raiz ou prisma/).
  BACKUP_DIR    Onde guardar backups. Default: prisma/.backups.
  BACKUP_KEEP   Quantos backups manter. Default: 5.
  ENV_FILE      Arquivo de env a validar. Default: .env.development.

Exit codes:
  0 sucesso | 1 pré-condição | 2 migration falhou | 3 seed falhou | 4 restore falhou

Exemplos:
  ./prisma/db-reset.sh                # reset completo
  ./prisma/db-reset.sh backup         # só backup
  ./prisma/db-reset.sh restore        # restaura último backup
  DB_PATH=/tmp/db.sqlite ./prisma/db-reset.sh reset
EOF
}

# --- Autodetecção do DB_PATH --------------------------------------------------
# O package.json original referencia prisma/dev.db, mas o Prisma 7.8 com
# DATABASE_URL=file:./dev.db resolve relativo ao cwd e cria o banco na RAIZ.
# Este script detecta o caminho real automaticamente.
detect_db_path() {
  if [ -n "$DB_PATH" ]; then return; fi
  if [ -f "dev.db" ]; then
    DB_PATH="dev.db"
  elif [ -f "prisma/dev.db" ]; then
    DB_PATH="prisma/dev.db"
  else
    DB_PATH="dev.db"  # será criado pelo migrate deploy
  fi
}

# --- Pré-condições compartilhadas --------------------------------------------
precheck() {
  # Bloqueio de produção (SEC-L-04 do security-audit S05)
  if [ "${NODE_ENV:-}" = "production" ]; then
    err "NODE_ENV=production detectado — operações destrutivas BLOQUEADAS em prod."
    err "Para prod, use 'prisma migrate deploy' e gerencie seed manualmente."
    exit 1
  fi

  # .env.development deve existir (S04 rework: SESSION_SECRET obrigatório)
  if [ ! -f "$ENV_FILE" ]; then
    err "Arquivo '$ENV_FILE' não encontrado."
    err "Crie com: cp .env.example .env.development  (ou defina SESSION_SECRET manualmente)."
    err "SESSION_SECRET precisa ter >= 16 chars (RAG convention-prisma-sqlite)."
    exit 1
  fi

  # Carregar SESSION_SECRET do .env.* (Vite carrega em dev, mas pnpm/db não)
  local secret
  secret="$(grep -E '^SESSION_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' || true)"
  if [ -z "${secret:-}" ]; then
    err "SESSION_SECRET não definido em $ENV_FILE."
    exit 1
  fi
  if [ "${#secret}" -lt 16 ]; then
    err "SESSION_SECRET tem ${#secret} chars — precisa de >= 16 (fail-fast do session.server.ts)."
    exit 1
  fi
  ok "SESSION_SECRET validado (${#secret} chars)"
}

# --- Backup rotativo ---------------------------------------------------------
do_backup() {
  detect_db_path
  if [ ! -f "$DB_PATH" ]; then
    warn "Banco $DB_PATH não existe — pulando backup."
    return 0
  fi
  mkdir -p "$BACKUP_DIR"
  local backup_file="$BACKUP_DIR/$(basename "$DB_PATH").bak.$TIMESTAMP"
  log "Backup do banco atual → $backup_file"
  cp "$DB_PATH" "$backup_file"

  local count
  count=$(ls -1 "$BACKUP_DIR"/$(basename "$DB_PATH").bak.* 2>/dev/null | wc -l)
  if [ "$count" -gt "$BACKUP_KEEP" ]; then
    local remove_count=$((count - BACKUP_KEEP))
    log "Rotação: removendo $remove_count backup(s) antigo(s) (mantém últimos $BACKUP_KEEP)"
    ls -1t "$BACKUP_DIR"/$(basename "$DB_PATH").bak.* | tail -n "$remove_count" | xargs -r rm -f
  fi
  ok "Backup concluído ($count mantidos em $BACKUP_DIR)"
}

# --- Restore ----------------------------------------------------------------
do_restore() {
  detect_db_path
  if [ ! -d "$BACKUP_DIR" ]; then
    err "Diretório de backup $BACKUP_DIR não existe."
    exit 4
  fi
  local latest
  latest=$(ls -1t "$BACKUP_DIR"/$(basename "$DB_PATH").bak.* 2>/dev/null | head -1 || true)
  if [ -z "$latest" ]; then
    err "Nenhum backup encontrado em $BACKUP_DIR"
    exit 4
  fi
  log "Restaurando $latest → $DB_PATH"
  cp "$latest" "$DB_PATH"
  ok "Banco restaurado de $latest"
}

# --- Reset completo ---------------------------------------------------------
do_reset() {
  precheck
  do_backup
  log "Removendo $DB_PATH"
  rm -f "$DB_PATH"

  log "Rodando migrations (prisma migrate deploy)..."
  if ! pnpm exec prisma migrate deploy; then
    err "prisma migrate deploy falhou — banco NÃO foi resetado. Verifique migrations."
    exit 2
  fi
  ok "Migrations aplicadas"

  log "Rodando seed (tsx prisma/seed.ts)..."
  if ! pnpm db:seed; then
    err "Seed falhou — banco resetado mas SEM dados. Rode 'pnpm db:seed' manualmente."
    exit 3
  fi
  ok "Seed concluído"

  log "Resumo:"
  echo "  DB path:        $DB_PATH"
  echo "  Migrations:     OK"
  echo "  Seed:           OK"
  echo "  Backup dir:     $BACKUP_DIR (mantém últimos $BACKUP_KEEP)"
  echo "  Credenciais:    admin@igreja.local / admin123  (TROCAR EM PROD)"
  echo
  ok "Banco resetado com sucesso. Próximo passo: pnpm build && pnpm start"
}

# --- Router ------------------------------------------------------------------
case "$COMMAND" in
  reset)   do_reset ;;
  backup)  precheck; do_backup ;;
  restore) precheck; do_restore ;;
  help|--help|-h) print_help ;;
  *)
    err "Subcomando desconhecido: $COMMAND"
    print_help
    exit 1
    ;;
esac
