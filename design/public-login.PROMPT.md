# Login — Frontend Implementation Prompt

## Capability grant (paths allowlist do agent)

- **Paths de escrita:**
  - `app/routes/public/login.tsx`
  - `app/components/FormLogin.tsx`
  - `app/components/Input.tsx`
  - `app/components/Checkbox.tsx`
  - `app/components/ErrorAlert.tsx`
  - `app/components/TopbarPublica.tsx` (estender, se necessário)
  - `app/lib/schemas/auth.ts` (Zod schema)
  - `app/lib/auth.server.ts` (verificar; se não existir, criar — depende do backend agent)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs (todos os 5), `prisma/schema.prisma`, `design/public-login.DESIGN.md`, `design/PRODUCT.md`.
- **Boundary:** não editar `lib/session.server.ts` (responsabilidade do backend agent). Não criar migrations. Não criar `<Dialog>` se não for usado 3+ vezes.

## Contexto

Página de autenticação do Igreja Conect. Único ponto de entrada para os 6 perfis administrativos. Acessível em `/login` por anônimos.

- **Design detalhado:** [`design/public-login.DESIGN.md`](./public-login.DESIGN.md)
- **PRD:** [`PRD.html`](../../PRD.html) §3.1 (Auth) — US-AUTH-001.
- **SPEC:** [`SPEC.html`](../../SPEC.html) §5 (Fluxo de autenticação) e §10 (endpoints).
- **AGENTS:** [`agents/AGENTS.md`](../../agents/AGENTS.md) — padrões de action, Zod, helpers de erro.
- **RAGs relevantes:**
  - [`security-rbac-matrix.md`](../../.harness/RAG/security-rbac-matrix.md) — fluxo de auth.
  - [`lgpd-igreja-conect.md`](../../.harness/RAG/lgpd-igreja-conect.md) §2.3, §2.4, §2.5 — senha hash, cookie flags, logger seguro.
  - [`architecture-monolith-modular.md`](../../.harness/RAG/architecture-monolith-modular.md) — fronteira routes/ → lib/.

## Tarefas

### T1. Criar schema Zod em `app/lib/schemas/auth.ts`

- **Path:** `app/lib/schemas/auth.ts`
- **Conteúdo:** exporta `LoginSchema` e tipo `LoginInput` (ver DESIGN §6.1).
- **Por quê primeiro:** o action e o componente precisam do mesmo schema. TDD-friendly.

### T2. Criar `<Input>` (componente base)

- **Path:** `app/components/Input.tsx`
- **Responsabilidade:** input de texto com label, hint, erro, ícone opcional, e suporte a toggle de visibilidade (senha).
- **Props:** `label: string`, `name: string`, `type?: "text" | "email" | "password" | "tel"`, `value?: string`, `defaultValue?: string`, `placeholder?: string`, `hint?: string`, `error?: string`, `required?: boolean`, `autoComplete?: string`, `inputMode?: "text" | "email" | "tel" | "numeric"`, `leadingIcon?: ReactNode`, `trailingIcon?: ReactNode`, `trailingAction?: ReactNode` (botão de ação), mais props HTML padrão.
- **Estrutura:**
  ```tsx
  <div className="space-y-1">
    <label htmlFor={id} className="text-sm font-medium text-slate-700">
      {label}{required && <span aria-hidden="true" className="text-red-700 ml-1">*</span>}
    </label>
    <div className="relative">
      {leadingIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leadingIcon}</span>}
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={hint || error ? `${id}-desc` : undefined}
        aria-required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={cn(
          "w-full h-11 px-3 rounded-md border bg-white text-slate-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2",
          error ? "border-red-700" : "border-slate-300",
          leadingIcon && "pl-10",
          trailingIcon && "pr-10",
        )}
        {...rest}
      />
      {trailingAction && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailingAction}</span>}
    </div>
    {hint && !error && <p id={`${id}-desc`} className="text-sm text-slate-500">{hint}</p>}
    {error && <p id={`${id}-desc`} role="alert" className="text-sm text-red-700">{error}</p>}
  </div>
  ```
- **Helper `cn()`:** pequeno utilitário para concatenar classes condicionalmente (5 linhas, sem `clsx` lib).
- **Ícones:** SVGs inline (olho, olho-off) com 24×24, `aria-hidden="true"`.

### T3. Criar `<Checkbox>`

