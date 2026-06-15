# Login — Design

## 1. Propósito

Página de autenticação do sistema. Único ponto de entrada para os **6 perfis administrativos**. Acessível em `/login` por qualquer usuário anônimo.

**Persona-alvo:** Pastor, Secretário, Admin, Discipulador, Financeiro, Líder de Ministério que precisa entrar no sistema. Conhece seu email e senha (credenciais fornecidas pelo Admin).

**Caso de uso primário (UC-01 do PRD):** Pastor digita email e senha, sistema valida hash bcrypt, abre sessão, redireciona para `/app`.

**Casos secundários:**
- Tentativa com credenciais erradas (feedback claro sem vazar qual campo falhou).
- Sessão expirada (loader detecta e mostra mensagem).
- Acesso direto a `/login` estando logado (loader redireciona para `/app`).
- 5+ tentativas em 15min do mesmo IP (rate limit — HTTP 429 com mensagem).
- Redirect pós-login para URL original (`?next=/app/membros/:id`).

**Restrições críticas:**
- Senha **nunca** volta em payload, mesmo em erro (PRD §6.3).
- Não diferenciar "email não existe" de "senha errada" (anti-enumeração — SPEC §10.1).
- Cookie de sessão: `httpOnly`, `sameSite=lax`, `secure` em prod (RAG `lgpd-igreja-conect.md §2.4`).

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo Igreja Conect]                                             │ ← h-14, sem link "Entrar"
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                                                                  │
│           ┌──────────────────────────────────────┐               │
│           │                                      │               │ ← Card central, max-w-md
│           │  Entrar                              │               │ ← h1
│           │  Acesse o painel administrativo.     │               │ ← subtítulo
│           │                                      │               │
│           │  E-mail                              │               │
│           │  ┌────────────────────────────────┐  │               │
│           │  │ seu@email.com                  │  │               │
│           │  └────────────────────────────────┘  │               │
│           │                                      │               │
│           │  Senha                               │               │
│           │  ┌────────────────────┐  [👁]      │               │ ← toggle de visibilidade
│           │  │ ••••••••           │             │               │
│           │  └────────────────────┘             │               │
│           │                                      │               │
│           │  ☐ Manter-me conectado (30 dias)    │               │ ← checkbox (opcional)
│           │                                      │               │
│           │  ┌────────────────────────────────┐  │               │
│           │  │            Entrar              │  │               │ ← submit
│           │  └────────────────────────────────┘  │               │
│           │                                      │               │
│           │  Esqueceu a senha? Procure o Admin. │               │ ← hint (não tem fluxo) │
│           │                                      │               │
│           │  ⚠ Mensagem de erro aqui (topo)     │               │ ← só em erro
│           │                                      │               │
│           └──────────────────────────────────────┘               │
│                                                                  │
│           Esqueceu a senha? Fale com o Admin da sua igreja.      │ ← rodapé do card
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  © Igreja Conect 2026                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [Logo]                       │
├──────────────────────────────┤
│                              │
│  Entrar                      │
│  Acesse o painel admin.      │
│                              │
│  E-mail                      │
│  ┌────────────────────────┐  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  Senha                       │
│  ┌────────────────────┐ [👁]│
│  │                    │     │
│  └────────────────────┘     │
│                              │
│  ☐ Manter conectado (30d)   │
│                              │
│  ┌────────────────────────┐  │
│  │        Entrar          │  │ ← full-width
│  └────────────────────────┘  │
│                              │
│  Esqueceu? Fale com Admin.   │
│                              │
├──────────────────────────────┤
│ © Igreja Conect 2026         │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props customizadas | Localização |
|---|---|---|---|
| `<TopbarPublica variant="login" />` | novo | sem botão "Entrar" (já está no login) | `app/components/TopbarPublica.tsx` |
| `<CardLogin>` | novo | wrapper centralizado com `max-w-md mx-auto` | `app/components/CardLogin.tsx` |
| `<FormLogin>` | novo | `formError?`, `fieldErrors?` | `app/components/FormLogin.tsx` |
| `<Input label type="email" name="email" required />` | shared | `leadingIcon?: ReactNode`, `error?: string` | `app/components/Input.tsx` |
| `<Input label type="password" name="senha" required trailingIcon="eye" />` | shared | toggle de visibilidade (client-side) | `app/components/Input.tsx` |
| `<Checkbox name="manterConectado" label="Manter conectado (30 dias)" />` | shared | `label`, `defaultChecked` | `app/components/Checkbox.tsx` |
| `<Button type="submit" variant="primary" fullWidth>Entrar</Button>` | shared | `loading: boolean` | `app/components/Button.tsx` |
| `<ErrorAlert>` | shared | `message: string` | `app/components/ErrorAlert.tsx` |

