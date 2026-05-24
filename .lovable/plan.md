# Tela Tarefas — Topo mais clean

Reorganizar apenas a área superior do `TasksPanel.tsx`. Sem mexer em RLS, queries, lógica de filtros ou agrupamento por data — toda a lógica já existe e continua respeitando `workspace_id` e permissões.

## 1. Nova ordem do topo

```
┌────────────────────────────────────────────┐
│  Header (vem do Index.tsx — já existe)     │
├────────────────────────────────────────────┤
│  ➕  Nova tarefa..............  [Configurar]│  ← destaque
├────────────────────────────────────────────┤
│  🔍 Buscar   📅  ●  🚩  👁‍🗨   │ ▦ ▤ ▣ ▥     │  ← filtros compactos
├────────────────────────────────────────────┤
│  Lista agrupada por data (inalterada)      │
└────────────────────────────────────────────┘
```

- Mover o bloco "New task" (linhas 900–925) para **logo abaixo do header**, antes da toolbar.
- Mover a toolbar de filtros (linhas 749–883) para **logo abaixo** do input.
- Lista agrupada por data permanece igual.

## 2. Filtros em ícones (somente ícones + tooltip)

Substituir os `<Select>` de Status e Prioridade por botões-ícone com `Popover`, mantendo o mesmo estado (`statusFilter`, `priorityFilter`) e mesma lógica de filtragem:

| Filtro | Ícone (lucide) | Tooltip |
|---|---|---|
| Status | `Circle` | "Filtrar por status" |
| Data | `Calendar` (já existe) | "Filtrar por data" |
| Prioridade | `Flag` | "Filtrar por prioridade" |
| Ocultar por status | `EyeOff` (já existe) | "Ocultar tarefas por status" |

- Todos os botões: mesmo tamanho (`h-9 w-9`, ícone `h-4 w-4`), `variant="outline"`.
- Estado ativo (filtro aplicado): borda mais forte (`border-foreground/40`) + badge contador quando aplicável.
- Busca permanece como input (foi pedido para manter integrada, só compactar visual).
- View switcher (lista/tabela/cards/kanban) permanece à direita.

## 3. Popover "Ocultar por status"

Já existe e funciona (linhas 792–846). Apenas:
- Trocar o botão por ícone puro (`EyeOff`, sem texto "Ocultar status").
- Manter checkboxes para `pendente`, `fazendo`, `aguardando`, `feita`, `cancelada` (já vem de `TASK_STATUS`).
- Manter botão "Mostrar todos" como "Limpar ocultações".
- Manter badge com contador quando `hiddenStatuses.length > 0`.

## 4. Popover novo "Filtrar por status" (Circle)

- Lista de status com radio/itens clicáveis: `Todos` + cada item de `TASK_STATUS` com pill colorida.
- Seta `statusFilter`. Quando ≠ `"todos"`, botão fica com borda destacada e mostra a pill do status escolhido no canto (mini bolinha colorida) — sem texto longo.

## 5. Popover novo "Filtrar por prioridade" (Flag)

- Mesmo padrão: `Todas` + itens de `PRIORITIES` com cor.
- Estado ativo idem.

## 6. Layout / responsividade

- Toolbar com `flex flex-wrap gap-1.5` para quebrar em telas pequenas.
- Input "Nova tarefa" mantém `rounded-lg border bg-card` para ficar como bloco com destaque maior que a linha de filtros.
- Linha de filtros usa botões `h-9` discretos para não competir visualmente com o input.

## Aspectos técnicos

- Arquivo único: `src/components/TasksPanel.tsx`.
- Sem mudanças em schema, RLS, hooks, `useWorkspace`, ou em qualquer outra tela.
- Estados reutilizados como estão: `search`, `statusFilter`, `priorityFilter`, `dateFilter`, `hiddenStatuses`.
- `useMemo filtered` (linhas 211–221) não muda — todos os filtros já operam em conjunto.
- Persistência de `hiddenStatuses` em localStorage permanece.
- Imports a adicionar: `Circle`, `Flag` de `lucide-react`.
