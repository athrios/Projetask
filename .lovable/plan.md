## Objetivo
Tornar o rótulo do campo Documento dinâmico também no card do cliente (lista de Clientes), espelhando o comportamento já existente no formulário.

## Mudança
Arquivo: `src/components/clients/ClientsPanel.tsx` (~linha 372).

No `.map` de `orderedKeys` que renderiza cada `Field`, quando `key === "document"`, calcular o rótulo a partir de `r.client_type`:
- `pj` → "CNPJ"
- `pf` → "CPF"
- demais (`estrangeiro`, etc.) → "Documento"

Para os outros campos, manter o uso de `STANDARD_FIELD_LABELS`.

## Fora de escopo
- Nenhuma mudança em `ClientForm` (já dinâmico).
- Nenhuma mudança em `STANDARD_FIELD_LABELS` / settings (o label "Documento" continua sendo o padrão para configuração de ordem/visibilidade — a substituição é só visual no card).
- Sem alterações no placeholder de busca e em outras telas.
