## Objetivo

Mudar o botão de importação do cronograma para listar **todas as tarefas não concluídas** do workspace atual, independente da data ou do status específico (pendente, fazendo, aguardando etc.) — excluindo apenas `feita` e `cancelado`.

## Comportamento atual

O `ImportButton` no `SchedulePanel` recebe a lista `tasks` do componente pai, que hoje é filtrada pela data do dia visualizado (`task_date = hoje`). Isso esconde tarefas pendentes de outros dias.

## Mudança proposta

1. **`SchedulePanel.tsx`** — Em vez de depender da prop `tasks` (filtrada por data), buscar internamente uma lista própria de tarefas importáveis:
   - Query na tabela `tasks` filtrando por:
     - `workspace_id = workspaceId`
     - `status NOT IN ('feita', 'cancelado')`
     - `done = false`
   - Ordenar por `task_date` ascendente, depois `priority`.
   - Recarregar quando o workspace muda ou após importar/desvincular.

2. **Manter a prop `tasks`** por compatibilidade, mas o `ImportButton` passa a usar a nova lista interna (`importableTasks`).

3. **Opcional (UX)**: mostrar a data da tarefa ao lado do título no dropdown (ex.: "Revisar contrato · 18/05") para o usuário se localizar quando há muitas tarefas de dias diferentes.

## Detalhes técnicos

- Nenhuma mudança de schema, RLS ou backend.
- Nenhum impacto em outras telas — `TodayPanel`/`Index` continuam filtrando por data para suas próprias listagens.
- Tarefas recorrentes-pai (`is_recurring=true` sem instância) seguem a mesma regra de status.
