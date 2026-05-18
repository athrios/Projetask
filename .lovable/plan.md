## Objetivo
Tornar a coluna de horários do Cronograma uma cascata automática: cada linha começa exatamente quando a anterior termina. Remover o "→ HH:MM" visual e eliminar horário manual nas linhas seguintes.

## Mudanças em `src/components/SchedulePanel.tsx`

### 1. Cálculo em cascata dos horários
- Calcular um array `computedStarts[]` derivado dos `items` ordenados por `position`:
  - `computedStarts[0] = items[0].start_time` (ou `DAY_START` se vazio).
  - `computedStarts[i] = computedStarts[i-1] + items[i-1].duration_minutes`.
- Passar `computedStarts[i]` para cada `ScheduleRow` como `start`.
- Placeholders continuam a partir de `lastEnd` (já é o comportamento atual, mantido).

### 2. Edição de horário
- Somente a primeira linha (`index === 0`) renderiza o `Input type="time"` editável → chama `onChangeStart`.
- Linhas seguintes mostram o horário como texto somente-leitura (mesmo tamanho/estilo `w-[100px]`), sem input.

### 3. Atualização da duração com recalculo persistido
- Ao alterar `duration_minutes` (ou `start_time` da linha 1), recalcular todos os `start_time` subsequentes e persistir via um único batch:
  - Aplicar update otimista em `items` no estado local imediatamente.
  - Disparar `supabase.from('schedule_items').update({ start_time }).eq('id', ...)` para cada linha cujo horário mudou (Promise.all).
  - Em erro, recarregar do banco e mostrar toast.
- Mesma cascata roda após `insertItem` e `remove` (para garantir consistência).

### 4. Layout
- Remover o `<span>→ {end}</span>` em `ScheduleRow` e em `PlaceholderRow`.
- Linhas seguintes: substituir o `<Input type="time">` por `<div className="h-8 w-[100px] text-xs flex items-center px-2 text-muted-foreground tabular-nums">{start}</div>`.

### 5. Persistência
- Horários recalculados são salvos no banco, então recarga da página mantém a cascata correta.
- A reordenação continua por `position`/`start_time` (manter `order by start_time` no `load`).

## Critério de aceite coberto
- Linha 1 09:00, dur 15 → Linha 2 vira 09:15 automaticamente, salvo no banco.
- Alterar duração da Linha 1 para 60 min → Linha 2 vira 10:00, Linha 3/4 recalculam em sequência.
- Importar/adicionar/remover dispara recalc.
- Setinha `→ HH:MM` removida do layout.

## Fora do escopo
Sem mudanças no schema, sem mexer em outros painéis.
