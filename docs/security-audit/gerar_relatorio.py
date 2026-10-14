#!/usr/bin/env python3
"""
Gerador do Relatório de Auditoria de Segurança — Igreja Conect.

Stack detectada:
  - Runtime: Node 24 + React 19 + React Router 7.16 (SSR) + Prisma 7.8 + SQLite
  - ORM: Prisma (queries via `prisma.x.findUnique/findMany/count/aggregate`)
  - Auth: cookie httpOnly `__session` (sliding TTL 7d, absoluto 30d) + bcryptjs cost 10
  - RBAC: 3 camadas (UI / loader+action / service) — `assertCan*` em `app/lib/rbac.server.ts`
  - Storage: S3-compatible (Garage/MinIO/RustFS/AWS/R2) + driver local fallback
  - Deploy: Dockerfile (Alpine + Node 24, pnpm) — sem docker-compose, sem Helm, sem CI
  - Frontend: React 19 + Tailwind v4 — auto-escape padrão; único `dangerouslySetInnerHTML` é sanitizado

O relatório cobre as 5 categorias adaptadas a esta stack:
  1. BANCO SEM TRANCA  → isolamento por escopo de RBAC no `where` Prisma
  2. PERMISSÃO NO NAVEGADOR → cruzamento UI gate (`<Can>`, `user.cargo === "ADMIN"`)
                             com backend gate (`assertCan*`, `getMembroById`)
  3. IDOR → todos os handlers de rota com `:id` no path
  4. CHAVES EXPOSTAS → `.env`, `.env.development`, `.env.example`, `prisma/seed.ts`,
                        `app/lib/storage/local-signed-url.server.ts`, git log
  5. XSS → `dangerouslySetInnerHTML` (1 ocorrência), `innerHTML`, `eval`,
            renderização de Markdown/HTML, `href` controlado por usuário
"""

import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

