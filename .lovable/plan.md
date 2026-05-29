# Melhorias de visualização das tarefas

Tudo será feito em `src/components/TasksPanel.tsx`, preservando estilo atual do Ambitask, sem alterar dados nem comportamentos de outras telas.

## 1. Modo Lista mais limpo e executivo

Em `renderListRow`, a linha exibirá apenas:

- chevron discreto (só quando houver subtarefas);
- checkbox de conclusão;
- título da tarefa;
- pequeno indicador de progresso `x/y` quando houver subtarefas/processo vinculado (texto leve, sem barra colorida);
- menu de ações (`RowActions`).

Serão **removidos** da linha do modo Lista: `PriorityPill`, `StatusPill`, `DueDate` e demais metadados visuais.

A linha inteira (área do título + espaço vazio) vira clicável:

- se a tarefa tem subtarefas → alterna expand/collapse;
- se não tem → clique não faz nada (cursor permanece padrão);
- duplo clique no título continua iniciando edição;
- checkbox, chevron e menu de ações continuam com handlers próprios (`stopPropagation`) para não disparar o expand.

Hover da linha quando expansível ganha leve destaque (cursor pointer + reforço do `hover:bg-secondary/60` existente + chevron mais visível). Quando não houver subtarefas, o chevron permanece `invisible` e o hover continua neutro.

A altura da linha permanece a atual (`py-1.5`).

## 2. Indicadores configuráveis nos modos Tabela, Cards e Kanban

Será criada uma preferência por usuário/workspace com a lista de indicadores visíveis:

```ts
type TaskIndicator =
  | "priority" | "status" | "due" | "progress" | "assignee" | "tags";
```

Indicadores realmente disponíveis hoje no projeto: `priority`, `status`, `due`, `progress`. `assignee` e `tags` serão incluídos no menu apenas se já existirem no schema atual; caso contrário ficam fora desta entrega para não inventar dados.

Padrões iniciais:

- Tabela: todos ativos.
- Cards: `priority`, `status`, `due`, `progress`.
- Kanban: `priority`, `due`, `progress` (status é implícito pela coluna).

Cada modo passa a renderizar condicionalmente cada indicador (colunas da tabela, chips do card, badges no kanban). Quando um indicador está desativado, ele não renderiza nada — sem espaço vazio, sem coluna fantasma na tabela (o `<TableHead>` e os `<TableCell>` correspondentes são omitidos).

## 3. Botão "olho" na barra de filtros

Na barra existente em `~l.794`, junto aos botões de Data/Status/Prioridade/ViewSwitcher, será adicionado um `Popover` com gatilho `Button` `variant="outline" size="sm" h-9 w-9` e ícone `Eye` (lucide). Mantém o mesmo padrão visual dos outros botões (incluindo o ponto/contador quando algo está oculto em relação ao padrão).

Conteúdo do popover:

- título pequeno "Indicadores visíveis";
- lista de `Checkbox` com label para cada indicador disponível no modo atual;
- botão "Restaurar padrão" no rodapé.

Comportamento por modo:

- **Lista**: o botão fica **desabilitado** com tooltip "O modo Lista mantém leitura limpa". A lista nunca exibe os indicadores via olho — regra do item 1 prevalece.
- **Tabela / Cards / Kanban**: o popover edita a preferência do modo ativo, e a UI reage imediatamente.

## 4. Persistência

Será criado um helper de preferência por modo:

```ts
// chave: `tasksIndicators:${view}`
// valor: TaskIndicator[]
```

Persistido em `localStorage` no mesmo estilo do `lsGet/lsSet` já usados (`tasksView`, `tasksVisibleStatuses`). Sem migração no banco, sem efeito em dados reais.

A preferência de `view` já é persistida hoje — continua igual.

## 5. Cuidado visual

- Reuso integral dos componentes existentes (`StatusPill`, `PriorityPill`, `ProgressBadge`, `DueDate`) — só envolvidos em `show.<indicator> && (...)`.
- Sem novos tokens de cor; sem aumento de altura de linha.
- Ícone `Eye` em `h-4 w-4`, idêntico aos demais.
- Popover usa o mesmo layout dos popovers de filtro já presentes.

## Detalhes técnicos

Arquivos alterados:

- `src/components/TasksPanel.tsx`
  - `renderListRow`: remover pills/data, tornar contêiner clicável condicional, manter `stopPropagation` nos controles internos, simplificar `ProgressBadge` para texto `x/y` quando em modo lista.
  - Adicionar estado `indicators: Record<ViewMode, TaskIndicator[]>` carregado/persistido em `localStorage`.
  - Adicionar `IndicatorsButton` (popover com checkboxes) na barra de filtros.
  - Em `renderTableRow`, `renderCard`, `renderKanbanCard` (ou equivalentes existentes nesta tela), envolver cada indicador com `show.priority`, `show.status`, `show.due`, `show.progress`.
  - Para a Tabela, também condicionar `<TableHead>` correspondente para não deixar coluna vazia.

Nada será alterado em schema, RLS, edge functions, ou em outros painéis (`TodayPanel`, `RequestsPanel`, etc.).
