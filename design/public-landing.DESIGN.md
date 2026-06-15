# Landing Pública — Design

## 1. Propósito

Página inicial do sistema, acessível a **qualquer visitante anônimo** (`/`). Serve três objetivos:

1. **Identificar a igreja** para o usuário (reconhecimento institucional).
2. **Direcionar para o login** (única ação real disponível).
3. **Informar sobre o escopo MVP** (o que a plataforma faz e o que ainda não faz), para evitar confusão de quem esperava ver módulo financeiro, estoque, etc.

**Persona-alvo:** qualquer um dos 6 perfis administrativos (ADMIN, PASTOR, SECRETARIO, DISCIPULADOR, FINANCEIRO, LIDER_MINISTERIO) que abriu o sistema pela primeira vez, OU um membro comum curioso que recebeu o link.

**Não-persona:** público externo da igreja. **Esta NÃO é uma página de evangelismo ou marketing** — é a entrada operacional de um sistema interno. A comunicação é sóbria, sem versículos, sem cores religiosas, sem chamada emocional.

**Restrição crítica:** o sistema é **interno** (1 igreja local, multi-tenant fora de escopo — PRD §4). Esta página existe basicamente para (a) confirmar ao usuário que está no lugar certo, e (b) oferecer o botão "Entrar". Nada além disso.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo Igreja Conect]                                  [Entrar →] │ ← h-14
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Igreja Conect                                                   │ ← h1
│  Sistema de gestão eclesiástica local                            │ ← subtítulo
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  O que está disponível agora:                              │ │ ← Card 1
│  │  • Cadastro e busca de membros                             │ │
│  │  • Vínculo de discipulado (limite 12 discípulos/líder)     │ │
│  │  • Vincular membros a ministérios                          │ │
│  │  • Acolhimento automático de visitantes com alerta         │ │
│  │  • Central de alertas interna                              │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  O que está em desenvolvimento:                            │ │ ← Card 2
│  │  • Módulo Financeiro (caixas, dízimos, ofertas) — Sprint 1│ │
│  │  • Módulo de Estoque (consumo e patrimônio) — Sprint 3+   │ │
│  │  • Manutenção de ativos — Sprint 4+                        │ │
│  │                                                            │ │
│  │  Em caso de dúvida sobre a privacidade dos dados,         │ │
│  │  consulte a nossa Política de Privacidade.                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Entrar no sistema →]   ← CTA primário                        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  © Igreja Conect 2026 • Igreja local [nome configurável]       │ ← footer
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile (< 768px)

```
┌──────────────────────────────┐
│ [Logo]              [Entrar] │ ← topbar condensada
├──────────────────────────────┤
│                              │
│ Igreja Conect                │ ← h1
│ Sistema de gestão eclesiástica│
│                              │
│ ┌──────────────────────────┐ │
│ │ Disponível agora:        │ │
│ │ • Membros                │ │
│ │ • Discipulado            │ │
│ │ • Ministérios            │ │
│ │ • Acolhimento            │ │
│ │ • Alertas                │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ Em desenvolvimento:      │ │
│ │ • Financeiro             │ │
│ │ • Estoque                │ │
│ │ • Manutenção             │ │
│ └──────────────────────────┘ │
│                              │
│ [Entrar no sistema →]        │ ← CTA full-width
│                              │
├──────────────────────────────┤
│ © Igreja Conect 2026         │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props customizadas | Localização |
|---|---|---|---|
| `<TopbarPublica />` | novo | `logoUrl`, `entrarHref` | `app/components/TopbarPublica.tsx` |
| `<CardInfo />` | novo | `title`, `items: string[]`, `tone: "available" \| "planned"` | `app/components/CardInfo.tsx` |
| `<Button variant="primary" />` | shared (ver PRODUCT §1.2) | `as: Link`, `to: "/login"`, `children` | `app/components/Button.tsx` |
| `<LandingPage>` | page-level | — | `app/routes/public/index.tsx` |

**Hierarquia:**
- `app/routes/public/index.tsx` (default export da rota)
  - `<TopbarPublica />` (sticky no topo)
  - `<main>` com 2 `<CardInfo />` (disponível / em desenvolvimento)
  - `<Button as={Link} to="/login" />` (CTA)
  - `<footer>` com copyright

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial** | Anônimo acessa `/` | Página completa renderiza. |
| **Autenticado** | Usuário já logado acessa `/` | Loader detecta `user` e redireciona para `/app` (302). |
| **Loading** | — | Página é puramente estática; sem loading state. |
| **Error** | — | Não aplicável (não há I/O no loader). |

**Detalhe importante:** o loader do `index.tsx` público deve verificar se já há `user` autenticado (via `getUserFromRequest(request)`) e, em caso afirmativo, redirecionar para `/app`. Isso evita o usuário logado cair na landing e ter que clicar "Entrar" manualmente.

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Logo (topbar) | Click | Navega para `/` (a própria página). |
| Link "Entrar" (topbar) | Click | Navega para `/login`. |
| CTA "Entrar no sistema →" | Click | Navega para `/login`. |
| "Política de Privacidade" | Click | (futuro) abre modal ou link externo. No MVP, link `#` com `aria-disabled` ou oculta — LGPD menciona política, mas o MVP não exige UI para isso (é responsabilidade do Admin publicar em outro lugar). |

