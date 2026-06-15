# Detalhe do Membro — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/membros.$id.tsx`
  - `app/components/ResumoMembro.tsx`
  - `app/components/TabsMembro.tsx`
  - `app/components/TabDadosPessoais.tsx`
  - `app/components/TabDiscipulado.tsx`
  - `app/components/TabMinisterios.tsx`
  - `app/components/TabFidelidadeFinanceira.tsx`
  - `app/components/AcoesMembro.tsx`
  - `app/components/Breadcrumb.tsx`
  - `app/components/Can.tsx`
  - `app/lib/members.server.ts` (estender: `getMembroById`, `promoverTipo`)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, todos os 5 RAGs, schema, design/PRODUCT.md.
- **Boundary:** não criar services financeiros (RN-MEM-03 — fora de escopo MVP).

## Contexto

Ficha completa de um membro. Inclui abas condicionais (Fidelidade só para perfis financeiros).

- **Design:** [`design/private-membros-detail.DESIGN.md`](./private-membros-detail.DESIGN.md)
- **PRD:** US-MEM-005 (RN-MEM-03).
- **SPEC:** §6 (membros), §6.9 (fidelidade bloqueada), §7 (RBAC).
- **RAG `security-rbac-matrix.md`:** defesa em 3 camadas, especialmente a **Fidelidade Financeira**.
- **RAG `lgpd-igreja-conect.md` §2.2:** dado sensível, bloqueio obrigatório.

## Tarefas

### T1. Criar `<Breadcrumb>`

- **Path:** `app/components/Breadcrumb.tsx`
- **Props:** `items: { label: string, href?: string }[]`.
- **Estrutura:** `<nav aria-label="Trilha de navegação"><ol className="flex items-center gap-1 text-sm">{items.map((item, i) => <li key={i} className="flex items-center gap-1">{item.href ? <Link to={item.href} className="text-cyan-700 hover:underline">{item.label}</Link> : <span className="font-medium text-slate-900" aria-current="page">{item.label}</span>}{i < items.length - 1 && <span className="text-slate-400">›</span>}</li>)}</ol></nav>`.

### T2. Criar `<Can>` (helper de RBAC client-side)

- **Path:** `app/components/Can.tsx`
- **Props:** `user: { cargo: Cargo | null }`, `allow: Cargo[]`, `children: ReactNode`, `fallback?: ReactNode`.
- **Lógica:** se `user.cargo` está em `allow`, renderiza `children`; senão `fallback` (default `null`).

### T3. Criar `<ResumoMembro>`

- **Path:** `app/components/ResumoMembro.tsx`
- **Props:** `membro: Membro`.
- **Estrutura:** grid 2 colunas com nome (h1), tipo (badge), email, telefone, endereço completo, e KPIs (membro há X dias, tipo, discipulador, ministérios).

### T4. Criar `<TabsMembro>`

- **Path:** `app/components/TabsMembro.tsx`
- **Props:** `activeTab: "dados" | "discipulado" | "ministerios" | "fidelidade"`, `canSeeFinancials: boolean`, `membroId: string`, `membro: Membro`, `discipulador: Membro | null`, `discipulos: Membro[]`, `ministerios: Ministerio[]`, `canEdit: boolean`, `onPromover?: (novoTipo) => void`.
- **Lógica:** se `canSeeFinancials === false`, **NÃO renderiza** a tab "Fidelidade" (nem link quebrado). Para perfis permitidos, renderiza.
- **Estrutura:** `<div role="tablist" className="border-b border-slate-200 flex gap-1 overflow-x-auto"><Link to={"?tab=dados"} role="tab" aria-selected={activeTab === "dados"} className={tabClass(activeTab === "dados")}>Dados</Link><Link to={"?tab=discipulado"} ...>Discipulado</Link><Link to={"?tab=ministerios"} ...>Ministérios</Link>{canSeeFinancials && <Link to={"?tab=fidelidade"} role="tab" ...>Fidelidade</Link>}</div><div role="tabpanel" className="py-6">{renderTabContent()}</div>`.

