# Regras de Negócio — Sistema de Gerenciamento Eclesiástico

Este documento reúne as diretrizes operacionais, restrições de segurança e comportamentos automatizados que governam o ecossistema do sistema.

---

## 1. Módulo de Membros e Central de Alertas

### RN-MEM-01 — Perfis de Operação (Escrita)

O cadastro, edição e atualização de membros e visitantes podem ser realizados por qualquer usuário autenticado que possua um dos seguintes papéis no sistema: `ADMIN`, `PASTOR`, `SECRETARIO(A)`, `DISCIPULADOR`, `FINANCEIRO` ou `LIDER_MINISTERIO`.

### RN-MEM-02 — Restrição de Dados Sensíveis e LGPD

* O sistema não coletará dados fiscais invasivos ou excessivos (como CPF), limitando-se ao tratamento de dados de identificação, contato e endereço residencial.
* Os campos `profissao` e `estado_civil` permanecem como opcionais no cadastro básico.

### RN-MEM-03 — Privacidade Estrita do Histórico de Dízimos

O histórico financeiro de dízimos de um membro (valores, datas e formas de pagamento) é considerado informação estritamente confidencial. Apenas os usuários com os perfis **`ADMIN`**, **`PASTOR`** e **`FINANCEIRO`** possuem permissão para visualizar estes dados no perfil do membro. Para os demais perfis, esta aba/componente deve ser completamente omitida ou bloqueada a nível de API.

### RN-MEM-04 — Limitações da Árvore de Discipulado

* Um membro/discípulo pode estar vinculado a apenas **1 (um) discipulador** ativo por vez (relação 1:N).
* Um discipulador pode possuir no máximo **12 (doze) discípulos** sob sua liderança direta simultaneamente. O sistema deve emitir um bloqueio impeditivo caso o operador tente associar o 13º discípulo.

### RN-MEM-05 — Configuração de Acolhimento a Visitantes

O sistema deve disponibilizar uma tela de configurações gerais onde o `ADMIN` definirá um **Membro** ou um **Ministério** responsável padrão pelo acolhimento de novos visitantes.

* Sempre que um novo visitante for cadastrado, uma tarefa/alerta correspondente será injetada no painel desse responsável.

### RN-MEM-06 — Transição Manual de Status

A alteração do tipo de membro (de *Visitante* para *Congregado*, ou de *Congregado* para *Membro Ativo*) será realizada de forma **100% manual** pelos operadores, visto que o sistema não realizará a contabilização automatizada de presença em cultos.

---

## 2. Módulo Financeiro e Fluxo de Caixa

### RN-FIN-01 — Controle por Caixas Flutuantes

O sistema opera baseado no conceito de **Caixas** (dinheiro físico ou saldos internos apartados), abandonando a complexidade de conciliação bancária direta. O sistema deve iniciar nativamente com o *Caixa Geral* ativo como padrão.

### RN-FIN-02 — Rastreabilidade de Transferências entre Caixas

A igreja pode criar múltiplos caixas (ex: *Caixa da Cantina*, *Caixa de Missões*). Toda e qualquer transferência de valores entre caixas deve ser registrada de forma imutável, armazenando:

* Valor transferido.
* Data e hora exata da transação.
* Identificador do usuário que executou a transferência.

### RN-FIN-03 — Autonomia de Aprovação Baseada em Saldo Real

Os operadores com perfil `FINANCEIRO` ou `SECRETARIO(A)` possuem autonomia total para aprovar pedidos de compra, ordens de pagamento e saídas financeiras sem a necessidade de aval explícito do `PASTOR` ou `ADMIN`, **desde que o caixa selecionado possua saldo igual ou superior ao valor do débito**.

### RN-FIN-04 — Trava Abrangente de Saldo Insuficiente

O sistema **bloqueará sumariamente** a aprovação de qualquer saída financeira caso o Caixa selecionado para a operação não possua saldo suficiente para cobri-la. Não será permitida a geração de saldos negativos em caixas individuais.

### RN-FIN-05 — Ofertas Avulsas Anônimas

Fica nativamente permitido o lançamento de receitas da natureza `OFERTA` sem a obrigatoriedade de vínculo a um registro de membro (lançamentos anônimos direto para o caixa). No caso de `DIZIMO`, o vínculo com o membro permanece obrigatório.

---

## 3. Módulo de Estoque e Manutenção

### RN-EST-01 — Escopo Dual do Estoque

O estoque é unificado e centralizado fisicamente, mas deve catalogar e diferenciar logicamente duas categorias de itens:

1. **Itens de Consumo Interno:** Materiais de limpeza, papelaria, insumos para a ceia, etc.
2. **Bens Patrimoniais:** Cadeiras, equipamentos de som, projetores, instrumentos musicais, etc.

### RN-EST-02 — Restrição de Baixa de Consumo

Apenas usuários com perfil **`ADMIN`** e **`SECRETARIO(A)`** possuem permissão para autorizar e registrar a saída de itens de consumo do almoxarifado. É obrigatório informar o nome da pessoa física que retirou o insumo no momento da baixa.

### RN-EST-03 — Fluxo de Manutenção Externa com Alertas Automatizados

Bens patrimoniais que necessitem de reparo externo devem ser transferidos para o status de *Manutenção*, exigindo o preenchimento obrigatório de:

* Endereço físico ou Razão Social da assistência técnica.
* Número da Ordem de Serviço (O.S.), se houver.
* Data limite/prazo de término estimado (Opcional).

### RN-EST-04 — Escalonamento de Alertas de Manutenções Sem Prazo

Caso um item seja enviado para manutenção sem um prazo de término definido, uma rotina automatizada (`cron job`) disparará notificações recorrentes na **Central de Alertas** visível para **todos os usuários** cadastrados no sistema, obedecendo aos seguintes intervalos:

* **Até 30 dias sob manutenção:** O alerta será disparado e renovado a cada **6 (seis) dias**.
* **Após 30 dias sob manutenção:** O intervalo de recorrência cai, e o alerta será disparado a cada **3 (três) dias** cobrando uma resolução do status do equipamento.

### RN-EST-05 — Baixa por Perda Total (Descarte)

Caso um equipamento em manutenção receba um laudo técnico atestando sua inutilidade (perda total), o sistema permitirá que o `ADMIN` realize a baixa definitiva do item por motivo de descarte. Será obrigatório realizar o upload e o arquivamento do documento em anexo (laudo técnico em PDF/imagem) para fins de auditoria patrimonial.