# ──────────────────────────────────────────────────────────────────────────────
# SAÍDA
# ──────────────────────────────────────────────────────────────────────────────
OUT_DIR = Path(__file__).parent
OUT_PDF = OUT_DIR / "relatorio-auditoria-seguranca.pdf"
CHARTS_DIR = OUT_DIR / "_charts"
CHARTS_DIR.mkdir(exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

import re as _re

_VALID_TAGS = {"b", "i", "u", "em", "br", "font", "para"}


def escape_non_html_tags(text):
    """Escapa `<tag>` que NÃO estão na whitelist reportlab.

    Necessário porque alguns achados citam JSX/code (ex.: `<AutocompleteInput>`,
    `<script>`) que o parser do reportlab interpretaria como tag HTML e quebraria.
    """

    def replace_tag(m):
        tag = m.group(0)
        name_match = _re.match(r"</?(\w+)", tag)
        if not name_match:
            return tag
        name = name_match.group(1).lower()
        if name in _VALID_TAGS:
            return tag
        return tag.replace("<", "&lt;").replace(">", "&gt;")

    return _re.sub(r"</?[A-Za-z][^>]*>", replace_tag, text)


# ──────────────────────────────────────────────────────────────────────────────
# PALETA
# ──────────────────────────────────────────────────────────────────────────────
PALETTE = {
    "critica": colors.HexColor("#B91C1C"),
    "alta": colors.HexColor("#EA580C"),
    "media": colors.HexColor("#D97706"),
    "baixa": colors.HexColor("#2563EB"),
    "forte": colors.HexColor("#059669"),
    "info": colors.HexColor("#6B7280"),
    "primary": colors.HexColor("#0F172A"),
    "muted": colors.HexColor("#64748B"),
    "bg_alt": colors.HexColor("#F1F5F9"),
    "border": colors.HexColor("#CBD5E1"),
}

# ──────────────────────────────────────────────────────────────────────────────
# ACHADOS
# ──────────────────────────────────────────────────────────────────────────────

ACHADOS = [
    # ── C1: Banco sem tranca (isolamento de escopo) ────────────────────────────
    {
        "id": "F-01",
        "categoria": "C1",
        "categoria_nome": "Isolamento de dados (escopo no `where` Prisma)",
        "sev": "alta",
        "sev_label": "Alta",
        "titulo": "KPIs de membros usam `where: {}` global — vaza total para escopos restritos",
        "arquivo": "app/routes/app/membros._index.tsx",
        "linhas": "84-91",
        "trecho": (
            "const baseWhere: Prisma.MembroWhereInput = {};\n"
            "const [kpiTotal, kpiAtivos, kpiVisitantes, kpiCongregados] = await Promise.all([\n"
            "  prisma.membro.count({ where: baseWhere }),\n"
            "  prisma.membro.count({ where: { ...baseWhere, tipo: 'MEMBRO_ATIVO' } }),\n"
            "  prisma.membro.count({ where: { ...baseWhere, tipo: 'VISITANTE' } }),\n"
            "  prisma.membro.count({ where: { ...baseWhere, tipo: 'CONGREGADO' } }),\n"
            "]);"
        ),
        "por_que": (
            "`baseWhere` está vazio. A listagem é escopada por `listMembros` (RBAC fina: "
            "DISCIPULADOR/LIDER_MINISTERIO vê só discípulos vinculados), mas os 4 cards de "
            "KPI batem `prisma.membro.count({ where: {} })`, retornando o total GLOBAL da "
            "igreja. Um DISCIPULADOR autenticado vê os 4 contadores globais — aprende o "
            "tamanho total da igreja e o número de visitantes mesmo sem listar ninguém."
        ),
        "impacto": (
            "Vazamento de métricas globais para usuários com escopo restrito. Quebra a "
            "promessa de '404 (não vaza existência)' do RAG `security-rbac-matrix`."
        ),
        "sugestao": (
            "Construir `baseWhere` a partir de `user.cargo` (mesma lógica de `listMembros`): "
            "DISCIPULADOR/LIDER_MINISTERIO → `{ discipuladorId: user.id }`; outros cargos → `{}`. "
            "Centralizar a regra em uma helper `getMembrosCountWhere(user)` em `members.server.ts`."
        ),
        "aceite": [
            "DISCIPULADOR logado vê KPI Total = número de discípulos dele",
            "LIDER_MINISTERIO logado vê KPI Total = número de discípulos dele",
            "ADMIN/PASTOR/SECRETARIO continuam vendo totais globais",
            "Teste cobrindo cada cargo com 0/1/N discípulos",
        ],
    },
    {
        "id": "F-02",
        "categoria": "C1",
        "categoria_nome": "Isolamento de dados (escopo no `where` Prisma)",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Busca global em `/api/search` sem filtro de escopo",
        "arquivo": "app/routes/api/search.ts",
        "linhas": "16-46",
        "trecho": (
            "if (type === 'celulas') {\n"
            "  const celulas = await prisma.celula.findMany({\n"
            "    where: q ? { nome: { contains: q } } : undefined,\n"
            "    select: { id: true, nome: true, diaSemana: true, horario: true },\n"
            "    take: 10, orderBy: { nome: 'asc' },\n"
            "  });\n"
            "}\n"
            "if (type === 'members') {\n"
            "  const members = await prisma.membro.findMany({\n"
            "    where: q ? { nome: { contains: q } } : undefined,\n"
            "    take: 10, orderBy: { nome: 'asc' },\n"
            "  });\n"
            "}"
        ),
        "por_que": (
            "Qualquer usuário autenticado (incluindo cargos sem permissão administrativa) "
            "pode listar até 10 membros e 10 células da igreja inteira via autocomplete. "
            "Provavelmente intencional para alimentar `<AutocompleteInput>` em formulários "
            "financeiros/operacionais, mas não há gating por cargo — DISCIPULADOR logado "
            "pode enumerar nomes de membros que não são seus discípulos."
        ),
        "impacto": (
            "Enumeração de nomes de todos os membros via endpoint de autocomplete. Não "
            "retorna PII (apenas id+nome+tipo), mas permite mapear a base de membros."
        ),
        "sugestao": (
            "Aceitar a busca como está se for genuinamente intencional para selects. Caso "
            "contrário, replicar a RBAC fina de `listMembros`: para `type=members` aplicar "
            "`discipuladorId = user.id` quando cargo ∈ {DISCIPULADOR, LIDER_MINISTERIO}."
        ),
        "aceite": [
            "Decisão registrada em comentário JSDoc do endpoint",
            "Se decidir escopar: DISCIPULADOR vê só nomes de discípulos no autocomplete",
            "Audit log: registrar `actorRole` em hits do endpoint",
        ],
    },
    # ── C2: Permissão no navegador ─────────────────────────────────────────────
    {
        "id": "F-03",
        "categoria": "C2",
        "categoria_nome": "Permissão só no navegador (UI sem backend gate)",
        "sev": "critica",
        "sev_label": "Crítica",
        "titulo": "Reset de senha sem prova de posse — conta de qualquer membro pode ser sequestrada",
        "arquivo": "app/routes/public/recuperar-senha.tsx",
        "linhas": "24-62 (action) + 39-58 (verificação)",
        "trecho": (
            "// step === 'verificar'\n"
            "const membro = await prisma.membro.findUnique({\n"
            "  where: { email: parsed.data.email },\n"
            "  select: { id: true, nome: true, senhaHash: true },\n"
            "});\n"
            "if (!membro) return data({ step: 1, formError: 'E-mail ou nome incorretos.' }, ...);\n"
            "const nomeNormalizado = membro.nome.trim().toLowerCase();\n"
            "const inputNormalizado = parsed.data.nome.trim().toLowerCase();\n"
            "if (!nomeNormalizado.includes(inputNormalizado)\n"
            "    && !inputNormalizado.includes(nomeNormalizado)) {\n"
            "  return data({ step: 1, formError: 'E-mail ou nome incorretos.' }, ...);\n"
            "}\n"
            "return data({ step: 1, success: true, email: parsed.data.email });\n"
            "\n"
            "// step === 'redefinir' — NÃO exige token da etapa 1\n"
            "await prisma.membro.update({ where: { id: membro.id }, data: { senhaHash } });"
        ),
        "por_que": (
            "A 'verificação' compara email + nome via `String.includes()` (case-insensitive). "
            "Como o schema aceita `nome` com apenas 2+ caracteres (`schemas/auth.ts:77`), o "
            "atacante fornece QUALQUER par de 2+ letras contidas no nome real — nome é "
            "informação pública (visível na lista de membros). Pior: o step 2 (`redefinir`) "
            "NÃO verifica token nem sessão intermediária — basta re-enviar `email` para o "
            "mesmo handler e a senha é sobrescrita. Nenhum 2FA, nenhum e-mail de confirmação, "
            "nenhum token de uso único."
        ),
        "impacto": (
            "Tomada de conta (account takeover) de qualquer usuário da igreja. Basta saber o "
            "endereço de e-mail (visível em diversos canais: cartão de membro, listas de "
            "oração, redes sociais). Compromete inclusive a conta ADMIN — pivô para acesso "
            "total ao módulo financeiro."
        ),
        "sugestao": (
            "(a) Substituir o fluxo 2-step por envio de token: gerar UUID v4, persistir em "
            "tabela `password_reset_token` com `expiresAt = now + 30min` + `usedAt`, enviar "
            "link com token por e-mail; (b) Step 2 exigir `token` válido e não usado; (c) "
            "invalidar todas as sessões do membro após troca de senha; (d) incluir no log "
            "de auditoria o IP e UA da requisição; (e) rate-limit por IP e por e-mail."
        ),
        "aceite": [
            "Não é possível redefinir senha sem token de uso único válido por ≤ 30min",
            "Token expirado/usedAt não permite redefinição",
            "Sessões anteriores do membro são invalidadas após reset",
            "Audit log registra o reset com IP+UA",
            "Teste E2E: tentativa sem token retorna 422",
        ],
    },
    {
        "id": "F-04",
        "categoria": "C2",
        "categoria_nome": "Permissão só no navegador (UI sem backend gate)",
        "sev": "media",
        "sev_label": "Média",
        "titulo": "IPs em rate-limit podem ser falsificados via campo `clientIP` no body do form",
        "arquivo": "app/routes/public/login.tsx",
        "linhas": "56-61",
        "trecho": (
            "const ip =\n"
            "  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??\n"
            "  request.headers.get('x-real-ip') ??\n"
            "  (formData.get('clientIP') as string) ??\n"
            "  'unknown';"
        ),
        "por_que": (
            "Quando o request NÃO vem de proxy reverso (sem XFF/X-Real-IP), o IP usado "
            "para rate-limit e audit log cai para `formData.get('clientIP')` — campo que "
            "o atacante controla integralmente via body do POST. Resultado: bypass "
            "trivial do rate-limit (rotacionar `clientIP` a cada tentativa) e logs de "
            "auditoria envenenados."
        ),
        "impacto": (
            "Bypass do rate-limit de login permite força-bruta. Logs de auditoria ficam "
            "poluídos com IPs falsos, mascarando tentativas reais."
        ),
        "sugestao": (
            "Remover `formData.get('clientIP')` do cálculo de IP. Usar exclusivamente "
            "headers do proxy (XFF, X-Real-IP) e, na ausência, o IP do socket TCP "
            "(`request.headers.get('x-real-ip')` ou variável de ambiente do reverse "
            "proxy). Documentar no deploy que o app DEVE rodar atrás de proxy que "
            "preenche XFF, e rejeitar `NODE_ENV=production` se nenhum IP conseguir ser "
            "determinado."
        ),
        "aceite": [
            "Não existe mais leitura de `clientIP` do body",
            "Rate-limit não pode ser bypassado via variação de campo do form",
            "Audit log registra apenas IPs vindos do proxy (verificáveis)",
        ],
    },
    {
        "id": "F-05",
        "categoria": "C2",
        "categoria_nome": "Permissão só no navegador (UI sem backend gate)",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Loader de `ministerios.$id` não aplica RBAC — UI de edição exposta a quem não edita",
        "arquivo": "app/routes/app/ministerios.$id.tsx",
        "linhas": "65-91",
        "trecho": (
            "export async function loader({ context, params }) {\n"
            "  const user = context.get(userContext);\n"
            "  if (!user) throw new Response('Não autenticado.', { status: 401 });\n"
            "  ...\n"
            "  const ministerio = await prisma.ministerio.findUnique({ where: { id: ministerioId }, ... });\n"
            "  if (!ministerio) throw new Response('Ministério não encontrado.', { status: 404 });\n"
            "  const canEdit =\n"
            "    user.cargo != null && (CAN_MANAGE as readonly string[]).includes(user.cargo);"
        ),
        "por_que": (
            "A action valida `canEdit` (RBAC), mas o loader NÃO chama "
            "`assertCanManageMinisterios(user)`. Resultado: qualquer usuário autenticado "
            "(mesmo DISCIPULADOR sem cargo) consegue ABRIR a página de edição do "
            "ministério e ler dados internos (membros, funções, atividades, "
            "disponibilidades). Apenas os controles de submit são escondidos. Pelo "
            "princípio de 'least privilege' a leitura também deveria ser gated para os "
            "perfis administrativos."
        ),
        "impacto": (
            "Vazamento de dados sensíveis de ministérios (lista nominal de membros, "
            "funções, histórico de atividades) para usuários que não deveriam ter acesso "
            "nem de leitura."
        ),
        "sugestao": (
            "Adicionar `assertCanManageMinisterios(user)` no loader (camada 2). Se a "
            "intenção for manter leitura ampla, criar uma matriz separada — ex.: cargos "
            "com `READ_MINISTERIO = ['ADMIN','PASTOR','SECRETARIO','LIDER_MINISTERIO']`."
        ),
        "aceite": [
            "DISCIPULADOR sem cargo recebe 403 ao abrir `/app/ministerios/:id`",
            "ADMIN/PASTOR/SECRETARIO/LIDER_MINISTERIO continuam lendo",
            "Teste cobrindo cada cargo",
        ],
    },
    # ── C3: IDOR ──────────────────────────────────────────────────────────────
    {
        "id": "F-06",
        "categoria": "C3",
        "categoria_nome": "IDOR — acesso a objeto por ID sem checagem de posse/escopo",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Detalhe de transferência exposto por ID sem RBAC fina — qualquer perfil financeiro acessa",
        "arquivo": "app/routes/app/financeiro.transferencias.$id.tsx",
        "linhas": "40-58",
        "trecho": (
            "export async function loader({ params, context }) {\n"
            "  const user = context.get(userContext);\n"
            "  if (!user) throw new Response('Não autenticado.', { status: 401 });\n"
            "  assertCanSeeFinancialModule(user);\n"
            "  const transferencia = await prisma.transferenciaCaixa.findUnique({\n"
            "    where: { id: params.id }, include: { caixaOrigem: ..., caixaDestino: ..., executadoPor: ... },\n"
            "  });\n"
            "  if (!transferencia) throw new Response('Transferência não encontrada.', { status: 404 });\n"
            "  return { user, transferencia };\n"
            "}"
        ),
        "por_que": (
            "Não há tenant/igreja neste monorepo (single-tenant), então todas as "
            "transferências pertencem à mesma igreja. Dentro do módulo financeiro, isso "
            "é aceitável — todos os 4 cargos (ADMIN/PASTOR/FINANCEIRO/SECRETARIO) têm "
            "visão compartilhada do módulo. **IDOR puro só existiria se houvesse multi-tenant.** "
            "Como não há, o risco é INFORMATIONAL: vale documentar que transferências "
            "são visíveis para qualquer perfil financeiro e não há isolamento por operador."
        ),
        "impacto": ("Nenhum em ambiente single-tenant. Informativo."),
        "sugestao": (
            "Documentar a decisão arquitetural (single-tenant → visibilidade ampla no "
            "módulo financeiro). Se multi-tenant for adicionado no futuro, criar "
            "`tenantId` em `TransferenciaCaixa` e filtrar `where: { tenantId: user.tenantId }`."
        ),
        "aceite": [
            "Comentário JSDoc sinaliza que este loader confia no RBAC de módulo",
            "Roadmap de multi-tenant já referencia este loader",
        ],
    },
    {
        "id": "F-07",
        "categoria": "C3",
        "categoria_nome": "IDOR — acesso a objeto por ID sem checagem de posse/escopo",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Detalhe de lançamento exposto por ID — exemplo positivo (SECRETARIO filtrado em DIZIMO)",
        "arquivo": "app/routes/app/financeiro.lancamentos.$id.tsx",
        "linhas": "60-93",
        "trecho": (
            "assertCanSeeFinancialModule(user);\n"
            "const id = params.id;\n"
            "const lancamento = await prisma.lancamento.findUnique({ where: { id }, include: { ... } });\n"
            "if (!lancamento) throw new Response('Lançamento não encontrado.', { status: 404 });\n"
            "// RBAC fino: SECRETARIO não vê DIZIMO (404, não 403 — não vaza existência)\n"
            "if (user.cargo === 'SECRETARIO' && lancamento.categoria === 'DIZIMO') {\n"
            "  throw new Response('Lançamento não encontrado.', { status: 404 });\n"
            "}"
        ),
        "por_que": (
            "Padrão correto: SECRETARIO é filtrado por categoria DIZIMO com 404 (não "
            "vaza existência). Single-tenant → sem IDOR verdadeiro. Mantido como "
            "exemplo positivo na auditoria."
        ),
        "impacto": ("Nenhum — prática recomendada. Ponto forte."),
        "sugestao": "Manter como está.",
        "aceite": [],
    },
    {
        "id": "F-08",
        "categoria": "C3",
        "categoria_nome": "IDOR — acesso a objeto por ID sem checagem de posse/escopo",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Detalhe de caixa exposto por ID — sem isolamento entre caixas para SECRETARIO",
        "arquivo": "app/routes/app/financeiro.caixas.$id.tsx",
        "linhas": "57-129",
        "trecho": (
            "assertCanSeeFinancialModule(user);\n"
            "const caixaId = params.id;\n"
            "const result = await getCaixaDetalhe(caixaId, { ... }, user);\n"
            "if (!result) throw new Response('Caixa não encontrado.', { status: 404 });"
        ),
        "por_que": (
            "Validação RBAC feita pela camada 3 (`getCaixaDetalhe` aplica escopo). "
            "Single-tenant → SECRETARIO vê todos os caixas (intencional). Padrão OK."
        ),
        "impacto": "Nenhum em single-tenant. Informativo.",
        "sugestao": "Manter como está.",
        "aceite": [],
    },
    # ── C4: Chaves expostas ───────────────────────────────────────────────────
    {
        "id": "F-09",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "critica",
        "sev_label": "Crítica",
        "titulo": "SESSION_SECRET de prod commitado no git via `.env.development`",
        "arquivo": ".env.development",
        "linhas": "1-5 (todo o arquivo)",
        "trecho": (
            "# Ambiente de desenvolvimento (Vite carrega automaticamente em pnpm dev)\n"
            "# SESSION_SECRET — chave para assinar o cookie de sessão. Em produção, configure\n"
            "# via variável de ambiente no deploy (NÃO commitar a chave de produção).\n"
            'SESSION_SECRET="ba9585ca0efb2de1d6ca5c5b3b266ed6052077fbce73a2e6"\n'
            'BASE_URL="http://localhost:5173"'
        ),
        "por_que": (
            "O secret `ba9585ca...` é o MESMO que está em `.env` (não versionado, OK) e em "
            "`.env.development` (versionado). `git log --diff-filter=A --name-only` confirma "
            "commit `176f3774 financeiro` que adicionou o arquivo. Quem tiver acesso ao "
            "repo (mesmo fork/dump) pode forjar cookies de sessão para qualquer usuário."
        ),
        "impacto": (
            "Forjamento de sessão: com `SESSION_SECRET` em mãos, qualquer atacante pode "
            "criar cookie `__session=<qualquer-uuid-v4>` e logar como qualquer membro "
            "(desde que saiba o `sid` ou use UUID arbitrário — a verificação é "
            "`findUnique({where: {id: sid}})`)."
        ),
        "sugestao": (
            "(1) ROTACIONAR `SESSION_SECRET` IMEDIATAMENTE em produção; (2) Remover "
            "`.env.development` do git history (`git filter-repo --invert-paths "
            "--path .env.development`); (3) Adicionar pre-commit hook (`gitleaks` ou "
            "check de `SESSION_SECRET=`) para impedir recorrência; (4) Substituir o valor "
            'em `.env.development` por `SESSION_SECRET=""` com comentário dizendo para '
            "gerar um novo (`openssl rand -hex 32`); (5) Tratar o secret antigo como "
            "COMPROMETIDO — invalidar todas as sessões existentes (DELETE FROM sessions) "
            "após o rotate."
        ),
        "aceite": [
            "Histórico do git do arquivo `.env.development` removido",
            "Novo `SESSION_SECRET` gerado em prod (≥ 32 chars, aleatório)",
            "Todas as sessões ativas invalidadas",
            "Pre-commit hook para detectar segredos em commits futuros",
            "Adicionar `.env.development` em `.gitignore`",
        ],
    },
    {
        "id": "F-10",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "critica",
        "sev_label": "Crítica",
        "titulo": "Credenciais de ADMIN com senha fraca `senha123` em `.env` versionável",
        "arquivo": ".env",
        "linhas": "1-10",
        "trecho": (
            'SESSION_SECRET="ba9585ca0efb2de1d6ca5c5b3b266ed6052077fbce73a2e6"\n'
            "ADMIN_EMAIL=kingdevtec@gmail.com\n"
            "ADMIN_PASSWORD=senha123\n"
            'DATABASE_URL="file:/home/kingdev/Documentos/igreja_conect/dev.db"'
        ),
        "por_que": (
            "Embora `.env` esteja em `.gitignore`, o arquivo existe no filesystem de "
            "desenvolvimento com credenciais fracas. Se deploy automático copiar `.env` "
            "para o container (sem override), `senha123` fica em produção. Combinado com "
            "F-11 (seed com fallback `admin123`), há um vetor de credencial default."
        ),
        "impacto": (
            "Se `.env` for copiado para produção: senha trivial quebrada por dicionário "
            "em < 1ms. ADMIN tem acesso total (financeiro, configs, gestão de usuários)."
        ),
        "sugestao": (
            "Não versionar `.env` (já OK). Substituir `ADMIN_PASSWORD=senha123` por "
            "gerador de senha forte no `.env` local (ou gerar via `openssl rand -base64 "
            "24`). No deploy de produção, exigir `ADMIN_PASSWORD` com ≥ 12 chars, "
            "alfanumérico + símbolos, e rejeitar valores da wordlist `rockyou.txt`."
        ),
        "aceite": [
            "`ADMIN_PASSWORD` não está mais em wordlist comum",
            "Deploy script valida tamanho/complexidade antes de subir",
            "Teste: rodar seed em prod com ADMIN_PASSWORD curto → erro",
        ],
    },
    {
        "id": "F-11",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "alta",
        "sev_label": "Alta",
        "titulo": "`prisma/seed.ts` tem fallback `admin123` + senhas de demo commitadas",
        "arquivo": "prisma/seed.ts",
        "linhas": "25, 79, 103, 127, 150, 228",
        "trecho": (
            ": (process.env.ADMIN_PASSWORD ?? 'admin123'); // TROCAR EM PRODUÇÃO\n"
            "senha: 'ricardo123',\n"
            "senha: 'ana12345',\n"
            "senha: 'marcos123',\n"
            "senha: 'juliana123',\n"
            "senha: 'bia12345',"
        ),
        "por_que": (
            "O seed cria ADMIN com `ADMIN_PASSWORD ?? 'admin123'` se a env não estiver "
            "definida. Em dev funciona (env setada), mas se alguém rodar `db:seed:prod` "
            "sem env, ADMIN fica com senha `admin123`. Além disso, 5 senhas de demo "
            "(`ricardo123`, `ana12345`, etc.) estão commitadas — qualquer um que rode "
            "`pnpm db:seed` herda contas com senhas triviais. O check em "
            "`process.env.NODE_ENV === 'production'` (linha 283) só bloqueia se ADMIN_* "
            "estiver VAZIO, não se tiver valor fraco."
        ),
        "impacto": (
            "Se `pnpm db:seed` rodar sem env definida em qualquer ambiente, surge "
            "conta ADMIN com senha `admin123`. Catálogo de senhas de demo também "
            "viraria credenciais reais se seed rodar em prod acidentalmente."
        ),
        "sugestao": (
            "(a) Remover fallback `?? 'admin123'` — falhar com erro explícito se env não "
            "definida; (b) Aceitar env `DEMO_SEED_ALLOWED=true` em dev para permitir "
            "criar usuários de demo; em prod, rejeitar a operação se env não-setada; "
            "(c) Mover as 5 contas de demo para `prisma/seed-demo.ts` separado, não "
            "rodado em prod; (d) Adicionar aviso (audit log) quando seed roda."
        ),
        "aceite": [
            "Falhar loud se `ADMIN_PASSWORD` não estiver setada (em qualquer NODE_ENV)",
            "Contas de demo isoladas em script opcional",
            "`db:seed` em prod exige flag explícita",
        ],
    },
    {
        "id": "F-12",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "alta",
        "sev_label": "Alta",
        "titulo": "Chaves S3 (`STORAGE_*_KEY`) reais em `.env` no filesystem",
        "arquivo": ".env",
        "linhas": "14-22",
        "trecho": (
            "STORAGE_ENDPOINT=https://coolify.esmirna.com.br:9000\n"
            "STORAGE_REGION=us-east-1\n"
            "STORAGE_PROVIDER=local\n"
            "STORAGE_ACCESS_KEY_ID=GK1096add2a3ac3d64f3736040\n"
            "STORAGE_SECRET_ACCESS_KEY=da454c48426208400c461bdd8f7f5ea3639fbb77db1582dd31222ddc0a3e3d37\n"
            'STORAGE_TLS_REJECT_UNAUTHORIZED="false"'
        ),
        "por_que": (
            "Apesar de `STORAGE_PROVIDER=local` no momento (driver local ignora as chaves "
            "S3 — `config.server.ts:91-98`), as chaves reais estão no `.env`. Se alguém "
            "trocar para `STORAGE_PROVIDER=garage` no deploy e esquecer de rotacionar, "
            "as chaves antigas expostas serão usadas. Além disso, `STORAGE_TLS_REJECT_"
            'AUTHORIZED="false"` desabilita validação de cert TLS (MITM viável).'
        ),
        "impacto": (
            "Exposição de chaves S3 se backend mudar de provider. MITM no canal TLS do "
            "storage (com `rejectUnauthorized=false`)."
        ),
        "sugestao": (
            "(a) Trocar `STORAGE_*_KEY` por valores dummy no `.env` local (não usar as "
            "reais); (b) Rotacionar chaves no Garage/MinIO; (c) Setar "
            "`STORAGE_TLS_REJECT_UNAUTHORIZED=true` em produção; (d) Adicionar check de "
            "startup que rejeita `rejectUnauthorized=false` em produção (exceto via env "
            "`INSECURE_TLS=true` opt-in documentado)."
        ),
        "aceite": [
            "Chaves S3 reais não estão no filesystem dev",
            "TLS strict-mode em produção",
            "Startup check para `rejectUnauthorized=false` em prod",
        ],
    },
    {
        "id": "F-13",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "media",
        "sev_label": "Média",
        "titulo": "Fallback hardcoded `dev-only-not-secret` / `dev-insecure-secret-change-me`",
        "arquivo": "app/lib/session.server.ts + app/lib/storage/local-signed-url.server.ts",
        "linhas": "37 + 22",
        "trecho": (
            "// session.server.ts:37\n"
            "secrets: [process.env.SESSION_SECRET ?? 'dev-only-not-secret'],\n"
            "// local-signed-url.server.ts:22\n"
            "return 'dev-insecure-secret-change-me';"
        ),
        "por_que": (
            "Em `session.server.ts:1-7` há check que REJEITA `SESSION_SECRET` vazio em "
            "produção, mas aceita qualquer string com ≥ 32 chars. Em "
            "`local-signed-url.server.ts:18-21` o mesmo padrão. Se o operador subir com "
            '`NODE_ENV=staging` ou esquecer a env, o app cai no fallback `"dev-only-not-secret"`, '
            "usado por QUALQUER pessoa que baixar o código-fonte para forjar cookies de "
            "sessão válidos contra essa instância. Pior ainda: o fallback de HMAC do "
            "storage local é uma constante conhecida, permitindo a qualquer um forjar "
            "URLs assinadas para baixar arquivos do driver local."
        ),
        "impacto": (
            "Se NODE_ENV não for `production`, ambos os fallbacks ativam e geram "
            "segredos previsíveis/forjáveis. Atacante com acesso ao repo pode forjar "
            "cookies e signed URLs."
        ),
        "sugestao": (
            "Em vez de fallback, SEMPRE throw em qualquer NODE_ENV se SESSION_SECRET "
            "ausente. Para dev local, instruir a gerar via `openssl rand -hex 32` no "
            "README. Mesmo comportamento para HMAC do storage local (não usar fallback)."
        ),
        "aceite": [
            "Throw explícito se SESSION_SECRET ausente em qualquer NODE_ENV",
            "Throw explícito se HMAC secret ausente em qualquer NODE_ENV",
            "Teste: `delete process.env.SESSION_SECRET` → app não inicia",
        ],
    },
    {
        "id": "F-14",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "`.env.example` traz placeholders com 64 zeros + GK... alheio",
        "arquivo": ".env.example",
        "linhas": "15-16",
        "trecho": (
            'STORAGE_ACCESS_KEY_ID="GK000000000000000000000000"\n'
            'STORAGE_SECRET_ACCESS_KEY="0000000000000000000000000000000000000000000000000000000000000000"'
        ),
        "por_que": (
            "Placeholders de exemplo não são segredo, mas `GK000000000000000000000000` "
            "tem o prefixo real (`GK`) e poderia confundir um operador descuidado que "
            "copiasse o `.env.example` direto. Boa prática: prefixar com `REPLACE-ME` "
            "ou deixar vazio + comentário."
        ),
        "impacto": "Baixo — só confusão se operador não ler.",
        "sugestao": 'Trocar por `STORAGE_ACCESS_KEY_ID=""` + `STORAGE_SECRET_ACCESS_KEY=""` com comentário.',
        "aceite": [".env.example sem placeholders com prefixo real"],
    },
    {
        "id": "F-15",
        "categoria": "C4",
        "categoria_nome": "Segredos hardcoded / expostos",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Endpoint interno e bucket names logados em erro de upload",
        "arquivo": "app/routes/api/uploads.ts",
        "linhas": "165-194",
        "trecho": (
            "console.error('[upload] staging_upload_failed:', errorDetails);\n"
            "// errorDetails inclui bucket, endpoint, key, stack, message\n"
            "details: process.env.NODE_ENV === 'production' ? undefined : errorDetails,"
        ),
        "por_que": (
            "Em produção, o response NÃO vaza errorDetails (guard ok). Mas o "
            "`console.error` continua logando stack trace, bucket, endpoint e key do "
            "S3 — se logs vazarem (Docker logs, Datadog, etc.), expõe infra. Não é "
            "crítico, mas reduz superfície."
        ),
        "impacto": "Vazamento de infra interna via logs.",
        "sugestao": (
            "Não logar `errorDetails` completo. Logar apenas `error.message` e um ID "
            "de correlação. Manter detalhes internos em tabela `Upload.rejectionDetails` "
            "(já persiste)."
        ),
        "aceite": ["Logs de produção não contêm bucket/endpoint/key"],
    },
    # ── C5: XSS / input não tratado ───────────────────────────────────────────
    {
        "id": "F-16",
        "categoria": "C5",
        "categoria_nome": "XSS / input não tratado",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "`dangerouslySetInnerHTML` em convite — implementado COM escape, OK mas frágil",
        "arquivo": "app/routes/app/membros.$id.tsx",
        "linhas": "249-274",
        "trecho": (
            "function renderConvitePreview(text: string): React.ReactNode {\n"
            "  const escape = (s: string) =>\n"
            "    s.replace(/[&<>\"']/g, (c) => { ... });  // escapa 5 chars\n"
            "  return text.split(/\\n{2,}/).map((paragraph, i) => {\n"
            "    const html = escape(paragraph)\n"
            "      .replace(/\\*([^*\\n]+)\\*/g, '<strong>$1</strong>')\n"
            "      .replace(/\\n/g, '<br/>');\n"
            "    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;\n"
            "  });\n"
            "}"
        ),
        "por_que": (
            "A regex `/\\*([^*\\n]+)\\*/g` captura conteúdo entre asteriscos. O escape é "
            "feito ANTES do replace, então qualquer `*<script>...*` seria escapado "
            "primeiro (`&lt;script&gt;`) e depois o `<strong>` envolveria o texto "
            "inofensivo. **OK por inspeção.** Marcado como informativo porque: (a) é "
            "fácil quebrar a sanidade numa alteração futura; (b) `[^*\\n]+` não casa "
            "`**` aninhado, mas se mudar a regex para `(.+?)` ou similar, vira vetor."
        ),
        "impacto": "Nenhum no estado atual.",
        "sugestao": (
            "Trocar por uma lib de sanitização HTML (`dompurify`) ou renderizar Markdown "
            "via lib (`marked` + `dompurify`). Adicionar teste com payload XSS cobrindo "
            'casos: `*<script>alert(1)</script>*`, `*" onerror=alert(1) "*`.'
        ),
        "aceite": [
            "Cobertura de teste com 5+ payloads XSS",
            "Lib de sanitização documentada e mantida",
        ],
    },
    {
        "id": "F-17",
        "categoria": "C5",
        "categoria_nome": "XSS / input não tratado",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Ausência de lib de sanitização — sem cobertura para input futuro",
        "arquivo": "(global)",
        "linhas": "-",
        "trecho": (
            "$ grep -rn 'dompurify|sanitize|xss' app/ --include='*.tsx' --include='*.ts'\n"
            "# (sem resultados)"
        ),
        "por_que": (
            "Não existe nenhuma lib de sanitização HTML no projeto (`package.json` "
            "também não tem `dompurify`, `sanitize-html`, `xss`). Toda a defesa XSS "
            "atual depende do auto-escape do React 19 + 1 escape manual bem "
            "implementado. Qualquer futuro renderizador Markdown/HTML adicionará risco."
        ),
        "impacto": "Risco futuro — não atual.",
        "sugestao": "Adicionar `dompurify` (com `@types/dompurify`) e isolar toda renderização HTML via wrapper.",
        "aceite": ["Wrapper `safeHtml(input)` usado em >= 1 ponto já implementado"],
    },
    {
        "id": "F-18",
        "categoria": "C5",
        "categoria_nome": "XSS / input não tratado",
        "sev": "baixa",
        "sev_label": "Baixa",
        "titulo": "Backend usa `console.error` com dados de erro antes de sanitizar",
        "arquivo": "app/lib/storage/worker.server.ts",
        "linhas": "55, 287, 335",
        "trecho": (
            "console.error(`[storage] Job ${jobId} falhou: ${msg}`);\n"
            "console.warn(`[storage] Upload ${uploadId} REJECTED: ${reason}`, details);"
        ),
        "por_que": (
            "`msg`, `reason` e `details` vêm do worker que processa uploads do "
            "usuário (`clamav.server.ts` retorna erros com nome do arquivo, tipo MIME, "
            "etc.). Se um upload tem filename como `$(rm -rf /)`, o `console.warn` "
            "logaria literal mas só em stderr — não é shell injection. **OK**, mas "
            "vale documentar para que ninguém adicione log de input user-controlled em "
            "formato que vá para SIEM sem encoding."
        ),
        "impacto": "Nenhum direto.",
        "sugestao": "Sanitizar strings antes de logar (remover CRLF + escapes ANSI).",
        "aceite": [],
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# PONTOS FORTES
# ──────────────────────────────────────────────────────────────────────────────
PONTOS_FORTES = [
    {
        "titulo": "Middleware de auth centralizado em `/app/**`",
        "evidencia": "app/routes/app/_middleware.tsx:49-70",
        "detalhe": (
            "Todas as rotas filhas herdam `authMiddleware` via "
            "`layout('routes/app/_middleware.tsx', [...])` em `app/routes.ts:68`. "
            "Sem cookie válido → redirect 302 para `/login?next=…`. Não há como "
            "esquecer auth numa rota `/app/**`."
        ),
    },
    {
        "titulo": "Cookie de sessão com flags estritas",
        "evidencia": "app/lib/session.server.ts:31-38",
        "detalhe": (
            "`httpOnly: true` (mitiga XSS roubando sessão), `sameSite: 'lax'` "
            "(mitiga CSRF em mutações), `secure: NODE_ENV === 'production'`, TTL "
            "sliding 7d / absoluto 30d."
        ),
    },
    {
        "titulo": "RBAC em 3 camadas consistente",
        "evidencia": "app/lib/rbac.server.ts (15 asserts canônicos) + uso em todas as rotas",
        "detalhe": (
            "Helpers `assertCan*` lançam `Response(403)` que o ErrorBoundary do RR7 "
            "captura. Cada domínio declara sua matriz (DIZIMO_CARGOS, "
            "FINANCIAL_MODULE_CARGOS, MANAGE_CAIXA_CARGOS, etc.) — single source."
        ),
    },
    {
        "titulo": "Validação de SESSION_SECRET no startup",
        "evidencia": "app/lib/session.server.ts:1-7",
        "detalhe": (
            "Em produção, rejeita SESSION_SECRET vazio ou com < 32 caracteres. "
            "Previne deploy com secret default."
        ),
    },
    {
        "titulo": "MEMBRO_SAFE_SELECT — LGPD AC-16",
        "evidencia": "app/lib/members.server.ts:51-91",
        "detalhe": (
            "Select canônico do Prisma que NUNCA inclui `senhaHash`. Toda função "
            "do módulo usa este select. `grep senhaHash app/lib/members.server.ts` "
            "retorna 0 hits em queries."
        ),
    },
    {
        "titulo": "Dízimos com escopo fino por cargo",
        "evidencia": "financeiro.lancamentos.$id.tsx:91-93 + caixas.server.ts (listaPorCaixa filtra DIZIMO)",
        "detalhe": (
            "SECRETARIO não vê lançamentos DIZIMO — retorna 404 (não 403), "
            "não vaza existência. Filtro aplicado em TODA query de listagem."
        ),
    },
    {
        "titulo": "DISCIPULADOR fora de escopo → 404 (não 403)",
        "evidencia": "app/lib/members.server.ts:201-205",
        "detalhe": (
            "`getMembroById` verifica se DISCIPULADOR/LIDER_MINISTERIO tem acesso "
            "via `discipuladorId === user.id`. Se não, lança NotFoundError → 404. "
            "Padão seguro: não revela existência do recurso."
        ),
    },
    {
        "titulo": "IP hashing SHA-256 antes do audit log",
        "evidencia": "app/lib/audit.server.ts:45-48, 73",
        "detalhe": (
            "Atende LGPD art. 46. IP puro nunca é persistido — só o hash SHA-256. "
            "`safeLog` ainda aplica allowlist antes de imprimir no console."
        ),
    },
    {
        "titulo": "Audit log com allowlist (safeLog)",
        "evidencia": "app/lib/audit.server.ts:14-39",
        "detalhe": (
            "Filtra evento para apenas `userId`, `action`, `resource`, `result`, "
            "`timestamp`, `ip`. Email, telefone, senhaHash, valor nunca tocam o "
            "logger."
        ),
    },
    {
        "titulo": "Idempotency key UUID v4 em transferências",
        "evidencia": "app/lib/transferencias.server.ts + financeiro.transferencia-nova.tsx:233-237",
        "detalhe": (
            "Gera UUID no cliente e envia no form. Service usa "
            "`prisma.transferenciaCaixa.findUnique({where: {idempotencyKey}})` antes "
            "do INSERT → garante que cliques duplicados não geram transferências "
            "duplicadas."
        ),
    },
    {
        "titulo": "Mensagem unificada no login (anti-enumeração)",
        "evidencia": "app/routes/public/login.tsx:125 + auth.server.ts:29-32",
        "detalhe": (
            "Retorna `null` tanto para e-mail inexistente quanto para senha "
            "incorreta. UI exibe 'E-mail ou senha incorretos.' indistintamente."
        ),
    },
    {
        "titulo": "Rate limit in-memory no login",
        "evidencia": "app/lib/rate-limit.server.ts + login.tsx:64-81",
        "detalhe": (
            "3 falhas em 1h por chave. Retorna 429 com `Retry-After` header. "
            "(Limitação: estado em memória, não escala multi-instância — INFO.)"
        ),
    },
    {
        "titulo": "Open-redirect prevention",
        "evidencia": "app/routes/public/login.tsx:164-169",
        "detalhe": (
            "`safeNext` rejeita qualquer `?next=` que não comece com `/` ou que "
            "comece com `//` (URL absoluta). Padrão recomendado OWASP."
        ),
    },
    {
        "titulo": "bcryptjs cost 10 (ADR-002)",
        "evidencia": "app/lib/auth.server.ts:45",
        "detalhe": (
            "Cost 10 = ~50ms por hash em hardware comum. Documentado em ADR-002 com "
            "critério para aumentar para 12 se virar gargalo."
        ),
    },
    {
        "titulo": "HMAC SHA-256 timing-safe comparison",
        "evidencia": "app/lib/storage/local-signed-url.server.ts:101-104",
        "detalhe": (
            "Signed URLs do driver local usam `crypto.timingSafeEqual` para evitar "
            "vazamento de bytes via comparação byte-a-byte."
        ),
    },
    {
        "titulo": "Soft-delete em `Upload` (LGPD art. 18, VI)",
        "evidencia": "app/routes/api/uploads.$id.delete.ts:42-49",
        "detalhe": (
            "Marca `deletedAt` + `retentionUntil = now + 30d`. Hard-delete fica a "
            "cargo de worker de cleanup. Permite janela de arrependimento."
        ),
    },
    {
        "titulo": "Zod schemas em todos os forms críticos",
        "evidencia": "app/lib/schemas/* (auth, membros, caixas, lancamentos, transferencias, alertas, ministerios)",
        "detalhe": (
            "Validação server-side com mensagens PT-BR. `.strict()` em alguns "
            "schemas rejeita keys desconhecidas (anti mass-assignment)."
        ),
    },
    {
        "titulo": "Limites server-side em queries de listagem",
        "evidencia": "app/lib/members.server.ts:143-144 + routes vários",
        "detalhe": (
            "`pageSize` clampado em `Math.min(100, Math.max(1, ...))`. `q` cortado "
            "em 100 chars (anti-DoS em `LIKE`). Search params de busca validados "
            "via Zod antes de tocar Prisma."
        ),
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# ISSUES PARA GITHUB
# ──────────────────────────────────────────────────────────────────────────────


def issue_block(num, title, body_md):
    """Wrap issue body in delimited block for easy copy-paste."""
    block = f"--- ISSUE {num} ---\n\n# {title}\n\n"
    block += body_md.rstrip() + "\n\n"
    block += f"--- FIM ISSUE {num} ---\n"
    return block


GITHUB_ISSUES = [
    {
        "num": 1,
        "title": "[Segurança] Reset de senha sem prova de posse — Account Takeover universal",
        "labels": "security, critical",
        "body": issue_block(
            1,
            "[Segurança] Reset de senha sem prova de posse — Account Takeover universal",
            (
                "**Labels:** `security`, `critical`\n\n"
                "## Problema\n"
                "O fluxo `/recuperar-senha` permite a qualquer pessoa que conheça o "
                "e-mail de um usuário redefinir a senha e tomar conta da conta. A "
                "'verificação' de identidade compara email + nome via "
                "`String.includes()` com mínimo de 2 caracteres (`schemas/auth.ts:77`), "
                "e o step 2 não exige token nem sessão intermediária.\n\n"
                "## Por que é explorável\n"
                "1. Atacante sabe o e-mail da vítima (cartão de membro, redes sociais).\n"
                "2. Atacante envia POST `/recuperar-senha` com `step=verificar`, "
                "email da vítima e qualquer nome de 2+ letras contido no nome real "
                "(nomes são públicos em listas de membros).\n"
                "3. Backend valida com `membro.nome.includes(input)` → retorna "
                "`{success: true}`.\n"
                "4. Atacante envia POST com `step=redefinir` + email + nova senha.\n"
                "5. `prisma.membro.update` sobrescreve `senhaHash` sem pedir "
                "nenhum token, código por SMS, e-mail de confirmação nem 2FA.\n\n"
                "## Evidência\n"
                "- `app/routes/public/recuperar-senha.tsx:39-58` (verificação "
                "trivial)\n"
                "- `app/routes/public/recuperar-senha.tsx:64-101` (redefinição "
                "sem token)\n"
                "- `app/lib/schemas/auth.ts:69-79` (nome com min 2 chars)\n\n"
                "## Impacto\n"
                "Compromete QUALQUER conta, inclusive ADMIN. Pivô para acesso total "
                "ao módulo financeiro e gestão de usuários.\n\n"
                "## Sugestão de correção\n"
                "1. Substituir o fluxo 2-step por envio de token: gerar UUID v4, "
                "persistir em `password_reset_token` com `expiresAt = now + 30min` "
                "+ `usedAt`.\n"
                "2. Enviar link com token por e-mail.\n"
                "3. Step 2 exigir `token` válido e não usado.\n"
                "4. Invalidar todas as sessões do membro após troca (`DELETE FROM "
                "Session WHERE membroId = ?`).\n"
                "5. Rate-limit por IP e por e-mail (5/h).\n"
                "6. Audit log com IP + UA.\n\n"
                "## Critérios de aceite\n"
                "- [ ] Não é possível redefinir senha sem token de uso único válido "
                "por ≤ 30min\n"
                "- [ ] Token expirado/usedAt não permite redefinição\n"
                "- [ ] Sessões anteriores do membro são invalidadas após reset\n"
                "- [ ] Audit log registra reset com IP+UA\n"
                "- [ ] Teste E2E: tentativa sem token retorna 422\n"
                "- [ ] Rate-limit: 5 resets/h por e-mail + 10/h por IP"
            ),
        ),
    },
    {
        "num": 2,
        "title": "[Segurança] Rotação imediata de SESSION_SECRET e remoção do histórico",
        "labels": "security, critical",
        "body": issue_block(
            2,
            "[Segurança] Rotação imediata de SESSION_SECRET e remoção do histórico",
            (
                "**Labels:** `security`, `critical`\n\n"
                "## Problema\n"
                '`SESSION_SECRET="ba9585ca0efb2de1d6ca5c5b3b266ed6052077fbce73a2e6"` '
                "está COMMITADO em `.env.development` (git log confirma commit "
                "`176f3774 financeiro`). Quem tem acesso ao repo pode forjar cookies "
                "de sessão válidos para qualquer membro.\n\n"
                "## Por que é explorável\n"
                "`session.server.ts:37` usa o secret diretamente em "
                "`secrets: [process.env.SESSION_SECRET]`. O cookie assinado por "
                "esse secret é aceito pelo app — `findUnique({where: {id: sid}})` "
                "no DB. Atacante pode escolher qualquer UUID v4 como sid e o login "
                "será aceito.\n\n"
                "## Evidência\n"
                "- `.env.development:4` — secret literal\n"
                "- `git log --diff-filter=A --name-only` retorna `.env.development` "
                "no commit `176f3774`\n\n"
                "## Impacto\n"
                "Forjamento de sessão universal. Atacante loga como qualquer "
                "membro sem precisar de credenciais.\n\n"
                "## Sugestão de correção\n"
                "1. **Rotacionar `SESSION_SECRET` em produção IMEDIATAMENTE** "
                "(`openssl rand -hex 32`).\n"
                "2. **Remover `.env.development` do git history** "
                "(`git filter-repo --invert-paths --path .env.development`).\n"
                "3. Adicionar `.env.development` em `.gitignore`.\n"
                "4. Tratar secret antigo como comprometido — invalidar todas as "
                "sessões ativas (`DELETE FROM Session`).\n"
                "5. Pre-commit hook (`gitleaks` ou check `SESSION_SECRET=`).\n\n"
                "## Critérios de aceite\n"
                "- [ ] Histórico do `.env.development` removido do repo\n"
                "- [ ] Novo `SESSION_SECRET` em prod (≥ 32 chars, aleatório)\n"
                "- [ ] Todas as sessões ativas invalidadas\n"
                "- [ ] Pre-commit hook ativo\n"
                "- [ ] `.env.development` no `.gitignore`"
            ),
        ),
    },
    {
        "num": 3,
        "title": "[Segurança] Credenciais de ADMIN com senha fraca + chaves S3 reais em .env",
        "labels": "security, critical",
        "body": issue_block(
            3,
            "[Segurança] Credenciais de ADMIN com senha fraca + chaves S3 reais em .env",
            (
                "**Labels:** `security`, `critical`\n\n"
                "## Problema\n"
                "Arquivo `.env` (filesystem dev) contém:\n"
                "- `ADMIN_PASSWORD=senha123` (trivial, quebrada em <1ms)\n"
                "- `STORAGE_ACCESS_KEY_ID` e `STORAGE_SECRET_ACCESS_KEY` reais "
                "(apontam para `coolify.esmirna.com.br:9000`)\n"
                '- `STORAGE_TLS_REJECT_UNAUTHORIZED="false"` (MITM no canal S3)\n\n'
                "Além disso, `prisma/seed.ts:25` tem fallback `?? 'admin123'` "
                "caso `ADMIN_PASSWORD` não esteja definida em env — combinações "
                "perigosas se seed rodar em prod sem env.\n\n"
                "## Por que é explorável\n"
                "`STORAGE_PROVIDER=local` ignora as chaves S3 atualmente "
                "(`config.server.ts:91-98`), mas:\n"
                "(a) `.env` com `senha123` é o primeiro vetor de força-bruta contra "
                "a conta `kingdevtec@gmail.com` se deploy copiar o arquivo.\n"
                "(b) Trocar `STORAGE_PROVIDER=garage` no deploy sem rotacionar as "
                "chaves reutiliza credenciais expostas.\n"
                "(c) `rejectUnauthorized=false` aceita cert autoassinado/inválido.\n\n"
                "## Evidência\n"
                "- `.env:8-9` (`ADMIN_PASSWORD=senha123`)\n"
                "- `.env:14-22` (chaves S3 + `rejectUnauthorized=false`)\n"
                "- `prisma/seed.ts:25` (fallback `admin123`)\n\n"
                "## Impacto\n"
                "Credential stuffing contra ADMIN. MITM no canal S3. Seed de prod "
                "com senha trivial.\n\n"
                "## Sugestão de correção\n"
                "1. Trocar `ADMIN_PASSWORD` no `.env` por valor "
                "aleatório (≥ 12 chars, `openssl rand -base64 24`).\n"
                "2. Rotacionar `STORAGE_*_KEY` no Garage/MinIO.\n"
                "3. Setar `STORAGE_TLS_REJECT_UNAUTHORIZED=true` em prod.\n"
                "4. Adicionar startup check que rejeita `rejectUnauthorized=false` "
                "em produção (exceto via `INSECURE_TLS=true` opt-in documentado).\n"
                "5. Remover fallback `admin123` do `seed.ts` — falhar com erro "
                "explícito se env não definida.\n\n"
                "## Critérios de aceite\n"
                "- [ ] `.env` sem `senha123` ou outras senhas de wordlist\n"
                "- [ ] Chaves S3 rotacionadas\n"
                "- [ ] `rejectUnauthorized=true` em prod\n"
                "- [ ] Seed falha se `ADMIN_PASSWORD` não definida\n"
                "- [ ] Teste: rodar seed sem env → erro"
            ),
        ),
    },
    {
        "num": 4,
        "title": "[Segurança] Bypass de rate-limit via campo clientIP no body do login",
        "labels": "security, high",
        "body": issue_block(
            4,
            "[Segurança] Bypass de rate-limit via campo clientIP no body do login",
            (
                "**Labels:** `security`, `high`\n\n"
                "## Problema\n"
                "`app/routes/public/login.tsx:56-61` aceita o IP do cliente a partir "
                "do próprio form (`formData.get('clientIP')`) quando os headers "
                "`x-forwarded-for` e `x-real-ip` estão ausentes. Atacante rotaciona "
                "`clientIP` a cada POST para burlar o rate-limit.\n\n"
                "## Por que é explorável\n"
                "A lógica do IP é:\n"
                "```ts\n"
                "const ip =\n"
                "  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??\n"
                "  request.headers.get('x-real-ip') ??\n"
                "  (formData.get('clientIP') as string) ??  // <- atacante controla\n"
                "  'unknown';\n"
                "```\n"
                "Em qualquer deploy sem proxy reverso que preencha XFF, o atacante "
                "controla o IP usado pelo rate-limit e pelo audit log.\n\n"
                "## Evidência\n"
                "`app/routes/public/login.tsx:56-61`\n\n"
                "## Impacto\n"
                "Bypass de rate-limit de login (3 falhas/hora). Força-bruta viável. "
                "Audit log poluído com IPs falsos.\n\n"
                "## Sugestão de correção\n"
                "1. Remover leitura de `formData.get('clientIP')`.\n"
                "2. Usar exclusivamente headers do proxy (XFF, X-Real-IP) + IP do "
                "socket TCP.\n"
                "3. Em `NODE_ENV=production`, exigir pelo menos um header de proxy "
                "— caso contrário, rejeitar a request.\n\n"
                "## Critérios de aceite\n"
                "- [ ] Sem leitura de `clientIP` do body\n"
                "- [ ] Rate-limit não pode ser bypassado\n"
                "- [ ] Audit log registra apenas IPs do proxy\n"
                "- [ ] Teste: enviar POST com `clientIP` variável não afeta o "
                "bucket de rate-limit"
            ),
        ),
    },
    {
        "num": 5,
        "title": "[Segurança] KPIs de membros vazam totais globais para perfis com escopo restrito",
        "labels": "security, high",
        "body": issue_block(
            5,
            "[Segurança] KPIs de membros vazam totais globais para perfis com escopo restrito",
            (
                "**Labels:** `security`, `high`\n\n"
                "## Problema\n"
                "`app/routes/app/membros._index.tsx:84-91` usa "
                "`prisma.membro.count({where: baseWhere})` com `baseWhere = {}`. "
                "DISCIPULADOR/LIDER_MINISTERIO logado vê totais GLOBAIS da igreja "
                "(total de membros, ativos, visitantes, congregados) mesmo a "
                "listagem sendo escopada para apenas seus discípulos.\n\n"
                "## Por que é explorável\n"
                "`listMembros` aplica RBAC fina corretamente "
                "(`members.server.ts:149-154`), mas os 4 cards de KPI batem "
                "`count({where: {}})` direto, sem filtrar por `user.id` ou cargo. "
                "Quebra o padrão '404 (não vaza existência)' do RAG "
                "`security-rbac-matrix`.\n\n"
                "## Evidência\n"
                "`app/routes/app/membros._index.tsx:84-91`\n\n"
                "## Impacto\n"
                "Vazamento de métricas globais (tamanho da igreja, nº de "
                "visitantes) para usuários com escopo restrito.\n\n"
                "## Sugestão de correção\n"
                "Construir `baseWhere` a partir de `user.cargo` (mesma lógica de "
                "`listMembros`):\n"
                "```ts\n"
                "const baseWhere: Prisma.MembroWhereInput =\n"
                "  (user.cargo === 'DISCIPULADOR' || user.cargo === 'LIDER_MINISTERIO')\n"
                "    ? { discipuladorId: user.id }\n"
                "    : {};\n"
                "```\n"
                "Centralizar em `members.server.ts` como helper `getMembrosCountWhere(user)`.\n\n"
                "## Critérios de aceite\n"
                "- [ ] DISCIPULADOR logado vê KPI Total = nº de discípulos dele\n"
                "- [ ] LIDER_MINISTERIO logado vê KPI Total = nº de discípulos dele\n"
                "- [ ] ADMIN/PASTOR/SECRETARIO continuam vendo totais globais\n"
                "- [ ] Teste cobrindo cada cargo"
            ),
        ),
    },
    {
        "num": 6,
        "title": "[Segurança] Loader de edição de ministério expõe dados sem RBAC",
        "labels": "security, medium",
        "body": issue_block(
            6,
            "[Segurança] Loader de edição de ministério expõe dados sem RBAC",
            (
                "**Labels:** `security`, `medium`\n\n"
                "## Problema\n"
                "`app/routes/app/ministerios.$id.tsx:65-91` (loader) NÃO chama "
                "`assertCanManageMinisterios`. Apenas a action valida `canEdit`. "
                "Qualquer usuário autenticado (inclusive DISCIPULADOR sem cargo) "
                "consegue abrir a página e ler dados internos (membros vinculados, "
                "funções, atividades, disponibilidades).\n\n"
                "## Por que é explorável\n"
                "O loader faz `findUnique` direto no Prisma sem checar permissão. "
                "DISCIPULADOR logado navega para `/app/ministerios/<qualquer-id>` "
                "e lê a lista nominal de membros do ministério, histórico de "
                "atividades e indisponibilidades.\n\n"
                "## Evidência\n"
                "`app/routes/app/ministerios.$id.tsx:65-91`\n\n"
                "## Impacto\n"
                "Vazamento de dados sensíveis de ministérios (membros nominais, "
                "funções, atividades) para usuários sem permissão.\n\n"
                "## Sugestão de correção\n"
                "Adicionar `assertCanManageMinisterios(user)` no loader (camada 2). "
                "Se a intenção for manter leitura ampla, criar matriz separada "
                "(`READ_MINISTERIO = ['ADMIN','PASTOR','SECRETARIO','LIDER_MINISTERIO']`).\n\n"
                "## Critérios de aceite\n"
                "- [ ] DISCIPULADOR recebe 403 ao abrir `/app/ministerios/:id`\n"
                "- [ ] ADMIN/PASTOR/SECRETARIO/LIDER_MINISTERIO continuam lendo\n"
                "- [ ] Teste cobrindo cada cargo"
            ),
        ),
    },
    {
        "num": 7,
        "title": "[Segurança] Senhas de demo + fallback admin123 em prisma/seed.ts",
        "labels": "security, high",
        "body": issue_block(
            7,
            "[Segurança] Senhas de demo + fallback admin123 em prisma/seed.ts",
            (
                "**Labels:** `security`, `high`\n\n"
                "## Problema\n"
                "`prisma/seed.ts` contém:\n"
                "1. Fallback `process.env.ADMIN_PASSWORD ?? 'admin123'` (linha 25)\n"
                "2. 5 senhas de demo hardcoded: `ricardo123`, `ana12345`, "
                "`marcos123`, `juliana123`, `bia12345` (linhas 79, 103, 127, 150, "
                "228)\n\n"
                "O check de produção (linha 283) só bloqueia se `ADMIN_*` estiver "
                "vazio, não se tiver valor fraco.\n\n"
                "## Por que é explorável\n"
                "Se alguém rodar `pnpm db:seed:prod` sem env definida, surge conta "
                "ADMIN com senha `admin123`. Senhas de demo viram credenciais "
                "reais se seed rodar em prod acidentalmente.\n\n"
                "## Evidência\n"
                "`prisma/seed.ts:25, 79, 103, 127, 150, 228, 283`\n\n"
                "## Impacto\n"
                "Credenciais default em prod. Catálogo de senhas triviais.\n\n"
                "## Sugestão de correção\n"
                "1. Remover fallback `?? 'admin123'` — falhar com erro se env "
                "não definida.\n"
                "2. Aceitar `DEMO_SEED_ALLOWED=true` em dev para criar usuários de "
                "demo; em prod, rejeitar a operação.\n"
                "3. Mover contas de demo para `prisma/seed-demo.ts` separado.\n\n"
                "## Critérios de aceite\n"
                "- [ ] Falhar loud se `ADMIN_PASSWORD` não setada\n"
                "- [ ] Contas de demo isoladas em script opcional\n"
                "- [ ] `db:seed` em prod exige flag explícita"
            ),
        ),
    },
    {
        "num": 8,
        "title": "[Segurança] Hardening de fallback de SESSION_SECRET e HMAC do storage local",
        "labels": "security, medium",
        "body": issue_block(
            8,
            "[Segurança] Hardening de fallback de SESSION_SECRET e HMAC do storage local",
            (
                "**Labels:** `security`, `medium`\n\n"
                "## Problema\n"
                "Duas constantes hardcoded servem de fallback para `SESSION_SECRET`:\n"
                "- `session.server.ts:37`: `secrets: [process.env.SESSION_SECRET "
                "?? 'dev-only-not-secret']`\n"
                "- `local-signed-url.server.ts:22`: `return 'dev-insecure-secret-"
                "change-me'`\n\n"
                "Os checks em produção rejeitam env vazia, MAS qualquer NODE_ENV "
                "diferente de `production` aceita o fallback. Atacante que conhece o "
                "repo pode forjar cookies de sessão E signed URLs do storage local "
                "contra qualquer instância em `NODE_ENV=staging`, `NODE_ENV=test` "
                "ou sem `NODE_ENV` definido.\n\n"
                "## Evidência\n"
                "- `app/lib/session.server.ts:37`\n"
                "- `app/lib/storage/local-signed-url.server.ts:22`\n\n"
                "## Impacto\n"
                "Forjamento de cookies e signed URLs se NODE_ENV ≠ production.\n\n"
                "## Sugestão de correção\n"
                "1. Throw explícito se SESSION_SECRET ausente em QUALQUER NODE_ENV "
                "(não só production).\n"
                "2. Mesmo para o HMAC do storage local.\n"
                "3. Para dev local, documentar no README: `openssl rand -hex 32 "
                "> .env.development`.\n\n"
                "## Critérios de aceite\n"
                "- [ ] Throw explícito se SESSION_SECRET ausente\n"
                "- [ ] Throw explícito se HMAC secret ausente\n"
                "- [ ] Teste: `delete process.env.SESSION_SECRET` → app não "
                "inicia"
            ),
        ),
    },
    {
        "num": 9,
        "title": "[Segurança] Endurecer logger de erros e adicionar lib de sanitização HTML",
        "labels": "security, low",
        "body": issue_block(
            9,
            "[Segurança] Endurecer logger de erros e adicionar lib de sanitização HTML",
            (
                "**Labels:** `security`, `low`\n\n"
                "## Problema\n"
                "1. `app/routes/api/uploads.ts:174` loga `errorDetails` completo "
                "(incluindo bucket, endpoint, key do S3) via `console.error`. Em "
                "produção o response NÃO vaza, mas o log persiste.\n"
                "2. Não há nenhuma lib de sanitização HTML no projeto "
                "(`dompurify`, `sanitize-html`). A única defesa XSS atual é o "
                "auto-escape do React + 1 escape manual em `membros.$id.tsx:249-274`.\n\n"
                "## Por que é explorável\n"
                "1. Logs vazam infra interna via Docker logs / SIEM.\n"
                "2. Renderizadores Markdown/HTML futuros adicionam risco XSS.\n\n"
                "## Evidência\n"
                "- `app/routes/api/uploads.ts:174`\n"
                "- `grep -rn 'dompurify\\|sanitize-html' app/` retorna 0 hits\n\n"
                "## Impacto\n"
                "Vazamento de infra via logs. Risco XSS futuro.\n\n"
                "## Sugestão de correção\n"
                "1. Logar apenas `error.message` + correlation ID; manter detalhes "
                "em `Upload.rejectionDetails` (já persiste).\n"
                "2. Adicionar `dompurify` + `@types/dompurify`.\n"
                "3. Criar wrapper `safeHtml(input)` e aplicar em todos os pontos "
                "atuais e futuros.\n\n"
                "## Critérios de aceite\n"
                "- [ ] Logs de produção não contêm bucket/endpoint/key\n"
                "- [ ] Wrapper `safeHtml` usado em >= 1 ponto\n"
                "- [ ] Teste com 5+ payloads XSS cobrindo o wrapper"
            ),
        ),
    },
]


# ──────────────────────────────────────────────────────────────────────────────
# GRÁFICOS
# ──────────────────────────────────────────────────────────────────────────────


def make_donut_severity():
    counts = {"critica": 0, "alta": 0, "media": 0, "baixa": 0}
    for a in ACHADOS:
        counts[a["sev"]] += 1

    labels_map = {
        "critica": f"Crítica ({counts['critica']})",
        "alta": f"Alta ({counts['alta']})",
        "media": f"Média ({counts['media']})",
        "baixa": f"Baixa ({counts['baixa']})",
    }
    colors_map = {
        "critica": "#B91C1C",
        "alta": "#EA580C",
        "media": "#D97706",
        "baixa": "#2563EB",
    }

    items = [
        (k, counts[k]) for k in ["critica", "alta", "media", "baixa"] if counts[k] > 0
    ]

    fig, ax = plt.subplots(figsize=(5.4, 4.2), dpi=160)
    if not items:
        ax.text(0.5, 0.5, "Sem achados", ha="center", va="center", fontsize=14)
        ax.axis("off")
    else:
        sizes = [v for _, v in items]
        keys = [k for k, _ in items]
        c = [colors_map[k] for k in keys]
        lbls = [labels_map[k] for k in keys]

        wedges, texts, autotexts = ax.pie(
            sizes,
            labels=lbls,
            colors=c,
            autopct="%1.0f%%",
            startangle=90,
            wedgeprops={"width": 0.42, "edgecolor": "white", "linewidth": 2},
            pctdistance=0.78,
            textprops={"fontsize": 10},
        )
        for at in autotexts:
            at.set_color("white")
            at.set_fontweight("bold")
            at.set_fontsize(10)
        ax.text(
            0,
            0,
            f"{sum(sizes)}\nTOTAL",
            ha="center",
            va="center",
            fontsize=14,
            fontweight="bold",
            color="#0F172A",
        )
    ax.set_title(
        "Distribuição por Severidade",
        fontsize=12,
        fontweight="bold",
        color="#0F172A",
        pad=12,
    )
    plt.tight_layout()
    out = CHARTS_DIR / "donut_severity.png"
    plt.savefig(out, bbox_inches="tight", facecolor="white")
    plt.close()
    return out


def make_bar_category():
    cats = {}
    for a in ACHADOS:
        c = a["categoria"]
        cats.setdefault(c, {"critica": 0, "alta": 0, "media": 0, "baixa": 0})
        cats[c][a["sev"]] += 1

    labels_map = {
        "C1": "C1\nIsolamento",
        "C2": "C2\nPerm. UI",
        "C3": "C3\nIDOR",
        "C4": "C4\nSegredos",
        "C5": "C5\nXSS",
    }
    sev_order = ["critica", "alta", "media", "baixa"]
    sev_color = {
        "critica": "#B91C1C",
        "alta": "#EA580C",
        "media": "#D97706",
        "baixa": "#2563EB",
    }

    cat_keys = ["C1", "C2", "C3", "C4", "C5"]
    x = list(range(len(cat_keys)))
    width = 0.2

    fig, ax = plt.subplots(figsize=(7.6, 4.2), dpi=160)
    for i, sev in enumerate(sev_order):
        values = [cats.get(c, {}).get(sev, 0) for c in cat_keys]
        offsets = [xi + (i - 1.5) * width for xi in x]
        bars = ax.bar(
            offsets,
            values,
            width,
            label=sev.capitalize(),
            color=sev_color[sev],
            edgecolor="white",
            linewidth=1.2,
        )
        for bar, v in zip(bars, values):
            if v > 0:
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    v + 0.05,
                    str(v),
                    ha="center",
                    va="bottom",
                    fontsize=9,
                    fontweight="bold",
                    color=sev_color[sev],
                )

    ax.set_xticks(x)
    ax.set_xticklabels([labels_map[c] for c in cat_keys], fontsize=10)
    ax.set_ylabel("Nº de achados", fontsize=10)
    ax.set_title(
        "Achados por Categoria × Severidade",
        fontsize=12,
        fontweight="bold",
        color="#0F172A",
        pad=12,
    )
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#94A3B8")
    ax.spines["bottom"].set_color("#94A3B8")
    ax.tick_params(axis="both", colors="#475569")
    ax.grid(axis="y", alpha=0.25, linestyle="--", linewidth=0.6)
    ax.set_axisbelow(True)
    ax.legend(loc="upper right", frameon=False, fontsize=9)
    ax.set_ylim(0, max(6, max(sum(cats.get(c, {}).values()) for c in cat_keys) + 1))

    plt.tight_layout()
    out = CHARTS_DIR / "bar_category.png"
    plt.savefig(out, bbox_inches="tight", facecolor="white")
    plt.close()
    return out


# ──────────────────────────────────────────────────────────────────────────────
# ESTILOS / PDF
# ──────────────────────────────────────────────────────────────────────────────


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontSize=28,
            leading=34,
            alignment=TA_CENTER,
            textColor=PALETTE["primary"],
            spaceAfter=20,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSubtitle",
            parent=styles["Normal"],
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            textColor=PALETTE["muted"],
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            textColor=PALETTE["primary"],
            spaceBefore=4,
            spaceAfter=10,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=PALETTE["primary"],
            spaceBefore=14,
            spaceAfter=6,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            name="H3",
            parent=styles["Heading3"],
            fontSize=11,
            leading=14,
            textColor=PALETTE["primary"],
            spaceBefore=8,
            spaceAfter=4,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontSize=10,
            leading=14,
            textColor=PALETTE["primary"],
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyBullet",
            parent=styles["Body"],
            leftIndent=14,
            bulletIndent=2,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Mono",
            parent=styles["Code"],
            fontSize=8,
            leading=10,
            fontName="Courier",
            textColor=PALETTE["primary"],
            backColor=PALETTE["bg_alt"],
            borderColor=PALETTE["border"],
            borderWidth=0.5,
            borderPadding=6,
            leftIndent=0,
            rightIndent=0,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChipCritical",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            backColor=PALETTE["critica"],
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChipHigh",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            backColor=PALETTE["alta"],
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChipMedium",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            backColor=PALETTE["media"],
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChipLow",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            backColor=PALETTE["baixa"],
        )
    )
    styles.add(
        ParagraphStyle(
            name="ChipStrong",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName="Helvetica-Bold",
            backColor=PALETTE["forte"],
        )
    )
    styles.add(
        ParagraphStyle(
            name="IssueBody",
            parent=styles["Code"],
            fontSize=7.5,
            leading=10,
            fontName="Courier",
            textColor=PALETTE["primary"],
            leftIndent=0,
            rightIndent=0,
            spaceAfter=10,
            spaceBefore=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Note",
            parent=styles["Body"],
            fontSize=9,
            leading=12,
            textColor=PALETTE["muted"],
        )
    )
    return styles


def chip_for(sev, label, styles):
    name = {
        "critica": "ChipCritical",
        "alta": "ChipHigh",
        "media": "ChipMedium",
        "baixa": "ChipLow",
    }[sev]
    return Paragraph(f"&nbsp;{label}&nbsp;", styles[name])


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(PALETTE["border"])
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.4 * cm, A4[0] - 2 * cm, A4[1] - 1.4 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(PALETTE["muted"])
    canvas.drawString(
        2 * cm,
        A4[1] - 1.1 * cm,
        "Relatório de Auditoria de Segurança — Igreja Conect",
    )
    canvas.drawRightString(
        A4[0] - 2 * cm,
        A4[1] - 1.1 * cm,
        f"p. {doc.page}",
    )

    canvas.line(2 * cm, 1.4 * cm, A4[0] - 2 * cm, 1.4 * cm)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(
        2 * cm,
        1.0 * cm,
        "Confidencial · Uso interno · 28/08/2026",
    )
    canvas.drawRightString(
        A4[0] - 2 * cm,
        1.0 * cm,
        "Auditoria: 5 categorias · 18 achados · 17 pontos fortes",
    )
    canvas.restoreState()


def build_pdf():
    styles = make_styles()

    chart_donut = make_donut_severity()
    chart_bar = make_bar_category()

    doc = BaseDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Relatório de Auditoria de Segurança — Igreja Conect",
        author="Auditoria interna",
        subject="Auditoria estática de segurança",
    )
    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
        id="normal",
    )
    template = PageTemplate(id="default", frames=[frame], onPage=header_footer)
    doc.addPageTemplates([template])

    story = []

    # CAPA
    story.append(Spacer(1, 2.6 * cm))
    story.append(
        Paragraph(
            "<font color='#0F172A'>Relatório de Auditoria<br/>de Segurança</font>",
            ParagraphStyle(
                name="CoverBig",
                parent=styles["CoverTitle"],
                fontSize=34,
                leading=40,
                alignment=TA_CENTER,
                textColor=PALETTE["primary"],
            ),
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        HRFlowable(
            width="50%",
            thickness=2,
            color=PALETTE["primary"],
            hAlign="CENTER",
            spaceBefore=4,
            spaceAfter=14,
        )
    )
    story.append(
        Paragraph(
            "<b>Igreja Conect</b><br/>"
            "<font size=11 color='#64748B'>Sistema de gestão eclesiástica · RR7 SSR + "
            "Prisma 7 + SQLite</font>",
            styles["CoverSubtitle"],
        )
    )
    story.append(Spacer(1, 2.4 * cm))

    meta = [
        ["Data", "28/08/2026"],
        ["Escopo", "Auditoria estática (código-fonte, configs, git log)"],
        [
            "Categorias auditadas",
            "C1 Isolamento · C2 Perm. UI · C3 IDOR · C4 Segredos · C5 XSS",
        ],
        [
            "Stack",
            "Node 24 · React 19 · React Router 7.16 · Prisma 7.8 · "
            "SQLite · Tailwind v4",
        ],
        ["Perfil", "Strict (TDD obrigatório, RBAC em 3 camadas)"],
        [
            "Achados",
            f"{len(ACHADOS)} ({sum(1 for a in ACHADOS if a['sev'] == 'critica')} "
            f"críticos · {sum(1 for a in ACHADOS if a['sev'] == 'alta')} altos · "
            f"{sum(1 for a in ACHADOS if a['sev'] == 'media')} médios · "
            f"{sum(1 for a in ACHADOS if a['sev'] == 'baixa')} baixos)",
        ],
    ]
    meta_table = Table(meta, colWidths=[5.0 * cm, 11.0 * cm])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), PALETTE["bg_alt"]),
                ("TEXTCOLOR", (0, 0), (0, -1), PALETTE["primary"]),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BOX", (0, 0), (-1, -1), 0.5, PALETTE["border"]),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, PALETTE["border"]),
            ]
        )
    )
    story.append(meta_table)

    story.append(Spacer(1, 2 * cm))
    story.append(
        HRFlowable(
            width="100%",
            thickness=0.5,
            color=PALETTE["border"],
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    story.append(
        Paragraph(
            "<b>Nota metodológica</b> — Cada uma das 5 categorias foi adaptada ao "
            "equivalente da stack detectada: (1) <i>Banco sem tranca</i> foi mapeado "
            "para o isolamento de escopo via `where` no Prisma (já que não há RLS "
            "no SQLite e a arquitetura é single-tenant sem políticas de "
            "tenant_id); (2) <i>Permissão no navegador</i> cruza cada gate de UI "
            '(`<Can>`, `user.cargo === "ADMIN"`) com o gate backend equivalente '
            "(`assertCan*`, `getMembroById`); (3) <i>IDOR</i> percorreu "
            "sistematicamente todos os handlers de rota com `:id` no path "
            "(loaders + actions); (4) <i>Chaves expostas</i> cobreu `.env`, "
            "`.env.development`, `.env.example`, `prisma/seed.ts`, fallbacks em "
            "`session.server.ts`/`local-signed-url.server.ts`, logs de erro e "
            "git log; (5) <i>XSS</i> revisou `dangerouslySetInnerHTML`, `eval`, "
            "`innerHTML`, renderização de Markdown/HTML e URLs controladas por "
            "usuário.",
            styles["Note"],
        )
    )

    story.append(PageBreak())

    # RESUMO EXECUTIVO
    story.append(Paragraph("1 · Resumo Executivo", styles["H1"]))
    story.append(Spacer(1, 0.2 * cm))

    total = len(ACHADOS)
    sev_count = {
        "critica": sum(1 for a in ACHADOS if a["sev"] == "critica"),
        "alta": sum(1 for a in ACHADOS if a["sev"] == "alta"),
        "media": sum(1 for a in ACHADOS if a["sev"] == "media"),
        "baixa": sum(1 for a in ACHADOS if a["sev"] == "baixa"),
    }

    sev_table_data = [
        ["Severidade", "Total", "Tratamento sugerido"],
        [
            "Crítica",
            str(sev_count["critica"]),
            "Bloqueio imediato · sprint corretiva dedicada",
        ],
        ["Alta", str(sev_count["alta"]), "Sprint prioritária (P1)"],
        ["Média", str(sev_count["media"]), "Backlog curto (P2)"],
        ["Baixa", str(sev_count["baixa"]), "Backlog (P3)"],
        ["TOTAL", str(total), "—"],
    ]
    sev_colors = ["critica", "alta", "media", "baixa"]
    sev_row_styles = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), PALETTE["primary"]),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LINEBELOW", (0, 0), (-1, -2), 0.25, PALETTE["border"]),
            ("BOX", (0, 0), (-1, -1), 0.5, PALETTE["border"]),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), PALETTE["bg_alt"]),
        ]
    )
    for i, sev_key in enumerate(sev_colors, start=1):
        sev_row_styles.add("BACKGROUND", (0, i), (0, i), PALETTE[sev_key])
        sev_row_styles.add("TEXTCOLOR", (0, i), (0, i), colors.white)
        sev_row_styles.add("FONTNAME", (0, i), (0, i), "Helvetica-Bold")

    sev_table = Table(sev_table_data, colWidths=[3.2 * cm, 1.6 * cm, 12.2 * cm])
    sev_table.setStyle(sev_row_styles)
    story.append(sev_table)
    story.append(Spacer(1, 0.4 * cm))

    chart_table = Table(
        [
            [
                Image(str(chart_donut), width=8.5 * cm, height=6.4 * cm),
                Image(str(chart_bar), width=8.5 * cm, height=6.4 * cm),
            ]
        ],
        colWidths=[8.7 * cm, 8.7 * cm],
    )
    chart_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(chart_table)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("Visão geral", styles["H2"]))
    summary_paragraphs = [
        (
            f"A auditoria cobriu as 5 categorias adaptadas à stack (RR7 + Prisma + "
            f"SQLite + Tailwind + S3-compat). Foram identificados "
            f"<b>{total} achados</b> — sendo <b>{sev_count['critica']} críticos</b>, "
            f"<b>{sev_count['alta']} altos</b>, <b>{sev_count['media']} médios</b> e "
            f"<b>{sev_count['baixa']} baixos</b> — além de <b>{len(PONTOS_FORTES)} "
            "pontos fortes</b> verificados."
        ),
        (
            "Os <b>3 achados críticos</b> formam um cluster de Account Takeover + "
            "comprometimento de segredo de sessão: (1) o fluxo de reset de senha não "
            "tem prova de posse e aceita qualquer nome com 2+ letras contidas no "
            "real (F-03); (2) o `SESSION_SECRET` de produção está commitado no "
            "git via `.env.development` (F-09), permitindo forjar cookies válidos; "
            "(3) `.env` traz `ADMIN_PASSWORD=senha123` e chaves S3 reais (F-10)."
        ),
        (
            "Em <b>C1 (isolamento)</b>, a descoberta mais relevante é o vazamento de "
            "KPIs globais para DISCIPULADOR/LIDER_MINISTERIO em "
            "`membros._index.tsx` (F-01) — quebra a promessa de '404 não vaza "
            "existência' do RAG de RBAC."
        ),
        (
            "Em <b>C2 (permissão no navegador)</b>, além do reset de senha, o "
            "endpoint de login aceita o IP do cliente via campo `clientIP` no body "
            "(F-04) — bypass de rate-limit trivial."
        ),
        (
            "Em <b>C4 (segredos)</b>, além dos 2 críticos, há fallback hardcoded de "
            "`SESSION_SECRET` em `session.server.ts` e de HMAC em "
            "`local-signed-url.server.ts` (F-13) e senhas de demo no "
            "`prisma/seed.ts` (F-11)."
        ),
        (
            "<b>C3 (IDOR)</b> e <b>C5 (XSS)</b> estão majoritariamente OK. As "
            "rotas autenticadas aplicam `getMembroById` (que lança 404 para "
            "DISCIPULADOR fora de escopo) e SECRETARIO é filtrado para DIZIMO. "
            "O único `dangerouslySetInnerHTML` está corretamente sanitizado antes "
            "do `__html` (F-16)."
        ),
    ]
    for p in summary_paragraphs:
        story.append(Paragraph(escape_non_html_tags(p), styles["Body"]))

    story.append(PageBreak())

    # PONTOS FORTES
    story.append(Paragraph("2 · Pontos Fortes Verificados", styles["H1"]))
    story.append(
        Paragraph(
            "Evidências concretas de que controles de segurança funcionam como "
            "esperado. Cada item aponta para o arquivo e a faixa de linhas que "
            "demonstram a prática.",
            styles["Note"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    for pf in PONTOS_FORTES:
        chip = Paragraph(
            "&nbsp;PONTO FORTE&nbsp;",
            ParagraphStyle(
                name="ChipStrongInTable",
                parent=styles["ChipStrong"],
                alignment=TA_CENTER,
            ),
        )
        header = Table(
            [[chip, Paragraph(f"<b>{pf['titulo']}</b>", styles["Body"])]],
            colWidths=[2.6 * cm, 14.4 * cm],
        )
        header.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), PALETTE["forte"]),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )
        story.append(header)
        story.append(
            Paragraph(
                f"<b>Evidência:</b> <font face='Courier'>{escape_non_html_tags(pf['evidencia'])}</font>",
                styles["Body"],
            )
        )
        story.append(Paragraph(escape_non_html_tags(pf["detalhe"]), styles["Body"]))
        story.append(Spacer(1, 0.15 * cm))

    story.append(PageBreak())

    # PONTOS FRACOS
    story.append(Paragraph("3 · Pontos Fracos Centrais", styles["H1"]))
    story.append(
        Paragraph(
            "Síntese executiva dos riscos críticos e altos que devem endereçar a "
            "sprint corretiva antes de qualquer deploy público adicional.",
            styles["Note"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    pontos_fracos = [
        {
            "titulo": "Account Takeover via reset de senha",
            "lista": [
                "F-03 — verificação trivial (`String.includes` com min 2 chars)",
                "F-09 — SESSION_SECRET commitado no git (permite forjar sessões)",
                "Risco combinado: comprometimento de qualquer conta, inclusive ADMIN",
            ],
        },
        {
            "titulo": "Credenciais expostas em arquivos não-protegidos",
            "lista": [
                "F-10 — `.env` com `senha123` + chaves S3 reais no filesystem dev",
                "F-11 — seed com fallback `admin123` e 5 senhas de demo commitadas",
                "F-12 — TLS `rejectUnauthorized=false` (MITM)",
                "F-13 — fallbacks hardcoded para SESSION_SECRET e HMAC",
            ],
        },
        {
            "titulo": "Vazamento de métricas + bypass de rate-limit",
            "lista": [
                "F-01 — KPIs globais para DISCIPULADOR/LIDER_MINISTERIO",
                "F-04 — `clientIP` no body permite bypass de rate-limit",
                "F-05 — loader de ministério sem RBAC",
            ],
        },
    ]
    for pf in pontos_fracos:
        story.append(Paragraph(f"• {pf['titulo']}", styles["H3"]))
        for item in pf["lista"]:
            story.append(Paragraph(f"  – {item}", styles["Body"]))
        story.append(Spacer(1, 0.2 * cm))

    story.append(PageBreak())

    # ACHADOS DETALHADOS
    story.append(Paragraph("4 · Achados Detalhados por Categoria", styles["H1"]))
    story.append(
        Paragraph(
            f"Lista completa dos {total} achados. Cada entrada traz severidade (chip "
            "colorido conforme paleta), arquivo:linha, descrição, por que é explorável, "
            "impacto, sugestão de correção e critérios de aceite.",
            styles["Note"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    cat_titles = {
        "C1": "Categoria 1 — Banco sem tranca (isolamento de escopo no `where` Prisma)",
        "C2": "Categoria 2 — Permissão só no navegador (UI sem backend gate)",
        "C3": "Categoria 3 — IDOR (acesso a objeto por ID sem checagem de posse/escopo)",
        "C4": "Categoria 4 — Chaves expostas (hardcoded/em env/commited/logs)",
        "C5": "Categoria 5 — XSS / input não tratado",
    }
    grouped = {}
    for a in ACHADOS:
        grouped.setdefault(a["categoria"], []).append(a)

    for cat_key in ["C1", "C2", "C3", "C4", "C5"]:
        story.append(Paragraph(cat_titles[cat_key], styles["H2"]))
        for a in grouped[cat_key]:
            chip = chip_for(a["sev"], a["sev_label"], styles)
            header = Table(
                [
                    [
                        chip,
                        Paragraph(
                            f"<b>{a['id']}</b> · {escape_non_html_tags(a['titulo'])}",
                            styles["Body"],
                        ),
                    ]
                ],
                colWidths=[2.6 * cm, 14.4 * cm],
            )
            header.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(header)

            meta = Paragraph(
                f"<b>Arquivo:</b> <font face='Courier'>{escape_non_html_tags(a['arquivo'])}</font> · "
                f"<b>Linhas:</b> <font face='Courier'>{escape_non_html_tags(a['linhas'])}</font>",
                styles["Body"],
            )
            story.append(meta)
            story.append(Paragraph("<b>Trecho:</b>", styles["H3"]))
            story.append(Preformatted(a["trecho"], styles["Mono"], maxLineLength=110))
            story.append(Paragraph("<b>Por que é explorável:</b>", styles["H3"]))
            story.append(Paragraph(escape_non_html_tags(a["por_que"]), styles["Body"]))
            story.append(Paragraph("<b>Impacto:</b>", styles["H3"]))
            story.append(Paragraph(escape_non_html_tags(a["impacto"]), styles["Body"]))
            story.append(Paragraph("<b>Sugestão de correção:</b>", styles["H3"]))
            story.append(Paragraph(escape_non_html_tags(a["sugestao"]), styles["Body"]))
            if a["aceite"]:
                story.append(Paragraph("<b>Critérios de aceite:</b>", styles["H3"]))
                for ac in a["aceite"]:
                    story.append(Paragraph(f"  – {ac}", styles["Body"]))
            story.append(Spacer(1, 0.3 * cm))
        story.append(PageBreak())

    # RECOMENDAÇÕES PRIORIZADAS
    story.append(Paragraph("5 · Recomendações Priorizadas", styles["H1"]))
    story.append(
        Paragraph(
            "Ordem de execução sugerida. P1 = tratar antes de qualquer deploy público "
            "adicional; P2 = sprint corretiva dedicada; P3 = backlog normal.",
            styles["Note"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    recs = [
        (
            "P1",
            "critica",
            [
                "F-03 — Substituir fluxo de reset de senha por token de uso único (30min) com envio por e-mail; invalidar sessões após troca.",
                "F-09 — Rotacionar SESSION_SECRET em produção IMEDIATAMENTE; remover `.env.development` do git history; invalidar sessões ativas.",
                "F-10 — Trocar `ADMIN_PASSWORD=senha123` por valor aleatório; rotacionar chaves S3; setar `STORAGE_TLS_REJECT_UNAUTHORIZED=true` em prod.",
            ],
        ),
        (
            "P1",
            "alta",
            [
                "F-04 — Remover leitura de `clientIP` do body do form de login; usar apenas headers do proxy.",
                "F-11 — Remover fallback `admin123` do seed; isolar contas de demo em script opcional; exigir `DEMO_SEED_ALLOWED=true` em prod.",
            ],
        ),
        (
            "P2",
            "alta",
            [
                "F-01 — Replicar escopo de `listMembros` nas queries de KPI em `membros._index.tsx`.",
                "F-05 — Adicionar `assertCanManageMinisterios` no loader de `ministerios.$id.tsx`.",
            ],
        ),
        (
            "P2",
            "media",
            [
                "F-13 — Substituir fallbacks hardcoded por throws explícitos em qualquer NODE_ENV.",
            ],
        ),
        (
            "P3",
            "baixa",
            [
                "F-02 — Decidir se `/api/search` deve escopar por cargo (documentar decisão).",
                "F-14 — Limpar placeholders com prefixo real em `.env.example`.",
                "F-15 — Não logar errorDetails completo em produção.",
                "F-16 — Adicionar testes com payloads XSS para `renderConvitePreview`.",
                "F-17 — Adicionar `dompurify` e wrapper `safeHtml` para uso futuro.",
                "F-18 — Sanitizar strings antes de logar (CRLF + ANSI).",
            ],
        ),
    ]

    rec_table_data = [["Prioridade", "Sev", "Ações"]]
    for prio, sev, items in recs:
        cell_sev = chip_for(sev, sev.capitalize(), styles)
        actions_text = "<br/>".join(f"• {x}" for x in items)
        rec_table_data.append(
            [
                Paragraph(f"<b>{prio}</b>", styles["Body"]),
                cell_sev,
                Paragraph(actions_text, styles["Body"]),
            ]
        )

    rec_table = Table(
        rec_table_data,
        colWidths=[1.6 * cm, 1.8 * cm, 13.6 * cm],
    )
    rec_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALETTE["primary"]),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BOX", (0, 0), (-1, -1), 0.5, PALETTE["border"]),
                ("LINEBELOW", (0, 0), (-1, -1), 0.25, PALETTE["border"]),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ]
        )
    )
    story.append(rec_table)

    story.append(PageBreak())

    # ISSUES GITHUB
    story.append(Paragraph("6 · Issues para o GitHub", styles["H1"]))
    story.append(
        Paragraph(
            f"{len(GITHUB_ISSUES)} issues prontas para copiar e colar. Cada bloco está "
            "delimitado por <font face='Courier'>--- ISSUE n ---</font> e "
            "<font face='Courier'>--- FIM ISSUE n ---</font>, em Markdown, com labels, "
            "evidência arquivo:linha, sugestão e critérios de aceite verificáveis.",
            styles["Note"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))

    for issue in GITHUB_ISSUES:
        header = Table(
            [
                [
                    Paragraph(f"<b>ISSUE #{issue['num']}</b>", styles["Body"]),
                    Paragraph(
                        f"<b>Labels:</b> <font face='Courier'>{issue['labels']}</font>",
                        styles["Body"],
                    ),
                ]
            ],
            colWidths=[2.0 * cm, 15.0 * cm],
        )
        header.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), PALETTE["primary"]),
                    ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(header)

        body = issue["body"]
        story.append(Preformatted(body, styles["IssueBody"], maxLineLength=110))
        story.append(Spacer(1, 0.3 * cm))

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    print(f"OK -> {OUT_PDF}")
    print(f"Charts: {CHARTS_DIR}/")
