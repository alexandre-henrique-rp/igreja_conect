# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Equipe interna de uma igreja local, em três situações de uso, todas confirmadas:
- Secretaria e financeiro, no computador, em rotina administrativa (cadastros, lançamentos, relatórios).
- Pastor e liderança, principalmente no celular, consultando e decidindo em movimento.
- Líderes de ministério e discipuladores, acompanhando seus membros e escalas, com acesso restrito ao próprio escopo.

Perfis (enum `Cargo`): ADMIN, PASTOR, FINANCEIRO, SECRETÁRIO(A), DISCIPULADOR, LÍDER DE MINISTÉRIO. Não há acesso público de membros comuns; o uso é por quem administra e lidera.

## Product Purpose
ERP que ajuda na organização de uma igreja: membros, discipulado, ministérios, escalas, cultos, finanças (multicaixas), estoque, patrimônio, células, eventos e alertas. Sucesso é a equipe resolver rotinas administrativas e pastorais num só lugar, com dados corretos e sem planilhas paralelas.

## Positioning
Um ERP específico para a rotina de igreja, não um sistema genérico: regras do contexto eclesiástico embutidas (discipulado com máximo de 12 por líder, acolhimento de visitantes, escalas por ministério, travas de saldo entre caixas). Atende uma única igreja por enquanto; multi-igreja não é objetivo atual.

## Operating Context
- Acesso por papel, em 3 camadas (UI, loader/action, service). Fonte única: `app/lib/rbac.server.ts`.
- Regras de negócio numeradas (RN-XXX) em `docs/REGRAS_DE_NEGOCIO.md`; matriz de módulos em `docs/DESCRIÇÃO_DOS_MODULOS.md`.
- Dízimos visíveis só para ADMIN, PASTOR e FINANCEIRO (RN-MEM-03, LGPD). IPs guardados como SHA-256.

## Capabilities and Constraints
- Valores monetários em centavos (Int), nunca Float/Decimal.
- Transferências entre caixas são idempotentes (UUID v4).
- Stack existente: React Router 7 SSR, Prisma + SQLite, Tailwind v4, design system próprio em `app/components/ds/`.
- Idioma da interface: português do Brasil.
- Em aberto: uso offline ou conexão fraca não foi confirmado.

## Brand Commitments
Tom mais administrativo do que pastoral: claro, objetivo, funcional. Nome do produto: Igreja Conect. Não há logo ou voz adicional declarados como obrigatórios.

## Evidence on Hand
Documentação interna em `docs/`. Não há depoimentos, métricas de uso ou pesquisa com usuários; não inventar.

## Product Principles
1. Clareza antes de enfeite: é uma ferramenta de trabalho, escaneável e previsível.
2. Funciona bem no desktop e no celular, pois o pastor e os líderes usam o celular.
3. Mostrar a cada perfil só o que ele pode ver e fazer; privacidade financeira é inegociável.
4. Prevenir erro em dinheiro e vínculos (travas, confirmações, idempotência) em vez de corrigir depois.
5. Linguagem direta, em português, sem jargão técnico.

## Accessibility & Inclusion
Sem requisito formal declarado. Conexão fraca e acessibilidade para usuários mais velhos não foram confirmadas: tratar como pontos em aberto, com contraste e alvos de toque adequados por padrão.
