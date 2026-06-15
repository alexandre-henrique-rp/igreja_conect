---
title: LGPD — Aplicação no Igreja Conect (Lei 13.709/2018)
category: law
applies_to:
  - prisma/schema.prisma (model Membro, Lancamento)
  - app/lib/auth.server.ts
  - app/lib/session.server.ts
  - app/lib/audit.server.ts
  - app/lib/rbac.server.ts
  - app/routes/**
created: 2026-06-12
updated: 2026-06-12
version: 1.0
status: approved
priority: critical
sources:
  - Lei 13.709/2018 (LGPD) — texto integral em ~/.config/opencode/training/lgpd-brasil.md
  - brief.md §5.2 (Compliance e privacidade)
  - docs/REGRAS_DE_NEGOCIO.md (RN-MEM-02, RN-MEM-03)
tags: [lgpd, gdpr, privacy, security, law, consent, data-minimization]
owner: rag-curator
---

## 1. Contexto

A Igreja Conect é uma **igreja local brasileira** que trata dados pessoais de membros, visitantes, e dízimos. Está plenamente sujeita à **Lei 13.709/2018 (LGPD)**, em especial aos princípios de:

- **Necessidade** (art. 6°, III) — tratar apenas dados estritamente necessários.
- **Adequação** (art. 6°, II) — tratamento compatível com a finalidade declarada.
- **Segurança** (art. 6°, VII) — medidas técnicas para proteger os dados.
- **Prevenção** (art. 6°, VIII) — adotar medidas para evitar danos.
- **Não discriminação** (art. 6°, IX) — não tratar dados para fins discriminatórios.

A Igreja trata **dado pessoal sensível** (art. 5°, II) ao armazenar histórico de dízimos, que revela convicção religiosa e capacidade financeira. Por isso, o sistema precisa de garantias técnicas verificáveis, não apenas promessas.

> **Referência canônica (NÃO duplicar a lei):** a base legal completa está em `~/.config/opencode/training/lgpd-brasil.md`. Este RAG é o **filtro de aplicação ao projeto** — o que da LGPD se aplica aqui, e como.

## 2. Decisão / Regra

**A Igreja Conect aplica 6 decisões técnicas inegociáveis para conformidade LGPD no MVP:**

### 2.1 Sem CPF, sem dados fiscais (RN-MEM-02)

- O schema Prisma **não tem** campo `cpf`, `cnpj`, `rg`, `tituloEleitor`, `pis`, `cartaoSus` em `Membro`.
- Apenas: nome, contato (email, telefone), endereço residencial, dados eclesiásticos (dataConversao, dataBatismo), e opcionais `profissao` / `estadoCivil`.
- **Base legal:** **necessidade + adequação** (art. 6°, II e III). A igreja não tem finalidade legítima para CPF — não emite nota fiscal, não faz desconto em folha, não precisa para reconciliação bancária (RN-FIN-01: caixas internos).
- **Teste que prova:** grep no schema `rg:\|cpf:\|cnpj:\|pis:` → 0 resultados. Incluir no CI.

### 2.2 Dízimos restritos a ADMIN, PASTOR, FINANCEIRO (RN-MEM-03)

- Model `Lancamento` com `categoria = DIZIMO` e `membroId` preenchido: leitura restrita.
- Bloqueio em **3 camadas** (ver `security-rbac-matrix.md`).
- **Base legal:** **segurança + prevenção** (art. 6°, VII e VIII) + **princípio da finalidade** — só quem tem função pastoral/tesouraria precisa ver.
- **Teste que prova:** SECRETARIO, DISCIPULADOR, LIDER_MINISTERIO autenticados → 403 ao acessar `/app/membros/<id>?tab=financeiro` (Playwright E2E).

### 2.3 Senha exclusivamente como hash bcrypt

- `Membro.senhaHash: String?` (nulo se membro sem acesso ao sistema).
- Algoritmo: **bcrypt** com cost ≥ 10 (recomendação OWASP).
- Plano: usar `bcryptjs` (compatível com SSR do React Router 7) em `app/lib/auth.server.ts`.
- Senha **nunca** armazenada em plain text, log, payload de resposta, query string, cookie, ou localStorage.
- **Base legal:** **segurança** (art. 6°, VII) + **medidas técnicas adequadas** (art. 46).

### 2.4 Cookie de sessão com flags estritas

- Atributos obrigatórios do cookie de sessão: **`httpOnly: true`**, **`sameSite: "lax"`**, **`secure: process.env.NODE_ENV === "production"`**.
- TTL inicial sugerido: **7 dias** com sliding renewal (a confirmar em design).
- Sem JWT no client. Sem localStorage de token.
- **Base legal:** **segurança** (art. 46) — cookies sem `httpOnly` são vetor de XSS roubando sessão; sem `sameSite=lax` são vetor de CSRF.

### 2.5 Logs sem dado sensível nem hash

- `app/lib/audit.server.ts` registra: `userId`, `action`, `resource`, `timestamp`, `ip`, `result` (ok/forbidden).
- **Proibido** logar: senha (mesmo hasheada), `Membro.email`, `Membro.telefone`, `Membro.endereço`, `Lancamento.valorCentavos` (é dado financeiro).
- Helper `safeLog(payload)` aplica allowlist antes de gravar.
- **Base legal:** **necessidade + segurança** (art. 6°, III e VII). Logar hash vazaria indiretamente; log de email vazaria PII.

### 2.6 Perfis × natureza do dado (visão consolidada)

| Perfil | Lê dado pessoal comum | Lê endereço | Lê contato | Lê dízimo (sensível) | Lê caixa/saldo |
|---|---|---|---|---|---|
| `ADMIN` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PASTOR` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `FINANCEIRO` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SECRETARIO` | ✅ | ✅ | ✅ | ❌ | ✅ |
| `DISCIPULADOR` | ✅ (seus discípulos) | ✅ (seus discípulos) | ✅ (seus discípulos) | ❌ | ❌ |
| `LIDER_MINISTERIO` | ✅ (seu min.) | ✅ (seu min.) | ✅ (seu min.) | ❌ | ❌ |

## 3. Consequências

- **Positivas:**
  - Superfície de ataque mínima: nada de dado sensível que não precise existir.
  - Em caso de incidente (vazamento do `dev.db` em dev), o que vaza é nome + email + telefone — não CPF, não dízimo (este último, restrito).
  - Auditoria clara: o `lgpd-officer` (v6.2.0+) audita a aplicação inteira contra este RAG em gate do phase 5.
- **Negativas:**
  - Não conseguimos emitir recibo com CPF (decisão consciente — igreja não emite NF).
  - Qualquer pedido futuro de integração com banco (ex: dízimo via Pix) **deve** ser revisado por este RAG: o gateway devolverá CPF do pagador, e o sistema precisa **não persistir** esse CPF.
- **Trade-offs aceitos:**
  - Audit log de leitura (art. 37 LGPD — "quem viu o quê") está **fora do MVP** (`brief.md §4`). Quando entrar, será outro RAG específico.

## 4. Exemplos

**Exemplo 1 — Schema Prisma reflete ausência de CPF:**

```prisma
// prisma/schema.prisma — model Membro (trecho real)
model Membro {
  id            String     @id @default(uuid())
  nome          String
  tipo          TipoMembro @default(VISITANTE)
  cargo         Cargo?
  email         String?    @unique
  senhaHash     String?    // hash bcrypt, nunca plain text
  telefone      String?
  profissao     String?    // opcional (RN-MEM-02)
  estadoCivil   String?    // opcional (RN-MEM-02)
  // ... NÃO existe campo cpf, rg, cnpj, tituloEleitor
  // ... NÃO existe campo salario, capacidadeFinanceira
}
```

**Exemplo 2 — Hash de senha em `app/lib/auth.server.ts` (padrão esperado):**

```ts
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

**Exemplo 3 — Cookie de sessão com flags estritas (padrão esperado em `app/lib/session.server.ts`):**

```ts
export const sessionCookie = createCookie("__session", {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 dias
});
```

**Exemplo 4 — Logger seguro (padrão esperado em `app/lib/audit.server.ts`):**

```ts
const ALLOWED_FIELDS = new Set(["userId", "action", "resource", "result", "timestamp"]);

export function safeLog(event: Record<string, unknown>) {
  const filtered = Object.fromEntries(
    Object.entries(event).filter(([k]) => ALLOWED_FIELDS.has(k))
  );
  console.log(JSON.stringify({ audit: filtered }));
}

// safeLog({ userId, action: "login_attempt", result: "ok" });            // ✅
// safeLog({ userId, action: "login", password: "..." });                  // ❌ filtrado
// safeLog({ userId, action: "view_member", email: membro.email });        // ❌ filtrado
```

## 5. Anti-exemplos

- ❌ **Adicionar campo `cpf` no `Membro` "porque é útil para identificar homônimos".** Viola RN-MEM-02 e art. 6°, III. Identificar homônimos é trabalho de `nome + dataNascimento` + busca textual.
- ❌ **Logar `senhaHash` "para debug".** Hash vaza em log e ainda é dado pseudônimo — facilita ataque offline por rainbow table se combinado com email vazado.
- ❌ **Cookie de sessão com `httpOnly: false` "para o front poder ler".** XSS rouba sessão. Sem justificativa aceitável.
- ❌ **Coletar `dataNascimento` e expor na ficha sem anonimizar parcialmente para `DISCIPULADOR` externo.** É PII, exige o mesmo cuidado de `email`.
- ❌ **Criar endpoint "exportar todos os membros em CSV" para "facilitar migração".** Export em massa de PII sem base legal específica é prática de art. 33–34 (transferência) e exige consentimento.
- ❌ **Persistir `Lancamento.cpfPagador` retornado por gateway de Pix futuro.** Gateway devolve; o sistema **não** deve armazenar (art. 6°, III — necessidade).

## 6. RAGs relacionados

- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — implementa §2.2 (dízimos restritos) e §2.6 (matriz por perfil).
- [`architecture-monolith-modular.md`](./architecture-monolith-modular.md) — o sufixo `.server.ts` em `auth.server.ts` e `audit.server.ts` é o que impede vazamento de hash/senha no bundle do cliente.
- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — o schema Prisma é a fonte de verdade do que é persistido; ausência de campo = ausência de coleta.

## 7. Notas de aplicação

- **Onde fica o texto legal completo:** `~/.config/opencode/training/lgpd-brasil.md`. Não duplicar; consultar ao questionar uma decisão nova.
- **Quando expandir o tratamento de dados** (ex: adicionar foto do membro, integração com WhatsApp), **atualizar este RAG primeiro** com a nova coleta, base legal, e prazo de retenção. A revisão é feita pelo `lgpd-officer` no gate do phase 5.
- **Retenção:** não há no MVP política de descarte automático de membros inativos. Decisão consciente: `brief.md §4` deixa "fora do escopo". Quando entrar, anexar uma seção §2.7 com: quanto tempo guardar PII de membro desligado, quando anonimizar, quando apagar.
- **Direitos do titular (art. 18):** MVP não implementa fluxo de "pedido de acesso/eliminação" pelo titular (brief §4). Quando entrar, criar endpoints `/app/privacidade/...` com rate limit e prova de identidade. Por enquanto, pedidos são atendidos manualmente pelo ADMIN.
- **Auditoria no CI:** incluir script `pnpm lgpd:check` que roda `grep -rE "cpf|rg|cnpj|tituloEleitor" prisma/ app/` e falha o build se encontrar.
- **Treinamento de dev:** antes do primeiro PR, ler este RAG + `~/.config/opencode/training/lgpd-brasil.md`. Sem exceção.
