# Configurações (Acolhimento) — Design

## 1. Propósito

Tela de **configuração geral do sistema** — especificamente, o **responsável pelo acolhimento de visitantes** (RN-MEM-05). Acessível em `/app/config/acolhimento`.

> **Escopo MVP:** o PRD/SPEC só prevê esta tela de configuração. Módulos Financeiro/Estoque (que terão suas próprias configs) entram em sprints futuras. Por isso o path é `/config/acolhimento` (singular), não `/config` (geral).

**Persona-alvo:** **ADMIN** (único perfil que pode **escrever**). Todos os outros perfis autenticados podem **ler** a config atual.

**Caso de uso primário (US-MEM-004 do PRD):** Admin aponta 1 Membro **ou** 1 Ministério como responsável pelo acolhimento de novos visitantes. O sistema usa essa config para gerar alertas automáticos.

**Casos secundários:**
- Trocar o responsável (reatribuir para outro Membro ou Ministério).
- Ver a config atual (qual Membro/Ministério está responsável agora).
- Para perfis não-ADMIN: ver quem está configurado (informativo).

**Restrição crítica (RN-MEM-05):** apenas 1 responsável por vez. Tipo = "MEMBRO" **OU** "MINISTERIO" (exclusivo). Se tipo = "MEMBRO", `responsavelMembroId` é preenchido e `responsavelMinisterioId` é null. Vice-versa.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px) — perfil ADMIN

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Configurações > Acolhimento de visitantes                  │ ← breadcrumb
│            │                                                             │
│            │  ┌─ Configuração atual ──────────────────────────────────┐  │
│            │  │  Responsável atual:                                    │  │
│            │  │  👤 Membro: João Silva (Pastor titular)                │  │ ← se MEMBRO
│            │  │  ou                                                     │  │
│            │  │  🏛️ Ministério: Louvor                                 │  │ ← se MINISTERIO
│            │  │  ou                                                     │  │
│            │  │  ⚠ Nenhum responsável configurado                      │  │ ← se null
│            │  └────────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ┌─ Alterar responsável ─────────────────────────────────┐  │
│            │  │ Tipo de responsável *                                 │  │
│            │  │ ◉ Membro  ○ Ministério                                 │  │ ← radio
│            │  │                                                        │  │
│            │  │ Selecione o responsável *                             │  │
│            │  │ [▼ João Silva (Pastor titular)              ]         │  │ ← select
│            │  │                                                        │  │
│            │  │ (ou, se Ministério: lista de ministérios cadastrados)│  │
│            │  │                                                        │  │
│            │  │ [Salvar]                                               │  │
│            │  └────────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  ℹ O que acontece quando um visitante é cadastrado:         │ ← info box
│            │  Um alerta é enviado para o responsável configurado         │
│            │  acima, na Central de Alertas dele.                          │
│            │                                                             │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Perfil NÃO-ADMIN (PASTOR, SECRETARIO, etc.)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Configurações > Acolhimento de visitantes                  │
│            │                                                             │
│            │  ┌─ Configuração atual ──────────────────────────────────┐  │
│            │  │  Responsável: 👤 João Silva (Pastor titular)          │  │ ← somente leitura
│            │  │                                                        │  │
│            │  │  ℹ Apenas o Admin pode alterar esta configuração.    │  │
│            │  └────────────────────────────────────────────────────────┘  │
│            │                                                             │
│            │  (sem form)                                                 │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.3 Mobile

```
┌──────────────────────────────┐
│ ‹ Configurações              │
├──────────────────────────────┤
│ Acolhimento de visitantes    │
│                              │
│ Responsável atual            │
│ 👤 João Silva                │
│ (Pastor titular)             │
│                              │
│ (apenas Admin pode editar)   │
│                              │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<Breadcrumb>` | shared | — | (já existe) |
| `<ConfigAcolhimentoCard>` | novo | `config: ConfiguracaoGeral \| null`, `canEdit: boolean` | `app/components/ConfigAcolhimentoCard.tsx` |
| `<FormConfigAcolhimento>` | novo | `config`, `membros`, `ministerios`, `defaultValues` | `app/components/FormConfigAcolhimento.tsx` |
| `<RadioGroup>` | novo | `name`, `options: { value, label }[]`, `value`, `onChange` | `app/components/RadioGroup.tsx` |
| `<Select>` | shared | `options` | (já existe) |
| `<Button>` | shared | — | (já existe) |
| `<InfoBox>` | novo | `title`, `children` (caixa azul com ícone) | `app/components/InfoBox.tsx` |

**Hierarquia:**
- `app/routes/app/config.acolhimento.tsx`.
  - loader: lê `ConfiguracaoGeral` (singleton — `findFirst`), lista `Membro where cargo in [...]` (apenas ADMIN, PASTOR, SECRETARIO, FINANCEIRO podem ser responsável), e lista `Ministerio`. Retorna `{ config, membros, ministerios, canEdit }`.
  - action: `updateConfigAcolhimento(payload, user)` (só ADMIN).

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (ADMIN, sem config)** | Sistema novo, ninguém configurou | Mostra form vazio com tipo = "MEMBRO" default. |
| **Initial (ADMIN, com config MEMBRO)** | Já configurado | Form pré-preenchido, com "Alterar" habilitado. |
| **Initial (ADMIN, com config MINISTERIO)** | Já configurado para ministério | Mesmo, com tipo = "MINISTERIO". |
| **Initial (não-ADMIN)** | SECRETARIO/PASTOR/etc. | Mostra card de leitura, sem form. |
| **Loading** | Loader em andamento | Skeleton. |
| **Submit em andamento** | Click "Salvar" | Botão loading, campos disabled. |
| **Validação (campos)** | Tipo não selecionado, ID não selecionado | Mensagem inline. |
| **Sucesso** | Action OK | Toast "Configuração atualizada." + card atualiza. |
| **Erro (500)** | Action falhou | Toast de erro, mantém form. |
| **Erro de validação Zod** | `responsavelVisitanteTipo` inválido ou `responsavelId` vazio | 422 com `fieldErrors`. |
| **Não-ADMIN tenta POST** | Bypass via fetch | Loader/action retorna 403 (camada 2). |

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Radio "Membro" | `change` | Mostra select de membros, esconde select de ministérios. |
| Radio "Ministério" | `change` | Mostra select de ministérios, esconde select de membros. |
| Select de membros | `change` | Marca seleção. |
| Select de ministérios | `change` | Marca seleção. |
| Botão "Salvar" | Click | Valida (campos obrigatórios), submete. |
| Click no card de leitura (não-ADMIN) | — | Nada (não tem ações). |

