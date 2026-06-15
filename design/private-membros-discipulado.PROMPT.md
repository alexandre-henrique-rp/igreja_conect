# Vínculo de Discipulado — Frontend Implementation Prompt

## Capability grant

- **Paths de escrita:**
  - `app/routes/app/membros.$id.discipulado.tsx`
  - `app/components/DiscipuladoPainel.tsx`
  - `app/components/ContadorDiscipulos.tsx`
  - `app/components/ModalSelecionarDiscipulador.tsx`
  - `app/components/CadeiaDiscipulado.tsx`
  - `app/components/ListaDiscipulos.tsx`
  - `app/components/Dialog.tsx`
  - `app/lib/schemas/discipulado.ts`
  - `app/lib/discipleship.server.ts` (service: `assignDisciple`, `unassignDisciple`, `getDiscipuladoData`, `isDescendantOf`)
- **Paths de leitura:** PRD, SPEC, AGENTS, RAGs, schema, DESIGNs relacionados.
- **Boundary:** não criar `<Dialog>` em outras páginas sem 2+ usos (este é o 1º, mas já é base para futuros).

## Contexto

Tela dedicada a gerenciar o vínculo de discipulado de um membro. Implementa US-MEM-002 (RN-MEM-04).

- **Design:** [`design/private-membros-discipulado.DESIGN.md`](./private-membros-discipulado.DESIGN.md)
- **PRD:** US-MEM-002 (trava 12 discípulos).
- **SPEC:** §6.5 (fluxo de vínculo), §11.3 (boundary tests).
- **RAG `security-rbac-matrix.md` §2:** trava de 12 e anti-loop no service.

## Tarefas

### T1. Criar `app/lib/schemas/discipulado.ts`

- **Path:** `app/lib/schemas/discipulado.ts`
- **Schema:** `AssignDiscipleSchema` (ver DESIGN §6.2).
- **Exporta:** `AssignDiscipleInput`.

### T2. Criar `app/lib/discipleship.server.ts` (service)

- **Path:** `app/lib/discipleship.server.ts`
- **Constante:** `export const MAX_DISCIPULOS = 12;` (RN-MEM-04).
- **Funções:**
  - `getDiscipuladoData(membroId, user): Promise<DiscipuladoData>` — retorna `{ membro, discipuladorAtual, discipulosDoDiscipulador, cadeia, discipuladoresDisponiveis }`.
  - `assignDisciple(discId, discipuladorId, user): Promise<Membro>`:
    1. Valida `discId !== discipuladorId` (auto-vínculo) → throw `BusinessRuleError("Você não pode ser seu próprio discipulador.")` com status 400.
    2. Conta discípulos ativos do discipulador: `count(Membro where discipuladorId = discipuladorId and id != discId)`. Se `>= 12` → throw `Response("Discipulador já possui 12 discípulos ativos. Reatribua antes de vincular mais.", { status: 409 })`.
    3. **Anti-loop:** `isDescendantOf(discId, discipuladorId)`. Se true → throw com 422.
    4. `prisma.membro.update({ where: { id: discId }, data: { discipuladorId } })`.
    5. Retorna membro atualizado.
  - `unassignDisciple(discId, user): Promise<void>` — `update({ data: { discipuladorId: null } })`.
  - `isDescendantOf(candidate, ancestor): Promise<boolean>` — função recursiva que percorre a cadeia. Limite de profundidade 10 (anti-loop natural). Se profundidade > 10, considera descendente (fail-safe).
  - `getDiscipuladoresDisponiveis(user): Promise<Membro[]>` — lista membros com `cargo in [..., "DISCIPULADOR", "PASTOR", "ADMIN"]` OU sem cargo mas que têm discípulos. **Decisão:** incluir todos os membros (PRD não restringe). Refinar sprint 2+.
- **JSDoc completo** em todas as funções.

### T3. Criar `<ContadorDiscipulos>`

- **Path:** `app/components/ContadorDiscipulos.tsx`
- **Props:** `atual: number`, `max: number = 12`.
- **Lógica de cor:**
  - `atual < 10`: `text-slate-700` (normal).
  - `10 <= atual < 12`: `text-amber-700` (atenção).
  - `atual === 12`: `text-amber-800 font-bold` (limite).