**Navegação por teclado:**
- Tab: Logo → "Entrar" (topbar) → CTA principal → footer.
- Enter: ativa o link focado.

---

## 6. Validações e regras

- **Sem validação de payload** (página estática).
- **Sem regra de negócio** aplicável.
- **Única lógica no loader:** se `user` autenticado, redirect para `/app`.

---

## 7. RBAC

| Perfil | Acesso à landing |
|---|---|
| Anônimo | ✅ Vê a página + botão "Entrar". |
| ADMIN, PASTOR, SECRETARIO, DISCIPULADOR, FINANCEIRO, LIDER_MINISTERIO | ✅ Vê a página mas loader redireciona para `/app` (não fica preso aqui). |
| Membro comum (sem `cargo`) | ✅ Vê a página. Se tentar acessar `/app/**`, middleware barra (não-admin). |

**Defesa em profundidade:** a landing não tem nada sensível. Não precisa de camadas extras.

---

## 8. Acessibilidade

- **`<h1>`** único e descritivo ("Igreja Conect").
- **Hierarquia correta:** `<h1>` → `<h2>` (cards) → `<p>`.
- **Contraste:** texto `slate-900` em fundo `slate-50` = ~15:1 (AAA). Botões `cyan-700` em branco = ~5.5:1 (AA+).
- **Foco visível** em todos os links e botões.
- **`<nav>`** semântico para a topbar (`<header><nav>...</nav></header>`).
- **Skip link opcional:** "Pular para o conteúdo principal" como primeiro item focável (UX avançada, recomendada mas não obrigatória no MVP).
- **Língua:** `<html lang="pt-BR">` no `root.tsx` (não específico desta página).

---

## 9. Mobile

- **Topbar condensada:** logo menor (`h-8` em vez de `h-10`), botão "Entrar" vira só ícone ou texto curto.
- **Cards:** full-width com `mx-4`, `p-4`.
- **CTA:** full-width (`w-full`) com `min-h-[44px]` (target de toque).
- **Sem imagens decorativas** que precisem carregar — tudo texto e ícones SVG inline.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /` retorna 200 e renderiza o HTML completo (sem I/O bloqueante).
- [ ] Anônimo clica em "Entrar" (topbar) → navega para `/login`.
- [ ] Anônimo clica no CTA "Entrar no sistema →" → navega para `/login`.
- [ ] Anônimo clica no logo da topbar → permanece em `/` (sem navegação estranha; pode usar `<Link to="/">` com semântica mas sem causar reload).
- [ ] Usuário autenticado acessa `/` → é redirecionado (302) para `/app`.

### 10.2 Layout/UX

- [ ] Em viewport 375×667 (iPhone SE), todos os elementos cabem sem scroll horizontal.
- [ ] Em viewport 1280×800, layout centrado com `max-w-3xl`.
- [ ] Navegação por Tab cobre: Logo → Entrar (topbar) → CTA → footer.
- [ ] Cards de informação listam todos os bullets sem corte visual.
- [ ] CTA primário "Entrar no sistema" tem contraste AA+ e `min-h-[44px]` em mobile.

### 10.3 Qualidade

- [ ] Lighthouse Accessibility score ≥ 95.
- [ ] Lighthouse Best Practices score ≥ 95.
- [ ] Sem uso de `localStorage`, `sessionStorage`, cookies de rastreamento, ou analytics.
- [ ] Sem requisições para domínios terceiros (verificável via DevTools Network).
- [ ] Tempo de resposta do loader < 50ms p95 (página é essencialmente estática).

### 10.4 Acessibilidade

- [ ] Texto "Igreja Conect" é o primeiro `<h1>` da página (verificável via DevTools).
- [ ] Hierarquia de headings correta: `<h1>` Igreja Conect, `<h2>` para cada card.
- [ ] Foco visível em todos os links (Tab + Shift+Tab visível).
- [ ] Conteúdo textual do card de "em desenvolvimento" tem `aria-label` ou texto claro (sem ambiguidade sobre o que está vs. não está disponível).
- [ ] `<main id="main-content">` para suportar skip link (mesmo que skip link em si seja opcional no MVP).

### 10.5 Conformidade LGPD

- [ ] Nenhum dado pessoal é coletado nesta página (página é puramente informativa).
- [ ] Nenhum cookie é setado além do de sessão (que só é setado após login).
- [ ] Nenhum recurso externo (fonte, imagem, script) é carregado — tudo self-hosted ou inline.
- [ ] Nenhuma referência a analytics, fingerprinting, ou tracking.
