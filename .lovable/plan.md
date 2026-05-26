## Objetivo

Tornar o campo "Grupo de sócios / QSA" totalmente configurável por formulário (adicionar, remover, renomear, reordenar, tipar campos), incluindo um novo campo padrão **Data de nascimento**, e propagar os dados — incluindo campos personalizados por sócio — para resposta, cadastro de cliente e demais telas do QSA. Múltiplos sócios continuam funcionando, cada um com seus próprios valores.

## 1. Modelo de dados (sem migração de schema)

Reutilizar a coluna `form_fields.options` (JSONB) já existente. Quando `field_type = 'partner_group'`, `options` passa a guardar o **schema de subcampos do sócio**:

```json
{
  "partner_schema": [
    { "id": "nome",            "label": "Nome completo",      "type": "text",       "required": true,  "builtin": true },
    { "id": "data_nascimento", "label": "Data de nascimento", "type": "date",       "required": false, "builtin": true },
    { "id": "nacionalidade",   "label": "Nacionalidade",      "type": "text",       "builtin": true },
    { "id": "naturalidade",    "label": "Naturalidade",       "type": "state_city", "builtin": true },
    { "id": "profissao",       "label": "Profissão",          "type": "text",       "builtin": true },
    { "id": "estado_civil",    "label": "Estado civil",       "type": "select",     "options": [...], "builtin": true },
    { "id": "regime_bens",     "label": "Regime de bens",     "type": "select",     "options": [...], "builtin": true, "visible_when": "estado_civil in [...]" },
    { "id": "endereco",        "label": "Endereço",           "type": "address",    "builtin": true },
    { "id": "etnia",           "label": "Etnia",              "type": "select",     "options": [...], "builtin": true },
    { "id": "participacao",    "label": "Participação (R$)",  "type": "currency",   "builtin": true },
    { "id": "<uuid>",          "label": "Campo custom",       "type": "email",      "builtin": false }
  ]
}
```

Tipos suportados para subcampos: `text`, `long_text`, `number`, `currency`, `date`, `email`, `phone`, `cpf`, `cnpj`, `select`, `checkbox`, mais os compostos já existentes `state_city` e `address`.

Cada sócio passa a ser armazenado como `Record<subfieldId, value>` em `form_responses.data[<field_id>]` (array). Builtins mantêm os ids atuais (`nome`, `nacionalidade`, ...) — **retrocompatível** com respostas e snapshots já gravados.

Migração leve em runtime: se um `partner_group` não tiver `partner_schema` salvo, derivar o schema padrão dos builtins atuais + `data_nascimento`. Nada precisa ser reescrito no banco.

## 2. UI — Editor de formulário (`FormsPanel.tsx`)

No bloco já existente do `partner_group`:
- Mantém o input "Rótulo do botão".
- Novo painel "Campos do sócio":
  - Lista os subcampos em ordem (drag handle para reordenar).
  - Por item: editar `label`, alternar `required`, alternar visibilidade (apenas para builtins opcionais — `nome` permanece sempre obrigatório).
  - Builtins podem ser ocultados (exceto `nome`), mas não excluídos — para preservar dados antigos.
  - Customs podem ser removidos.
  - Botão "Adicionar campo" → escolhe tipo (lista acima) e label; para `select`, abre textarea de opções.
- Persistência via `onUpdate({ options: { partner_schema: [...] } })`.

## 3. UI — Preenchimento (`PartnerGroupField.tsx`)

Refatorar para **renderização dirigida por schema**:
- Recebe `schema: PartnerSubfield[]` (vindo de `field.options.partner_schema`, com fallback default).
- Para cada sócio, itera o schema e renderiza o controle correspondente ao `type`:
  - `text/email/phone/number/currency/cpf/cnpj` → `Input` (com máscara para cpf/cnpj/phone/currency, reusando `@/lib/documents`).
  - `long_text` → `Textarea`.
  - `date` → shadcn DatePicker com `pointer-events-auto`.
  - `select` → `Select` com `options`.
  - `checkbox` → `Checkbox`.
  - `state_city` → `StateCityField`.
  - `address` → `AddressField`.
- Mantém visual atual (cards `bg-muted/20`, label uppercase `text-[11px]`).
- Mantém regra condicional `regime_bens` visível só quando casado/união estável.
- Validação obrigatória aplicada na submissão pelo `PublicForm` usando o schema.

## 4. Visualização da resposta (`RequestsPanel.tsx`)

`SUBFIELD_LABELS` deixa de ser fixo: para cada `partner_group` da resposta, ler `field.options.partner_schema` e renderizar pares label/valor na ordem definida, formatando por tipo (date em `dd/MM/yyyy`, currency em BRL, address via `formatAddress`, state_city como `UF / Cidade`). Botão Copiar é reaproveitado sem alteração.

## 5. Cliente — Cadastro/edição (`ClientForm.tsx`)

Adicionar uma seção colapsável **"Sócios / QSA"**:
- Reusa `PartnerGroupField` com o **schema padrão** (builtins + `data_nascimento`).
- Persistido em `clients.custom_fields` como entrada `{ id: "__qsa__", source: "qsa", value: Partner[] }` (mantém o schema atual de `custom_fields` JSONB; não exige migração).
- Pré-popula a partir de `cnpj_lookup_snapshot.qsa` na criação de PJ (quando ainda vazio), sem sobrescrever edição manual.
- Exibido também em qualquer outro lugar que mostra detalhes do cliente (`ClientsPanel` cards já iteram `custom_fields` — adicionar renderer dedicado para `__qsa__`).

## 6. Compatibilidade

- Respostas antigas continuam abrindo: leitor usa schema default quando faltam metadados.
- Snapshots de CNPJ (`cnpj_lookup_snapshot.qsa`) seguem inalterados.
- Lógica de lookup de CNPJ e CEP não muda.

## 7. Passos de implementação

1. Criar `src/components/forms/fields/partnerSchema.ts` com tipos (`PartnerSubfield`, `PartnerSubfieldType`), schema default (incluindo `data_nascimento`) e helper `resolvePartnerSchema(field)`.
2. Refatorar `PartnerGroupField.tsx` para render dinâmico baseado em schema, com componentes por tipo.
3. Em `FormsPanel.tsx`, adicionar o editor de subcampos para `partner_group` (lista + reordenar + adicionar/remover/editar + tipo).
4. Em `PublicForm.tsx`, passar `schema` resolvido para `PartnerGroupField` e validar required dos subcampos no submit.
5. Em `RequestsPanel.tsx`, trocar `SUBFIELD_LABELS` por leitura do schema do field correspondente; formatar por tipo.
6. Em `ClientForm.tsx`, adicionar seção QSA usando `PartnerGroupField` com schema default; persistência via `custom_fields`.
7. Em `ClientsPanel.tsx`, renderizar a entrada `__qsa__` no card (lista resumida de sócios com copiar).
8. QA: criar formulário com campo custom (ex.: e-mail do sócio), responder com 2 sócios, validar exibição na resposta e no cliente; abrir resposta antiga (sem schema) e confirmar retrocompat.

## Fora de escopo

- Mudanças no banco (nenhuma migração).
- Alterações em CNPJ/CEP lookup, identidade visual ou outros módulos.
- Sincronização contínua com planilhas/Google Sheets.