- **Estrutura:** `<p className={cn("text-sm", color)}><span className="text-lg font-semibold">{atual}</span>/{max} discípulos{atual >= 10 && <span className="ml-2 inline-flex items-center gap-1 text-xs" aria-label={atual === 12 ? "Limite atingido" : "Atenção: próximo do limite"}>⚠ {atual === 12 ? "Limite atingido" : "Atenção"}</span>}</p>`.

### T4. Criar `<Dialog>` (modal base acessível)

- **Path:** `app/components/Dialog.tsx`
- **Props:** `open: boolean`, `onClose: () => void`, `title: string`, `children: ReactNode`, `footer?: ReactNode`.
- **Comportamento:**
  - Renderiza portal (`createPortal`) em `document.body`.
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`.
  - **Foco preso:** ao abrir, foca no primeiro elemento focável. Tab/Shift+Tab cicla dentro. Esc fecha.
  - Click no overlay (fora do conteúdo) fecha.
  - Trava scroll do body quando aberto.
- **Estrutura:** `<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="fixed inset-0 bg-slate-900/50" onClick={onClose} /><div role="dialog" aria-modal="true" className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"><header className="flex items-center justify-between p-4 border-b"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Fechar"><XIcon /></button></header><div className="p-4">{children}</div>{footer && <footer className="p-4 border-t flex gap-2 justify-end">{footer}</footer>}</div></div>`.
- **Hook de foco preso:** `useFocusTrap` (10 linhas, sem lib).

### T5. Criar `<ModalSelecionarDiscipulador>`

- **Path:** `app/components/ModalSelecionarDiscipulador.tsx`
- **Props:** `open: boolean`, `onClose: () => void`, `membroId: string`, `discipuladores: { id, nome, count: number }[]`, `mode: "vincular" | "reatribuir"`.
- **Lógica interna:**
  - Lista de discipuladores com `count` atual de discípulos.
  - Input de busca filtra a lista.
  - Radio button para selecionar.
  - Discipulador com `count >= 12` aparece com `disabled` e badge "Limite atingido".
  - Discipulador que é descendente de `membroId` ou é o próprio `membroId` é **excluído** da lista.
- **Estrutura:** `<Dialog open={open} onClose={onClose} title={mode === "vincular" ? "Vincular discipulador" : "Reatribuir discipulador"} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button form="form-vincular" type="submit" disabled={!selectedId}>Vincular</Button></>}><Form id="form-vincular" method="post" className="space-y-3"><input type="hidden" name="intent" value="assign" /><input type="hidden" name="membroId" value={membroId} /><input type="hidden" name="discipuladorId" value={selectedId ?? ""} /><InputSearch placeholder="Buscar por nome..." value={search} onChange={...} /><ul role="radiogroup" className="space-y-1 max-h-64 overflow-y-auto">{filtered.map(d => <li key={d.id}><label className={cn("flex items-center gap-2 p-2 rounded border", d.count >= 12 && "opacity-50 cursor-not-allowed")}><input type="radio" name="selected" value={d.id} disabled={d.count >= 12} checked={selectedId === d.id} onChange={() => setSelectedId(d.id)} /><span className="flex-1">{d.nome}</span><span className="text-sm text-slate-500">{d.count}/12</span>{d.count >= 12 && <Badge tone="warning">Limite</Badge>}</label></li>)}</ul></Form></Dialog>`.

### T6. Criar `<CadeiaDiscipulado>`

- **Path:** `app/components/CadeiaDiscipulado.tsx`
- **Props:** `cadeia: { id, nome }[]` (do mais alto para o mais baixo).
- **Estrutura:** `<ol className="flex flex-wrap items-center gap-1 text-sm">{cadeia.map((m, i) => <li key={m.id} className="flex items-center gap-1"><Link to={`/app/membros/${m.id}`} className="text-cyan-700 hover:underline">{m.nome}</Link>{i < cadeia.length - 1 && <span className="text-slate-400">→</span>}</li>)}</ol>`.

### T7. Criar `<ListaDiscipulos>`

- **Path:** `app/components/ListaDiscipulos.tsx`
- **Props:** `discipulos: Membro[]`, `onDesvincular: (id) => void` (recebe função que submete form).
- **Estrutura:** `<ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">{discipulos.map(d => <li key={d.id} className="flex items-center justify-between px-4 py-2"><Link to={`/app/membros/${d.id}`} className="text-cyan-700 hover:underline">{d.nome}</Link><Form method="post"><input type="hidden" name="intent" value="unassign" /><input type="hidden" name="membroId" value={d.id} /><Button type="submit" variant="ghost" size="sm">Desvincular</Button></Form></li>)}</ul>`.

