# Reordenar perguntas por arrastar

Permitir reordenar as perguntas no editor de formulário arrastando-as para cima/baixo. A nova ordem persiste e passa a valer no formulário público e na visualização de respostas.

## Mudanças

### 1. Biblioteca de drag-and-drop
- Adicionar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (mesma stack já recomendada para shadcn, leve e acessível).

### 2. Editor de formulário (`src/components/forms/FormsPanel.tsx`)
- Envolver a lista de campos (linha ~505) em `DndContext` + `SortableContext` com estratégia vertical.
- Cada card de campo vira um `SortableItem`:
  - Adicionar um handle visível à esquerda (ícone `GripVertical` do lucide) com cursor `grab` / `grabbing`.
  - Apenas o handle inicia o drag — inputs e selects dentro do card seguem funcionando normalmente.
- Ao soltar (`onDragEnd`):
  - Reordenar localmente (`arrayMove`) para feedback imediato.
  - Recalcular `position` (0..n-1) e persistir em lote: `UPDATE form_fields SET position=… WHERE id=…` para cada item alterado.
  - Em caso de erro, recarregar do banco e mostrar toast.

### 3. Lógica condicional
- A regra atual ("uma pergunta só pode condicionar-se a uma anterior") continua válida. Após reordenar:
  - Detectar condições que passaram a referenciar um campo posicionado depois e limpá-las (setar `conditional_logic = null`), avisando com toast: "Algumas condições foram removidas porque a pergunta de origem ficou abaixo."
  - Já existe helper de avaliação em `src/lib/formConditions.ts`; só usar para localizar quebras.

### 4. Formulário público (`src/pages/PublicForm.tsx`)
- Já ordena por `position` ascendente — nada a mudar. Confirmar comportamento após reorder.

### 5. Visualização de respostas (`src/components/requests/RequestsPanel.tsx`)
- Hoje renderiza `Object.entries(open.data)` na ordem do JSON. Carregar `label` + `position` dos `form_fields` do formulário aberto e renderizar as respostas seguindo a ordem das perguntas (chaves desconhecidas vão ao final).
- Aplicar a mesma ordem em `formatData` (cópia/clipboard).

## Detalhes técnicos
- IDs estáveis para `SortableContext`: `fields.map(f => f.id)`.
- Animação curta (`transition: transform 150ms`).
- Handle com `aria-label="Reordenar pergunta"` e suporte a teclado (dnd-kit já cobre setas + espaço).
- Persistência: usar `Promise.all` apenas para os IDs cuja `position` mudou.
- Sem migrações de banco; coluna `position` já existe em `form_fields`.

## Fora de escopo
- Reordenar opções dentro de um campo select/multi-select.
- Reordenar respostas individualmente (a ordem segue as perguntas).