- **Path:** `app/components/Checkbox.tsx`
- **Props:** `label: string`, `name: string`, `defaultChecked?: boolean`, `value?: string` (opcional).
- **Visual:** `<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-700" /><span className="text-sm text-slate-700">{label}</span></label>`.
- **Acessibilidade:** label associado (estrutura nativa).

### T4. Criar `<ErrorAlert>`

- **Path:** `app/components/ErrorAlert.tsx`
- **Props:** `message: string`, `title?: string`, `tone?: "error" | "warning" | "info"`.
- **Visual:** `<div role="alert" className="border border-red-200 bg-red-50 rounded-md p-3 flex gap-2"><svg className="h-5 w-5 text-red-700" aria-hidden="true">[ícone alerta]</svg><div><h3 className="text-sm font-medium text-red-900">{title || "Erro"}</h3><p className="text-sm text-red-800">{message}</p></div></div>`.

### T5. Criar `<FormLogin>` (componente da página)

- **Path:** `app/components/FormLogin.tsx`
- **Responsabilidade:** form completo de login.
- **Props:** `formError?: string`, `defaultEmail?: string`, `fieldErrors?: { email?: string[]; senha?: string[] }`, `motivo?: "expirado"`.
- **Estrutura:**
  - `<Form method="post" className="space-y-4" noValidate>` — `noValidate` desativa validação HTML5 nativa (queremos a do Zod).
  - Se `motivo === "expirado"`, mostra `<ErrorAlert tone="info" message="Sua sessão expirou. Faça login novamente." />`.
  - Se `formError`, mostra `<ErrorAlert message={formError} />`.
  - `<Input label="E-mail" name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} error={fieldErrors?.email?.[0]} inputMode="email" />`.
  - `<Input label="Senha" name="senha" type="password" required autoComplete="current-password" error={fieldErrors?.senha?.[0]} trailingAction={<ToggleVisibilidade for="senha" />} />` — onde `ToggleVisibilidade` é um pequeno sub-componente (client-side, usa `useState`).
  - `<Checkbox label="Manter-me conectado (30 dias)" name="manterConectado" value="true" />` — `manterConectado` é boolean via `z.coerce.boolean()`.
  - `<Button type="submit" variant="primary" fullWidth>Entrar</Button>` — `fullWidth` faz o botão ocupar toda a largura do card.
  - `<p className="text-sm text-slate-500 text-center">Esqueceu a senha? Procure o Admin da sua igreja.</p>`.

### T6. Criar `app/routes/public/login.tsx`

- **Path:** `app/routes/public/login.tsx`
- **Loader (`Route.LoaderArgs`):**
  - Lê `getUserFromRequest(request)` (helper em `lib/session.server.ts` — backend agent cria).
  - Se `user`, `throw redirect(redirectTo || "/app")`.
  - Lê `?next=` e `?motivo=expirado` da URL.
  - Retorna `{ next?: string, motivo?: "expirado" }`.
- **Action (`Route.ActionArgs`):**
  - **Rate limit primeiro** (chama `rateLimit.check(request, "login")` — se > 5 em 15min, retorna 429 com mensagem).
  - Lê `formData` via `request.formData()`.
  - Converte com `LoginSchema.safeParse(Object.fromEntries(formData))`.
  - Se falhar, retorna `{ fieldErrors: parsed.error.flatten().fieldErrors, formError: null, email: formData.get("email")?.toString() }` com status 422.
  - Chama `verifyCredentials(email, senha)` (helper em `lib/auth.server.ts`).
  - Se retornar `null`, retorna `{ formError: "E-mail ou senha incorretos.", email }` com status 401.
  - Se OK, chama `createSession(user.id, manterConectado)` e retorna `redirect(next || "/app", { headers: { "Set-Cookie": sessionCookie } })`.
- **Default export:**
  - `<TopbarPublica />` (sem botão "Entrar").
  - `<main className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-12">` (centraliza o card verticalmente).
  - `<div className="w-full max-w-md">` (card).
  - `<h1 className="text-2xl font-bold text-slate-900">Entrar</h1>`.
  - `<p className="text-sm text-slate-600 mt-1 mb-6">Acesse o painel administrativo.</p>`.
  - `<FormLogin formError={actionData?.formError} defaultEmail={actionData?.email} fieldErrors={actionData?.fieldErrors} motivo={loaderData?.motivo} />`.
  - `<footer>` com copyright.

### T7. Helpers no backend (NÃO crie se já existir)

