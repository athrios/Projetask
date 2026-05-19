# Modal "Nova tarefa" com configuração completa antes de salvar

## Objetivo
Permitir configurar título, prioridade, prazo, horário, status, observações, subtarefas e alertas antes de criar a tarefa — preservando o input rápido (Enter) atual.

## UX

**Barra de criação (substitui o form atual em `TasksPanel`)**
```
[+] [Nova tarefa  (Enter para adicionar)............] [Configurar] [Adicionar]
```
- Enter no input ou botão `Adicionar` → criação rápida (comportamento atual, sem alterações).
- Botão `Configurar` (ou clique em um botão primário `Nova tarefa` no header) → abre o modal completo, pré-preenchido com o texto já digitado.

**Modal `Nova tarefa`** (componente novo `NewTaskDialog.tsx`)
```
Título            [____________________________]
Prioridade        Prazo
[Média ▼]         [Selecionar data]  [hh:mm]
Status inicial
[Pendente ▼]      (apenas pendente / fazendo / aguardando)
Observações       [textarea curta, opcional]
Subtarefas
  [Digite uma subtarefa] [+]
  • Conferir DBE              [editar] [×]
  • Separar contrato social   [editar] [×]
Alertas
  [+ Adicionar alerta]  (opcional — abre TaskReminderEditor após salvar, ou config inline)
                                          [Cancelar] [Criar tarefa]
```

## Validações
- Título obrigatório (mesmo schema `taskTitleSchema`).
- Subtarefa vazia ignorada (mesmo `subtaskTitleSchema`).
- Prazo, horário, observações opcionais.
- Defaults: prioridade `media`, status `pendente`.
- Cancelar → descarta tudo, nada é persistido.

## Fluxo de persistência (seguro)
1. `INSERT` em `tasks` com todos os campos (workspace_id ativo, user_id, due_date, due_time, priority, status, notes).
2. Capturar `id` retornado.
3. Se houver subtarefas: `INSERT` em lote em `subtasks` com `task_id`, `workspace_id`, `user_id`, `position`.
4. Se o passo 3 falhar: `DELETE` da tarefa criada para evitar registros órfãos + toast de erro.
5. `logActivity` (created task) + recarregar lista. Sem alteração de schema/RLS — políticas existentes já cobrem.

## Alertas (escopo mínimo nesta entrega)
- Para manter o fluxo enxuto, no modal exibir apenas o link "Configurar alerta" — após criar a tarefa, abrir o `TaskReminderEditor` já existente com o `task.id` recém-criado (reaproveita o componente atual, evita duplicar lógica de reminder).
- Se preferir totalmente inline, dá para incluir, mas adiciona complexidade. Default: pós-criação.

## Arquivos a alterar/criar
- **Novo:** `src/components/tasks/NewTaskDialog.tsx` — Dialog com estado local (title, priority, dueDate, dueTime, status, notes, subtasks[]), validação via `safeParse`, e callback `onCreated(taskId)`.
- **Editar:** `src/components/TasksPanel.tsx`
  - Adicionar botão `Configurar` na barra de input e estado `newDialogOpen`.
  - Renderizar `<NewTaskDialog>` com prefill do `title` digitado.
  - No `onCreated`: limpar input, recarregar, abrir opcionalmente `TaskReminderEditor`.
  - Manter `add()` atual inalterado para o fluxo rápido.

## Critérios de aceite
- Botão `Configurar` abre modal; campos preenchem corretamente; `Criar tarefa` persiste tudo de uma vez.
- Subtarefas aparecem vinculadas na lista após criar.
- Falha em subtarefa não deixa tarefa órfã (rollback manual).
- Enter no input continua criando tarefa simples.
- Workspace ativo, RLS e permissões respeitados (usa cliente autenticado e `workspace_id` atual — sem mudanças de banco).

## Sem mudanças
- Sem migration. Sem alteração em edge functions. Sem alteração no `TaskReminderEditor`, `AgendaPanel`, ou outros painéis.