### T8. Criar `<DiscipuladoPainel>`

- **Path:** `app/components/DiscipuladoPainel.tsx`
- **Props:** `membro`, `discipuladorAtual`, `discipulosDoDiscipulador`, `cadeia`, `discipuladoresDisponiveis`, `canEdit`.
- **Estrutura:**
  - Se `!discipuladorAtual`: card vazio com botão "Vincular a um discipulador" (abre modal).
  - Senão: card com nome do discipulador + `<ContadorDiscipulos atual={count} />` + botões "Reatribuir" / "Desvincular".
  - `<CadeiaDiscipulado cadeia={cadeia} />` (sempre que houver cadeia).
  - Se `discipuladorAtual` e `discipulosDoDiscipulador.length > 0`: `<ListaDiscipulos ... />` (com `onDesvincular`).
- **Modal controlado por `useState`:** `const [modalOpen, setModalOpen] = useState(false)`.

### T9. Criar `app/routes/app/membros.$id.discipulado.tsx`

- **Path:** `app/routes/app/membros.$id.discipulado.tsx`
- **Loader:**
  - `getMembroById(id, user)` (escopo).
  - `getDiscipuladoData(membroId, user)` (dados específicos).
  - Retorna `{ ... }`.
- **Action:**
  - `intent === "assign"`: chama `assignDisciple(discId, discipuladorId, user)`. Redirect para a mesma página.
  - `intent === "unassign"`: chama `unassignDisciple(discId, user)`. Redirect.
  - Captura `BusinessRuleError` e retorna erro estruturado.
- **Default export:** `<PageHeader title="Discipulado" breadcrumb={<Breadcrumb items={[{label:"Membros", href:"/app/membros"}, {label: membro.nome, href:`/app/membros/${membro.id}`}, {label:"Discipulado"}]} />} /><DiscipuladoPainel ... />`.

## Validações e regras

- **Zod:** valida `discipuladorId` no `assign`.
- **Trava 12:** sempre no service (camada 3).
- **Anti-loop:** sempre no service (camada 3).
- **Auto-vínculo:** sempre no service (camada 3).
- **UI disabled** para discipuladores no limite (UX), mas service revalida (segurança).

## Testes (TDD)

### T9.1. Teste do `assignDisciple` (integration, crítico)

- **Boundary 1-12:** criar 12 discípulos vinculados ao discipulador. Tentar o 13º → throw com mensagem.
- **Auto-vínculo:** discId === discipuladorId → throw.
- **Loop:** A→B→A → throw.
- **Sucesso:** 1-12 funciona.

### T9.2. Teste do `isDescendantOf` (unit, mock)

- Cadeia: A → B → C. `isDescendantOf(C, A)` → true. `isDescendantOf(A, C)` → false.

### T9.3. Teste E2E — `e2e/discipulado.spec.ts`

- Login como DISCIPULADOR → 12 discípulos vinculados → tentar 13º → 422 com mensagem.
- Bypass via DevTools: chamar action direta com 13º → mesma resposta.
- Reatribuir: transfere sem precisar desvincular antes.
- Desvincular: contador decrementa.

## Critérios de pronto

- [ ] Cobertura ≥ 85% (especialmente o service — 100%).
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] **Teste do boundary 12/13 passa** (gate `qa-gate`).
- [ ] Modal tem foco preso.
- [ ] `pnpm typecheck` passa.
- [ ] Cadeia renderiza para profundidade 1-5 (testar com mock).

## Armadilhas comuns (RAGs)

- **RAG `security-rbac-matrix.md` §2 (RN-MEM-04):** trava de 12 é regra de **negócio**, não de banco. Vai no service. **Testar 12 passa, 13 falha.**
- **RAG `architecture-monolith-modular.md`:** `isDescendantOf` é função recursiva pura. **Testar sem DB** (mock).
- **AGENTS §"YAGNI":** NÃO criar "árvore visual" com SVG (complexidade desnecessária). Breadcrumb textual com setas basta.
- **Erro comum:** anti-loop só no frontend. **Service precisa revalidar** (defesa em profundidade).
- **Erro comum:** modal sem foco preso. Usuário com Tab sai do modal e fica "perdido". Implementar `useFocusTrap`.
- **Erro comum:** contador mostra `atual + 1` quando vai atribuir (incluindo o próprio). Sempre excluir o próprio da contagem.