**Hierarquia:**
- `app/routes/public/login.tsx`
  - loader: detecta `user` logado → redirect `/app`; senão retorna `{ formError?, email? }`
  - action: valida Zod, chama `verifyCredentials`, cria session, redirect; ou retorna erro
  - `<TopbarPublica />`
  - `<CardLogin>` com `<FormLogin>` (usando `useActionData()` para erros)

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial** | GET `/login` (anônimo) | Form limpo, sem erros. |
| **Autenticado acessa /login** | Loader detecta `user` | 302 → `/app`. |
| **Submit em andamento** | User clicou "Entrar", esperando resposta | Botão vira `<Spinner />` + label "Entrando...". Inputs ficam `disabled`. |
| **Erro de validação (campos)** | Zod falhou (email inválido, senha vazia) | Mantém na página, mostra erro inline no campo, **sem** erro no topo. |
| **Erro de credenciais (401)** | Email/senha incorretos | Mensagem no topo do form: "E-mail ou senha incorretos." (não diferencia qual campo). Email é preservado no input. |
| **Rate limit (429)** | 5+ tentativas em 15min | Mensagem no topo: "Muitas tentativas. Aguarde 15 minutos e tente novamente." (não mostra cronômetro exato — não precisa). |
| **Sessão expirada (informativo)** | Redirect com `?next=X&motivo=expirado` | Mensagem no topo: "Sua sessão expirou. Faça login novamente." (info, não erro). |
| **Erro 500** | Falha de servidor | Mensagem genérica: "Não foi possível processar o login. Tente novamente." Botão "Tentar novamente" disponível. |

**Visual dos erros:**
- **Inline (campo):** `border-red-700`, mensagem em `text-sm text-red-700` abaixo do campo, `aria-describedby` apontando para mensagem, `aria-invalid="true"`.
- **Topo do form:** `bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800` com ícone de alerta.

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Input email | `change` | Atualiza state local (controlled). Validação Zod no submit, não no blur. |
| Input senha (com toggle 👁) | Click no ícone | Alterna `type="password"` ↔ `type="text"`. Ícone vira 👁-off. |
| Checkbox "Manter conectado" | `change` | Default `false`. Se true, action seta cookie com `Max-Age = 30 dias` (em vez de 7 dias sliding). |
| Botão "Entrar" | `submit` | Valida form, submete via `<Form method="post">` do RR7, mostra spinner. |
| Link "Esqueceu a senha? Procure o Admin" | Click | Não tem destino (placeholder). No MVP, a recuperação é manual (PRD §4 — fora de escopo). Tooltip pode aparecer: "Sem recuperação automática nesta versão. Fale com o Admin." |
| Enter em qualquer campo | `keypress` | Submete o form. |
| Esc | `keypress` | Sem ação (não limpa o form, evita perda acidental). |

**Navegação por teclado:**
- Tab: Email → Senha → Toggle olho → Checkbox → Botão Entrar → Link "Esqueceu a senha".
- Enter no campo email/senha = submit.

---

## 6. Validações e regras

### 6.1 Schema Zod (`app/lib/schemas/auth.ts`)

```ts
export const LoginSchema = z.object({
  email: z.string().email("E-mail inválido. Verifique o formato.").max(200),
  senha: z.string().min(1, "Senha é obrigatória.").max(200),
  manterConectado: z.coerce.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;
```

### 6.2 Regras de negócio

- **Verificação de credenciais** em `app/lib/auth.server.ts → verifyCredentials(email, senha)`:
  1. `membro.findUnique({ where: { email } })` — se `null`, retorna `null` (sem diferenciar).
  2. `bcrypt.compare(senha, membro.senhaHash)` — se `false`, retorna `null`.
  3. Verifica que `membro.cargo` é não-nulo (sem cargo = membro comum, sem acesso).
  4. Retorna `{ id, nome, cargo }` ou `null`.
- **Criação de sessão** em `app/lib/session.server.ts → createSession(userId, manterConectado)`:
  1. Gera UUID para `sessionId`.
  2. Cria registro `Session` no DB com `expiresAt = now + 7d` e `absoluteExpiresAt = now + (manterConectado ? 30d : 7d)`.
  3. Seta cookie `sid` httpOnly, sameSite=lax, secure em prod, maxAge condicional.
- **Rate limit** em `app/lib/rate-limit.server.ts`:
  - `Map<ip, { count: number, firstAt: number }>`.
  - Antes de processar action, incrementa count do IP; se > 5 em 15min, retorna 429.
  - Limpa entradas expiradas (lazy, no próximo request).
- **Mensagem de erro unificada** (anti-enumeração): "E-mail ou senha incorretos." — usada para ambos os casos (email não existe, senha errada).

### 6.3 Edge cases

