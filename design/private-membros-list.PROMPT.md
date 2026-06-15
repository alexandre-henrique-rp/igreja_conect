# Lista de Membros — Frontend Implementation Prompt

## Capability grant (paths allowlist do agent)

- **Paths de escrita:**
  - `app/routes/app/membros._index.tsx`
  - `app/components/FiltrosMembros.tsx`
  - `app/components/Select.tsx`
  - `app/components/TabelaMembros.tsx`
  - `app/components/CardMembro.tsx`
  - `app/components/Pagination.tsx`
  - `app/components/PageHeader.tsx`
  - `app/lib/members.server.ts` (service `listMembros`)
- **Paths de leitura:** PRD, SPEC, AGENTS, ARCH, RAGs, `prisma/schema.prisma`, `design/private-membros-list.DESIGN.md`.
- **Boundary:** não tocar em auth/rbac server files além de consumir.

## Contexto

Tela principal do Módulo de Membros — lista com filtros e busca.

- **Design detalhado:** [`design/private-membros-list.DESIGN.md`](./private-membros-list.DESIGN.md)
- **PRD:** US-MEM-003.
- **SPEC:** §6.1 (listar com filtros).
- **RAG `security-rbac-matrix.md`:** RBAC fina no service.
- **RAG `lgpd-igreja-conect.md`:** `senhaHash` nunca exposto.

## Tarefas

### T1. Criar `<PageHeader>`

- **Path:** `app/components/PageHeader.tsx`
- **Props:** `title: string`, `action?: ReactNode`, `breadcrumb?: ReactNode`.
- **Estrutura:** `<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"><div><h1 className="text-2xl font-bold text-slate-900">{title}</h1>{breadcrumb && <div className="mt-1">{breadcrumb}</div>}</div>{action && <div>{action}</div>}</div>`.

### T2. Criar `<Select>`

- **Path:** `app/components/Select.tsx`
- **Props:** `name: string`, `value?: string`, `defaultValue?: string`, `onChange?: (e) => void`, `options: { value: string, label: string }[]`, `placeholder?: string`, `label?: string`, `className?: string`.
- **Estrutura:** `<div>{label && <label htmlFor={id} className="text-sm font-medium text-slate-700 block mb-1">{label}</label>}<select id={id} name={name} defaultValue={defaultValue} className={cn("h-11 px-3 pr-8 rounded-md border border-slate-300 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2", className)}>{placeholder && <option value="">{placeholder}</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>`.

### T3. Criar `<FiltrosMembros>`

- **Path:** `app/components/FiltrosMembros.tsx`
- **Props:** `defaultValues: { tipo?: string, ministerioId?: string, discipuladorId?: string, q?: string }`, `ministerios: { id, nome }[]`, `discipuladores: { id, nome }[]`.
- **Estrutura:** `<Form method="get" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"><Input name="q" placeholder="Buscar por nome..." defaultValue={defaultValues.q} /><Select name="tipo" defaultValue={defaultValues.tipo ?? ""} options={[{value:"VISITANTE",label:"Visitantes"},{value:"CONGREGADO",label:"Congregados"},{value:"MEMBRO_ATIVO",label:"Membros ativos"}]} placeholder="Todos os tipos" /><Select name="ministerioId" defaultValue={defaultValues.ministerioId ?? ""} options={ministerios.map(m => ({value:m.id,label:m.nome}))} placeholder="Todos os ministérios" /><Select name="discipuladorId" defaultValue={defaultValues.discipuladorId ?? ""} options={discipuladores.map(d => ({value:d.id,label:d.nome}))} placeholder="Todos os discipuladores" /><div className="flex gap-2"><Button type="submit" variant="primary">Filtrar</Button><Button as={Link} to="/app/membros" variant="ghost">Limpar</Button></div></Form>`.

### T4. Criar `<TabelaMembros>`

