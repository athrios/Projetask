# Formulários: Rescisão (DP) e Abertura de Empresa (Athrios)

## 1. Novos tipos de campo

Para suportar o que foi pedido, adicionar 2 tipos novos em `form_fields.field_type`:

- `state_city` — par de dropdowns ligados (UF + cidade IBGE)
- `partner_group` — grupo repetível ("Adicionar sócio") com um sub-formulário fixo

Os outros campos usam tipos já existentes (`short_text`, `long_text`, `date`, `select`, `multi_select`).

### Migração

Atualizar a função `validate_form_field_type` para aceitar `state_city` e `partner_group`.

## 2. Builder (`FormsPanel.tsx`)

Adicionar as duas opções no `FIELD_TYPES`:
- "Estado + Cidade"
- "Grupo de sócios"

Nenhuma config extra de opções para esses tipos (a UI é fixa).

## 3. Renderer público (`PublicForm.tsx`)

- **`state_city`**: dois `Select`s. UF carregado de `https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome`; cidades carregadas sob demanda ao escolher a UF (`/estados/{UF}/municipios`). Cache em memória por UF para não ficar lento. Valor salvo: `{ uf: "SP", cidade: "São Paulo" }`.
- **`partner_group`**: lista de sócios + botão "Adicionar sócio". Cada sócio tem os campos fixos:
  - Nome completo (texto)
  - Nacionalidade (texto)
  - Naturalidade → reutiliza `state_city`
  - Profissão (texto)
  - Estado civil (select: SOLTEIRO(A), CASADO(A), UNIÃO ESTÁVEL, DIVORCIADO(A), VIÚVO(A), SEPARADO JUDICIALMENTE)
  - Regime de bens (select, aparece só se casado: COMUNHÃO PARCIAL, COMUNHÃO UNIVERSAL, SEPARAÇÃO TOTAL, PARTICIPAÇÃO FINAL NOS AQUESTOS)
  - Endereço residencial (texto longo)
  - Autodeclaração de etnia (select: Branca, Preta, Parda, Amarela, Indígena)
  - Participação no capital — valor R$ (texto numérico)
  
  Cada sócio pode ser removido. Valor salvo: array de objetos.

A validação atual (`publicTextAnswerSchema`) é relaxada para objetos/arrays aninhados; mantém limite de tamanho.

## 4. Seeds dos formulários

INSERT em `forms` + `form_fields` (workspace DP e Athrios, owner = primeiro membro owner do workspace).

### Form "Rescisões" — workspace DP (`12ff439f-…`)
1. Empresa — `short_text`, obrigatório
2. Data do último dia trabalhado — `date`, obrigatório
3. Aviso prévio — `multi_select` [Indenizado, Trabalhado, Dispensado]
4. Iniciativa — `multi_select` [Empresa (Dispensado), Empresa (Justa Causa), Empregado (Pediu Demissão), Acordo entre as partes]
5. Observações — `long_text`

### Form "Abertura de Empresa" — workspace Athrios (`32cda29f-…`)
1. Nome da empresa — `short_text`, obrigatório
2. CEP comercial — `short_text`
3. Endereço comercial — `short_text`
4. Complemento — `short_text`
5. IPTU — `short_text`
6. Capital social — `short_text`
7. Atividades exercidas — `long_text`
8. CPF do sócio principal — `short_text`
9. Senha Gov.Br — `short_text`
10. E-mail — `short_text`
11. Senha do e-mail — `short_text`
12. Sócios — `partner_group`

Os dois formulários ficam **despublicados** por padrão; o usuário publica quando quiser gerar o link.

## 5. Painel de respostas

O painel atual exibe `data` como pares chave-valor. Para `state_city` (objeto) e `partner_group` (array de objetos) adicionar renderização simples: objetos como "UF — Cidade" e arrays como lista numerada de sócios com seus campos. Mudança contida em `RequestsPanel`/visualizador de resposta (a confirmar nome ao implementar).

## Resumo dos arquivos

- migração SQL — `validate_form_field_type`
- `src/components/forms/FormsPanel.tsx` — novas opções no builder
- `src/pages/PublicForm.tsx` — render dos 2 novos tipos
- `src/lib/validation.ts` — afrouxar validação para objetos/arrays aninhados
- componente novo `src/components/forms/fields/StateCityField.tsx`
- componente novo `src/components/forms/fields/PartnerGroupField.tsx`
- visualizador de resposta — render de objeto/array
- seeds via tool `supabase--insert` para criar os 2 formulários