### T5. Criar `<TabDadosPessoais>`

- **Path:** `app/components/TabDadosPessoais.tsx`
- **Props:** `membro`, `canPromover: boolean` (ADMIN, PASTOR), `onPromover: (novoTipo) => void`.
- **Estrutura:** lista de campos (data conversão, batismo, profissão, estado civil). Botão "Promover → CONGREGADO" ou "→ MEMBRO_ATIVO" no rodapé (se aplicável).

### T6. Criar `<TabDiscipulado>`

- **Path:** `app/components/TabDiscipulado.tsx`
- **Props:** `discipulador`, `discipulos`, `membroId`, `canEdit`.
- **Estrutura:** se `discipulador` existe, card com nome + botão "Reatribuir" (link para `/app/membros/:id/discipulado`). Se `discipulos.length > 0`, lista de discípulos com botão "Desvincular".

### T7. Criar `<TabMinisterios>`

- **Path:** `app/components/TabMinisterios.tsx`
- **Props:** `ministerios`, `membroId`, `canEdit`.
- **Estrutura:** lista de ministérios com botão "Desvincular" inline. Botão "+ Adicionar a um ministério" se canEdit.

### T8. Criar `<TabFidelidadeFinanceira>`

- **Path:** `app/components/TabFidelidadeFinanceira.tsx`
- **Props:** `membroId`.
- **Estrutura:** placeholder "Módulo Financeiro ainda não disponível. Esta aba listará os dízimos do membro quando o módulo Financeiro entrar em sprint futura (Sprint 1)."
- **Renderização condicional:** este componente SÓ é renderizado se o loader retornar `canSeeFinancials === true`. Se um perfil não permitido tentar acessar via URL, o loader força `tab = "dados"` e nem monta este componente (camada 2).

### T9. Criar `<AcoesMembro>`

- **Path:** `app/components/AcoesMembro.tsx`
- **Props:** `membro`, `user: SessionUser`.
- **Lógica:**
  - Sempre renderiza botão "Editar" (link para `/editar`).
  - `<Can allow={["ADMIN", "PASTOR"]}>` renderiza botão "Excluir" (com confirmação).
- **Estrutura:** `<div className="flex gap-2"><Button as={Link} to={`/app/membros/${membro.id}/editar`} variant="primary">Editar</Button><Can user={user} allow={["ADMIN", "PASTOR"]}><Button onClick={() => setOpenModal(true)} variant="danger">Excluir</Button></Can></div>`.

### T10. Criar `app/lib/members.server.ts` (estender)

- **Path:** `app/lib/members.server.ts` (já existe do PROMPT anterior; estender)
- **Novas funções:**
  - `getMembroById(id: string, user: SessionUser): Promise<MembroDetail>` — busca com escopo RBAC. Se não bate, lança 403.
  - `promoverTipo(id: string, novoTipo: TipoMembro, user: SessionUser): Promise<Membro>` — validação Zod, escopo, update.
  - `deleteMembro(id: string, user: SessionUser): Promise<void>` — só ADMIN/PASTOR. Se tem discípulos, 409.

### T11. Criar `app/routes/app/membros.$id.tsx`

- **Path:** `app/routes/app/membros.$id.tsx`
- **Loader:**
  - Lê `params.id` e `searchParams.tab` (default "dados").
  - Chama `getMembroById(id, user)`. Se não existe, throw 404. Se sem acesso, throw 403.
  - Carrega `discipulador`, `discipulos`, `ministerios`.
  - **Camada 2 RBAC Fidelidade:** se `!canSeeFinancials(user)` e `tab === "fidelidade"`, força `tab = "dados"` (não retorna nada financeiro).
  - `canSeeFinancials = FINANCIAL_CARGOS.includes(user.cargo)`.
  - `canEdit = canWriteMembers(user)`.
  - `canDelete = user.cargo === "ADMIN" || user.cargo === "PASTOR"`.
  - Retorna `{ membro, discipulador, discipulos, ministerios, activeTab, canSeeFinancials, canEdit, canDelete }`.