- **Email com espaços/typos:** trim antes de comparar (mas não no `findUnique` — usar `email.toLowerCase().trim()`).
- **Senha com caracteres especiais:** aceita (Zod `.string()` aceita qualquer char). Limite 200 chars para evitar DoS.
- **Múltiplas abas abertas:** session única é fine — não há "outro device" tracking no MVP.
- **Cookie expirado + tentativa de login:** trata como sessão normal, login bem-sucedido gera nova sessão.

---

## 7. RBAC

| Perfil | Comportamento |
|---|---|
| Anônimo | ✅ Vê a página. Pode submeter. |
| Qualquer perfil autenticado (6 tipos) | ❌ Loader redireciona para `/app`. Não vê a página. |
| Membro comum (sem cargo) | ✅ Vê, mas `verifyCredentials` rejeita (sem cargo = sem acesso). |

**Defesa em profundidade:**
1. **UI:** link "Entrar" some da topbar quando autenticado (loader retorna `user`, componente decide).
2. **Loader de /login:** se `user`, redirect `/app`.
3. **Action:** revalida sessão; se válida, gera nova (evita session fixation).
4. **Middleware `/app`:** mesmo que alguém force GET `/login` direto, o middleware de `/app` continua exigindo sessão válida.

---

## 8. Acessibilidade

- **`<h1>`** = "Entrar".
- **Labels associados:** `<label htmlFor="email">E-mail</label>` com `<input id="email">`.
- **`aria-required="true"`** em inputs obrigatórios.
- **`aria-invalid`** quando há erro de validação + `aria-describedby` apontando para a mensagem de erro.
- **`autocomplete="email"`** no input email e **`autocomplete="current-password"`** no input senha (ajuda gerenciadores de senha).
- **Toggle de visibilidade da senha:** botão com `aria-label="Mostrar senha"` / `"Ocultar senha"`, `aria-pressed` refletindo estado.
- **Mensagem de erro** com `role="alert"` (lê por screen reader imediatamente).
- **Foco:** ao carregar a página, foco vai direto para o input email (UX, não acessibilidade mandatória). Em erro de submit, foco volta para o primeiro campo com erro.
- **Contraste AA+** garantido (cyan-700 em branco).
- **Suporte a zoom** até 200% sem quebra de layout (testar manualmente).

---

## 9. Mobile

- **Card full-width** com `mx-4` (não centralizado com margin — usa o padding do card).
- **Inputs full-width** com `min-h-[44px]`.
- **Botão "Entrar"** full-width e `min-h-[44px]`.
- **Toggle de olho** com área de toque suficiente (não ícone de 16px — 24px).
- **Sem scroll horizontal.**
- **Teclado virtual:** `inputMode="email"` no campo email (teclado com `@`), `inputMode="text"` em senha.
- **Auto-fill:** `autocomplete="email"` e `autocomplete="current-password"` ativam sugestão do SO.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /login` (anônimo) retorna 200 e renderiza o form.
- [ ] `GET /login` (autenticado) retorna 302 para `/app`.
- [ ] `POST /login` com email válido + senha correta → 302 para `/app` (ou `?next=`) + Set-Cookie `sid`.
- [ ] `POST /login` com email inexistente → 401 com erro genérico "E-mail ou senha incorretos." (mesma mensagem de senha errada).
- [ ] `POST /login` com senha errada → 401 com mesma mensagem genérica.
- [ ] `POST /login` com email inválido (formato) → 422 com erro no campo "E-mail inválido. Verifique o formato.".
- [ ] `POST /login` com senha vazia → 422 com erro "Senha é obrigatória.".
- [ ] Cookie `sid` tem `httpOnly=true`, `sameSite=lax`, `secure=true` em prod.
- [ ] Cookie expira após 7 dias (padrão) ou 30 dias (checkbox "Manter conectado" marcado).
- [ ] 6ª tentativa de login do mesmo IP em 15min retorna 429 com mensagem clara.

### 10.2 Segurança

- [ ] Senha **nunca** aparece em payload de resposta, log, ou query string.
- [ ] Senha **nunca** é logada, mesmo hasheada.
- [ ] Email não vaza em log de erro.
- [ ] Mensagem de erro não diferencia "email não existe" de "senha errada".
- [ ] `bcrypt.compare` é usado (não `===`).
- [ ] Session ID é regenerado após login (anti-fixation).
- [ ] Rate limit reseta após 15min OU login bem-sucedido.

### 10.3 Acessibilidade

- [ ] Lighthouse Accessibility ≥ 95.
- [ ] Navegação por Tab segue ordem: email → senha → olho → checkbox → entrar → link.
- [ ] Enter no campo email/senha submete o form.
- [ ] Mensagem de erro é anunciada por screen reader (`role="alert"`).
- [ ] Em viewport 375×667, sem scroll horizontal.
- [ ] Suporta zoom até 200% sem quebra.
- [ ] Labels associados via `htmlFor`/`id` (verificável via DevTools).
