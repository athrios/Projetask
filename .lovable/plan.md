## Problema
A tabela `tasks` tem um CHECK constraint legado `tasks_status_check` que só aceita `pendente | fazendo | feita`. O app, porém, usa também `aguardando` e `cancelado` (validados pelo trigger `validate_task_priority`). Por isso, ao marcar uma tarefa como "Aguardando", o banco rejeita com `tasks_status_check`.

## Correção (migração)
Remover o constraint defasado para que a validação fique a cargo do trigger existente, que já cobre todos os status válidos.

```sql
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
```

Verificar também (e remover se existir o mesmo problema) constraints equivalentes em:
- `public.subtasks` (status)
- `public.schedule_items` (status)
- `public.processes` (status)
- `public.process_steps` (status)
- `public.form_responses` (status)

Apenas constraints redundantes/desatualizados são removidos; os triggers `validate_*_status` permanecem como fonte única de verdade.

## Fora do escopo
Nenhuma mudança de código no frontend.