**Navegação por teclado:**
- Tab: radio → select → botão Salvar.
- Esc no form (sem modal) = sem ação (form é inline, não tem como "cancelar" sem perder dados — botão "Descartar" é YAGNI).

---

## 6. Validações e regras

### 6.1 Schema Zod (`app/lib/schemas/config.ts`)

```ts
import { z } from "zod";

export const ConfigAcolhimentoSchema = z.object({
  responsavelVisitanteTipo: z.enum(["MEMBRO", "MINISTERIO"]),
  responsavelId: z.string().uuid("Selecione um responsável."),
}).refine(
  (d) => d.responsavelId.length > 0,
  { path: ["responsavelId"], message: "Selecione um responsável." }
);

export type ConfigAcolhimentoInput = z.infer<typeof ConfigAcolhimentoSchema>;
```

### 6.2 Regras de negócio (RN-MEM-05)

- **Singleton:** `ConfiguracaoGeral` tem 1 linha apenas. Service usa `upsert` (ou `findFirst + create`).
- **Tipo exclusivo:** se `responsavelVisitanteTipo = "MEMBRO"`, `responsavelMembroId` é o ID e `responsavelMinisterioId` é null. Service faz essa tradução antes de persistir.
- **Quem pode ser responsável Membro:** qualquer membro com `cargo` não-nulo (ou seja, qualquer um dos 6 perfis). PRD não restringe mais.
- **Quem pode ser responsável Ministério:** qualquer `Ministerio` cadastrado.
- **Cadastrar visitante com config null:** o alerta **NÃO** é criado (visitor é criado, mas sem alerta). PRD §6.8 diz "se config não existe, visitante é criado e o sistema avisa no console" — registrar comportamento, mas UI mostra: "Atenção: nenhum responsável configurado. O visitante foi cadastrado, mas nenhum alerta foi enviado."

### 6.3 Edge cases

- **Trocar tipo de MEMBRO para MINISTERIO:** o `responsavelMembroId` antigo é zerado, `responsavelMinisterioId` novo é setado. Service faz isso em transação.
- **Selecionar responsável que foi excluído entre loader e submit:** action valida existência — se não existe, 404.
- **ADMIN também é responsável:** permitido (auto-alerta). Decisão consciente — Admin é responsável pelo acolhimento em igrejas pequenas.

---

## 7. RBAC

| Perfil | Lê config | Escreve config |
|---|:-:|:-:|
| ADMIN | ✅ | ✅ |
| PASTOR | ✅ | ❌ |
| SECRETARIO | ✅ | ❌ |
| DISCIPULADOR | ✅ | ❌ |
| LIDER_MINISTERIO | ✅ | ❌ |
| FINANCEIRO | ✅ | ❌ |

**Defesa em profundidade:**
- **UI:** `<Can allow={["ADMIN"]}>` envolve o form. Não-ADMIN vê só card de leitura.
- **Loader:** não tem restrição de leitura (todos leem).
- **Action:** chama `assertIsAdmin(user)` (helper em `rbac.server.ts`). Falha → 403.

---

## 8. Acessibilidade

- **`<h1>`** = "Acolhimento de visitantes" (ou via breadcrumb).
- **Radio group** com `<fieldset>` e `<legend>`.
- **Select** com `<label>` associado.
- **InfoBox** com `role="note"`.
- **Mensagem de erro** com `aria-describedby` e `role="alert"`.
- **Botão "Salvar"** com `type="submit"`.

---

## 9. Mobile

- **Layout vertical** natural.
- **Radio buttons** empilhados verticalmente (não horizontal em mobile — fica apertado).
- **InfoBox** full-width.
- **Botão "Salvar"** full-width.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app/config/acolhimento` (ADMIN) retorna 200 e renderiza form.
- [ ] `GET /app/config/acolhimento` (não-ADMIN) retorna 200 e renderiza card de leitura.
- [ ] `GET /app/config/acolhimento` (anônimo) → 302 para `/login`.
- [ ] ADMIN salva config com Membro: persiste `responsavelMembroId`, `responsavelMinisterioId = null`.
- [ ] ADMIN salva config com Ministério: persiste `responsavelMinisterioId`, `responsavelMembroId = null`.
- [ ] Após salvar, próximo cadastro de visitante gera alerta para o novo responsável.
- [ ] `POST /app/config/acolhimento` por SECRETARIO → 403.
- [ ] Trocar de Membro para Ministério: o Membro antigo é "esquecido" (limpo).

### 10.2 Qualidade

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] `safeLog` registra quem mudou a config (`userId, action="update_config"`).
- [ ] Sem PII no log.