- **Path:** `app/components/TabelaMembros.tsx`
- **Props:** `items: MembroListItem[]` (tipo: `{ id, nome, tipo, discipulador: { nome } | null, ministerios: { nome }[] }`), `canEdit: boolean`.
- **Estrutura:** `<div className="border border-slate-200 rounded-lg overflow-hidden hidden md:block"><table className="w-full"><caption className="sr-only">Lista de membros</caption><thead className="bg-slate-50 text-left text-xs uppercase text-slate-600"><tr><th scope="col" className="px-4 py-2">Nome</th><th scope="col" className="px-4 py-2">Tipo</th><th scope="col" className="px-4 py-2">Discipulador</th><th scope="col" className="px-4 py-2">Ministérios</th><th scope="col" className="px-4 py-2 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-200">{items.map(m => <tr key={m.id} className="hover:bg-slate-50"><td className="px-4 py-2"><Link to={`/app/membros/${m.id}`} className="text-cyan-700 hover:underline font-medium">{m.nome}</Link></td><td className="px-4 py-2"><BadgeTipo tipo={m.tipo} /></td><td className="px-4 py-2 text-slate-700">{m.discipulador?.nome ?? "—"}</td><td className="px-4 py-2 text-slate-700 text-sm">{m.ministerios.map(mm => mm.nome).join(", ") || "—"}</td><td className="px-4 py-2 text-right"><Link to={`/app/membros/${m.id}`} aria-label={`Ver ${m.nome}`} className="p-1 inline-block"><EyeIcon /></Link>{canEdit && <Link to={`/app/membros/${m.id}/editar`} aria-label={`Editar ${m.nome}`} className="p-1 inline-block ml-1"><PencilIcon /></Link>}</td></tr>)}</tbody></table></div>`.
- **Componente auxiliar `<BadgeTipo>`:** retorna cor por tipo: `VISITANTE` = `bg-amber-100 text-amber-800`, `CONGREGADO` = `bg-blue-100 text-blue-800`, `MEMBRO_ATIVO` = `bg-green-100 text-green-800`.

### T5. Criar `<CardMembro>` (mobile)

- **Path:** `app/components/CardMembro.tsx`
- **Props:** mesmas de `<TabelaMembros>` items + canEdit.
- **Estrutura:** `<div className="md:hidden space-y-3">{items.map(m => <article key={m.id} className="border border-slate-200 rounded-lg bg-white p-4"><h3><Link to={`/app/membros/${m.id}`} className="font-medium text-cyan-700">{m.nome}</Link></h3><p className="text-sm text-slate-600 mt-1"><BadgeTipo tipo={m.tipo} /> • {m.discipulador?.nome ?? "Sem discipulador"}</p>{m.ministerios.length > 0 && <p className="text-sm text-slate-600 mt-2">Ministérios: {m.ministerios.map(mm => mm.nome).join(", ")}</p>}<div className="flex gap-2 mt-3">{canEdit && <Button as={Link} to={`/app/membros/${m.id}/editar`} variant="secondary" size="sm">Editar</Button>}<Button as={Link} to={`/app/membros/${m.id}`} variant="ghost" size="sm">Ver</Button></div></article>)}</div>`.

### T6. Criar `<Pagination>`

- **Path:** `app/components/Pagination.tsx`
- **Props:** `current: number`, `total: number` (total de páginas), `basePath: string`, `searchParams?: URLSearchParams` (preserva filtros).
- **Estrutura:** se `total <= 1`, retorna null. Senão: `<nav aria-label="Paginação" className="flex items-center justify-between gap-2 mt-4"><p className="text-sm text-slate-600">Página {current} de {total}</p><ol className="flex gap-1">{current > 1 && <li><Link to={buildHref(current - 1)}>‹ Anterior</Link></li>}{renderPageNumbers(current, total).map(p => <li><Link to={buildHref(p)} className={p === current ? "font-bold text-cyan-700" : ""}>{p}</Link></li>)}{current < total && <li><Link to={buildHref(current + 1)}>Próxima ›</Link></li>}</ol></nav>`.

### T7. Criar `app/lib/members.server.ts` (service)

- **Path:** `app/lib/members.server.ts`
- **Função principal:** `listMembros(filter: ListMembrosFilter, user: SessionUser): Promise<{ items: MembroListItem[], total: number, page: number, pageSize: number }>`.
- **Lógica:**
  - Monta `where` Prisma.
  - Normaliza `q`: `q.trim().slice(0, 100)` + remove acentos com `String.prototype.normalize("NFD").replace(/[\u0300-\u036f]/g, "")`.
  - RBAC fina:
    - Se `user.cargo === "DISCIPULADOR"`: força `where.discipuladorId = user.id` (independente do filtro do usuário).
    - Outros perfis: sem restrição.
  - Faz `findMany` paginado + `count` em paralelo.
  - Retorna items com `MEMBRO_SAFE_SELECT` (sem `senhaHash`).
  - **JSDoc completo** (obrigatório).
