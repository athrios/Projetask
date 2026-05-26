# Ajuste do card de Processo — exibir etapas resolvidas

Apenas visualização do `ProcessCard` em `src/components/processes/ProcessesPanel.tsx`. Sem mudanças em banco, RLS, fluxo do modal/drawer, lógica de progresso ou permissões.

## Mudanças

1. **Extrair `CopyButton`** para um util compartilhado em `src/components/shared/CopyButton.tsx`, reaproveitando exatamente o componente já existente em `ClientsPanel.tsx` (ícone `Copy`/`Check`, toast "Copiado", `stopPropagation` e `preventDefault`). Atualizar `ClientsPanel.tsx` para importar do novo arquivo (sem mudança de comportamento).

2. **`ProcessCard`** (linhas ~469–614), abaixo da barra de progresso e acima do bloco da etapa atual, inserir lista compacta das etapas anteriores resolvidas:
   - Filtrar `sorted.filter(s => s.status === "feita" || s.status === "pulado")`.
   - Limitar a 3 itens; se houver mais, mostrar texto discreto `"+N etapas anteriores"` (sem clique, só informativo — detalhes ficam no modal).
   - Cada item em uma linha:
     - Ícone `Check` (h-3 w-3) — discreto para `feita`; em tom mais neutro/cinza para `pulado`.
     - Título da etapa (`truncate`, `text-xs`).
     - Se houver `notes` (trim != ""), renderizar a observação em `text-[11px] text-muted-foreground line-clamp-1` ao lado (ou abaixo em telas estreitas) + `CopyButton` (tamanho compacto) que copia somente aquela observação.
   - Wrapper de cada linha com `onClick`, `onMouseDown`, `onPointerDown`, `onKeyDown` chamando `stopPropagation` (mesma técnica já usada no bloco `currentNote`), garantindo seleção de texto e que copiar não abre o modal.
   - Cor neutra para etapas `pulado` (ex.: `text-muted-foreground/70`, ícone sem cor de sucesso).

3. **Etapa atual e demais blocos** permanecem inalterados (incluindo seletor de status no card, `currentNote` atual, datas, footer). Próximas etapas continuam **não** sendo exibidas no card.

4. **Comportamento `template_type === "table"`** continua inalterado (não tem steps tradicionais).

## Critérios de aceite

- Card lista até 3 etapas anteriores resolvidas com check (`feita`) ou visual neutro (`pulado`), seguidas de "+N" quando houver mais.
- Observações aparecem em 1 linha com ellipsis e botão de copiar idêntico ao de Clientes.
- Clicar no botão copiar ou selecionar texto da observação **não** abre o modal do processo.
- Etapa atual e seletor de status continuam funcionando como hoje.
- Nenhuma alteração em queries, RLS, permissões ou `workspace_id`.