- `app/lib/session.server.ts`: `getUserFromRequest`, `createSession`, `deleteSession`. Já mencionado no SPEC §5 — **backend agent** implementa. Frontend **só consome**.
- `app/lib/auth.server.ts`: `verifyCredentials(email, senha)`. Idem.
- `app/lib/rate-limit.server.ts`: `rateLimit.check(request, key)`. Idem.

**Se algum desses helpers não existir quando o frontend começar, criar stubs com `throw new Error("TODO: backend agent")` e avisar via comentário — o gate do `code-reviewer` pega. NÃO bloquear — frontend e backend podem trabalhar em paralelo com contratos bem definidos.**

### T8. Registrar rota em `app/routes.ts`

- Verificar/adicionar `route("/login", "routes/public/login.tsx")`.

## Validações e regras

- **Schema Zod:** `email` válido, `senha` 1-200 chars, `manterConectado` boolean opcional.
- **Mensagem unificada** para erro de credenciais: "E-mail ou senha incorretos." (anti-enumeração).
- **Rate limit** antes de qualquer processamento pesado.
- **Redirect pós-login:** se `?next=/app/membros/:id`, redireciona para lá; senão `/app`.

## Testes (TDD — vermelho primeiro)

### T8.1. Teste do `LoginSchema` (unit, sem DB)

- **Path:** `app/lib/schemas/auth.test.ts`
- **Primeiro teste:** `LoginSchema.safeParse({ email: "x", senha: "123" })` → falha com `fieldErrors.email`.
- **Segundo teste:** email válido + senha ≥ 1 → sucesso.

### T8.2. Teste do `<Input>` (unit)

- **Path:** `app/components/Input.test.tsx`
- **Teste:** renderiza com `error="Email inválido"` → encontra `aria-invalid="true"` e `role="alert"`.

### T8.3. Teste do `<FormLogin>` (integration)

- **Path:** `app/components/FormLogin.test.tsx`
- **Mock** do RR7 `useActionData` (via wrapper `<MemoryRouter>`).
- **Teste 1:** com `formError="..."`, renderiza o `<ErrorAlert>`.
- **Teste 2:** com `defaultEmail="a@b.c"`, input tem valor inicial.
- **Teste 3:** submit com form vazio dispara validação (campo required HTML5 — desativado via `noValidate`, então a validação fica no action).

### T8.4. Teste E2E (Playwright) — `e2e/login.spec.ts`

- **Chain 1 (sucesso):** `GET /login` → fill `admin@igreja.local` + senha correta → 302 para `/app` + cookie `sid` httpOnly.
- **Chain 2 (credenciais inválidas):** senha errada → 401 com mensagem "E-mail ou senha incorretos.".
- **Chain 3 (validação):** email malformado → 422 com erro no campo.
- **Chain 4 (rate limit):** 5+ tentativas em 15min → 429 com mensagem clara.
- **Chain 5 (autenticado):** login → `GET /login` → 302 para `/app`.
- **Chain 6 (sessão expirada):** acessa `/login?motivo=expirado` → vê mensagem informativa.
- **Chain 7 (senha nunca logada):** verifica que `console.log` ou `safeLog` nunca recebe senha (mock + assert spy).

## Critérios de pronto

- [ ] Todos os testes passam.
- [ ] Cobertura ≥ 85% na página e schemas.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Senha nunca aparece em payload, log, ou query string (testável).
- [ ] Cookie `sid` tem flags corretas (testável).
- [ ] Rate limit funcional (testável).
- [ ] `pnpm typecheck` passa.
- [ ] Build SSR funciona (curl `GET /login` retorna HTML completo).

## Armadilhas comuns (RAGs relevantes)

- **RAG `security-rbac-matrix.md`:** defesa em 3 camadas. UI esconde "Entrar" para logado, loader redireciona logado, action gera novo sessionId (anti-fixation). Não confie só na UI.
- **RAG `lgpd-igreja-conect.md` §2.5:** `safeLog` no action, não `console.log` direto. Logar `{ userId, action: "login_attempt", result: "ok" | "fail" | "rate_limited" }` — sem email, sem senha.
- **AGENTS §"JSDoc":** `verifyCredentials` é função pública — JSDoc completo.
- **AGENTS §"YAGNI":** NÃO criar "esqueci minha senha" com modal, NÃO criar "login com Google", NÃO criar "registre-se" (Admin cria via seed + admin UI). Foco no escopo.
- **Erro comum:** diferenciar visualmente "email não existe" de "senha errada" — **proibido** (anti-enumeração).
- **Erro comum:** esquecer de regenerar `sessionId` no login bem-sucedido — abre porta para session fixation.
