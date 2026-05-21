## 1. Cronograma — horário inicial sempre configurável

Hoje só dá para editar o horário quando já existe pelo menos uma tarefa na primeira linha. Antes disso, o primeiro placeholder mostra `09:00` fixo.

Mudança em `src/components/SchedulePanel.tsx`:

- No `PlaceholderRow`, quando for o primeiro placeholder visível **e** ainda não houver itens reais (`items.length === 0`), trocar o `<div>` somente-leitura do horário por um `<Input type="time">` editável (mesmo padrão visual da primeira linha do `ScheduleRow`).
- O valor digitado é mantido em estado local do placeholder; quando o usuário criar a primeira tarefa (digitar título e sair do campo, ou importar tarefa), esse horário é passado para `onCommit` e vira o `start_time` do primeiro `schedule_item`, alimentando o cascade normal.
- Passar uma prop `editableStart: boolean` do pai (`SchedulePanel`) — `true` apenas para o índice `0` quando `items.length === 0`. Os demais placeholders seguem como hoje.
- Nenhuma mudança de schema: o horário só é persistido quando a primeira linha for criada (igual ao fluxo atual). Isso atende "independente de ter preenchido tarefa": o campo fica disponível antes do preenchimento, e o valor é usado no momento do insert.

## 2. Processos — status da etapa atual nos cards

Em `src/components/processes/ProcessesPanel.tsx`, dentro de `ProcessCard`, na linha "Etapa atual":

- Já existe a variável `current` (próxima etapa em andamento/pendente). Adicionar ao lado do título o `StatusPill` da etapa, em tamanho `xs` e somente leitura:

  ```tsx
  <StatusPill domain="process_step" value={current.status} size="xs" />
  ```

- Layout: manter `ChevronRight` + "Etapa atual:" + título truncado + pílula de status alinhada à direita do bloco (ou logo após o título, com `shrink-0`).
- Sem mudanças em dados — `current.status` já vem carregado em `stepsByProc`.

## Arquivos alterados

- `src/components/SchedulePanel.tsx`
- `src/components/processes/ProcessesPanel.tsx`