- **Action:**
  - `intent === "delete"`: chama `deleteMembro(id, user)`. Redireciona para `/app/membros` com toast.
  - `intent === "promover"`: chama `promoverTipo(id, formData.tipo, user)`. Redireciona para `/app/membros/:id` com toast.
- **Default export:**
  - `<Breadcrumb items={[{label:"Membros", href:"/app/membros"}, {label: membro.nome}]} />`.
  - `<ResumoMembro membro={membro} />`.
  - `<AcoesMembro membro={membro} user={user} />`.
  - `<TabsMembro activeTab={activeTab} canSeeFinancials={canSeeFinancials} ... />`.
- **ErrorBoundary** para 403/404: `<ErrorPage title="Acesso negado" message="Você não tem permissão para ver este membro." />` ou similar.

### T12. Helper de permissão (se não existir)

- `app/lib/rbac.server.ts` (pode já existir do backend agent).
- Helper: `canSeeFinancials(user)`, `canWriteMembers(user)`, `isAdmin(user)`, `isPastor(user)`.

## Validações e regras

- **Camada 2 RBAC:** se `tab === "fidelidade"` e `!canSeeFinancials`, loader força `tab = "dados"`. **Não** renderiza nada financeiro.
- **Escopo DISCIPULADOR:** `getMembroById` filtra por `discipuladorId === user.id`. Se não bate, 404 (não 403 — não vaza existência).
- **Promoção de tipo:** ação separada, intencional. **Não** confundir com edição.

## Testes (TDD)

### T12.1. Teste crítico — bypass de Fidelidade (US-MEM-005)

- **Path:** `app/routes/app/membros.$id.test.tsx`
- **Cenário:** SECRETARIO logado → `GET /app/membros/:id?tab=fidelidade` → loader retorna com `activeTab = "dados"` (não "fidelidade"). HTML do response **não contém** "Fidelidade", "dízimo", "Lancamento", "valorCentavos".

### T12.2. Teste de escopo DISCIPULADOR

- 2 discípulos: um do user DISCIPULADOR, outro de outro.
- `getMembroById(idDoOutro, discipuladorUser)` lança 404.

### T12.3. Teste de promoção

- `promoverTipo(id, "CONGREGADO", adminUser)` atualiza. Retorna membro com `tipo === "CONGREGADO"`.

### T12.4. Teste E2E — `e2e/membros-detail.spec.ts`

- Login como ADMIN → `/app/membros/:id` → vê 4 abas (incluindo Fidelidade).
- Login como SECRETARIO → mesma URL → vê 3 abas (sem Fidelidade).
- Bypass: SECRETARIO → `/app/membros/:id?tab=fidelidade` → vê aba "Dados" ativa.
- Bypass via DevTools: SECRETARIO chama API direta → 403 (RN-MEM-03).

## Critérios de pronto

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] **Teste E2E do bypass de Fidelidade passa** (gate do `lgpd-officer`).
- [ ] `senhaHash` nunca em payload (grep).
- [ ] Modal de exclusão tem foco preso.
- [ ] `pnpm typecheck` passa.

## Armadilhas comuns (RAGs)

- **RAG `security-rbac-matrix.md`:** **defesa em 3 camadas** é não-negociável para Fidelidade. UI esconde, loader barra, service lança. Falha em 1 camada vaza.
- **RAG `lgpd-igreja-conect.md` §2.2:** segredo absoluto. Teste E2E é o que prova o bloqueio.
- **AGENTS §"YAGNI":** NÃO criar "histórico de alterações" do membro, NÃO criar "ficha de presença", NÃO criar "agendamento de visita". Foco nos 4 cases.
- **Erro comum:** `tab=fidelidade` para perfil não autorizado renderiza tab "Dados" mas mantém o param na URL. Pode confundir UX — mostrar também um toast "Você não tem acesso à aba Fidelidade.".
- **Erro comum:** erro de 404 vs 403. Use 404 quando possível (não vaza existência do membro). Use 403 quando o usuário "deveria" saber que existe (ex: tentar editar um membro que não é dele — é mais transparente usar 404 também).