- **Tipos auxiliares:** `MembroListItem`, `ListMembrosFilter` em `app/lib/types.ts` ou no próprio arquivo.

### T8. Criar `app/routes/app/membros._index.tsx`

- **Path:** `app/routes/app/membros._index.tsx`
- **Loader:**
  - Lê search params: `tipo`, `ministerioId`, `discipuladorId`, `q`, `page`, `pageSize`.
  - Valida com Zod (limit pageSize a 100).
  - Chama `listMembros(filter, user)`.
  - Carrega `ministerios` e `discipuladores` (para popular filtros).
  - Retorna `{ items, total, page, pageSize, ministerios, discipuladores, filterValues }`.
- **Default export:**
  - `<PageHeader title="Membros" action={<Button as={Link} to="/app/membros/novo" variant="primary">+ Novo membro</Button>} />`.
  - `<FiltrosMembros defaultValues={filterValues} ministerios={ministerios} discipuladores={discipuladores} />`.
  - Condicional: se `items.length === 0`, `<EmptyState .../>`. Senão `<TabelaMembros items={items} canEdit={canEdit} />` e `<CardMembro items={items} canEdit={canEdit} />` (1 renderiza, outro hidden).
  - `<Pagination current={page} total={Math.ceil(total / pageSize)} basePath="/app/membros" searchParams={searchParams} />`.

## Validações e regras

- **Zod (search params):** página, pageSize opcionais com defaults 1 e 25.
- **Sanitização de `q`:** trim, slice, normalize.
- **RBAC:** service aplica escopo.

## Testes (TDD)

### T8.1. Teste do `listMembros` (integration)

- Cria 3 membros (1 VISITANTE, 1 CONGREGADO, 1 MEMBRO_ATIVO). Chama `listMembros({tipo: "VISITANTE"}, adminUser)`. Espera 1 item.
- Mesmo com `DISCIPULADOR` logado, se não é o discipulador, vê 0 (ou vê só os dele).

### T8.2. Teste de normalização de acentos

- Cria 2 membros: "João" e "Maria". `listMembros({q: "joao"}, user)` retorna "João".

### T8.3. Teste E2E (Playwright) — `e2e/membros-list.spec.ts`

- Login → `/app/membros` → vê 3 membros.
- Filtra por `tipo=VISITANTE` → vê 1.
- Busca por "joao" → acha "João" (com acento).
- Pagina para página 2 → vê os próximos.
- Click no nome → navega para detalhe.

## Critérios de pronto

- [ ] Cobertura ≥ 85%.
- [ ] Lighthouse Accessibility ≥ 95.
- [ ] `pnpm typecheck` passa.
- [ ] `senhaHash` nunca em payload (grep).
- [ ] Filtros preservam ao paginar.
- [ ] Mobile (375px) mostra cards sem scroll horizontal.

## Armadilhas comuns (RAGs relevantes)

- **RAG `security-rbac-matrix.md`:** RBAC fina no service, não só na UI. `DISCIPULADOR` recebe apenas seus discípulos.
- **RAG `lgpd-igreja-conect.md` §2.5:** `safeLog` em queries lentas. **Não** logar emails de membros.
- **RAG `convention-prisma-sqlite.md`:** `findMany` + `count` em paralelo via `Promise.all`. Não fazer 2 queries em loop.
- **AGENTS §"YAGNI":** NÃO criar sort UI. NÃO criar filtros avançados (cidade, faixa etária, etc.). 4 filtros são suficientes.
- **Erro comum:** `q` com `%` ou `_` quebra o `LIKE` do SQLite. Prisma escapa, mas normalize para garantir.
- **Erro comum:** empty state para "filtro sem resultado" idêntico ao "sistema novo". São diferentes — o segundo tem CTA grande, o primeiro tem botão "Limpar".
