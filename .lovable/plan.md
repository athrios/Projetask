## Problema

O arquivo `src/components/TasksPanel.tsx` está com caracteres acentuados corrompidos (mojibake — UTF-8 lido como Latin-1). Isso aparece visivelmente no dropdown "..." de cada tarefa: "Editar tÃ­tulo", "RecorrÃªncia", "HistÃ³rico". O problema também afeta 12 outras strings no mesmo arquivo (toasts, diálogo de recorrência e histórico).

## Correção

Substituir as sequências corrompidas pelos caracteres corretos em todas as 15 linhas do arquivo:

- `tÃ­tulo` → `título`
- `recorrÃªncia` / `RecorrÃªncia` → `recorrência` / `Recorrência`
- `PrÃ³xima ocorrÃªncia` → `Próxima ocorrência`
- `excluÃ­da` → `excluída`
- `HistÃ³rico` → `Histórico`
- `FrequÃªncia` → `Frequência`
- `serÃ¡` → `será`
- `concluÃ­da` → `concluída`

Linhas afetadas: 262, 304–306, 347–348, 359, 371, 668, 677, 683, 1205, 1221, 1251, 1266.

Nenhuma lógica é alterada — apenas strings de UI/mensagens.
