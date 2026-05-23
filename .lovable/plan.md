# Plano: Seção 4 — Condições entre perguntas

Permitir que uma pergunta só apareça no formulário público quando outra pergunta tiver um valor específico. Implementação simples, focada no caso de uso real (1 condição por campo), sem quebrar formulários já publicados.

## Modelo de dados

Adicionar coluna `conditional_logic jsonb NULL` em `form_fields`. Quando `NULL` ou ausente, o campo é sempre visível (comportamento atual preservado).

Formato:
```json
{
  "field_id": "<uuid de outra pergunta do mesmo formulário>",
  "operator": "equals" | "not_equals" | "contains",
  "value": "Sim"
}
```

Regras:
- `field_id` deve referenciar um campo anterior (menor `position`) do mesmo formulário.
- `equals` / `not_equals`: comparação direta de string (case-insensitive, trim).
- `contains`: usado quando o campo de origem é `multi_select` (array). Verifica se o array inclui `value`.
- Tipos de campo elegíveis como origem: `short_text`, `long_text`, `select`, `multi_select`, `state_city`. Outros tipos (file, partner_group, date) ficam fora desta v1.
- Atualizar a view `form_fields_public` para expor `conditional_logic`.

## Editor (`FormsPanel.tsx`)

Para cada campo, abaixo do textarea de descrição, adicionar um bloco colapsável "Mostrar somente se...":
- Select com as perguntas anteriores elegíveis (label + tipo).
- Select de operador (`é igual a` / `é diferente de` / `contém` — esse último só aparece se origem for `multi_select`).
- Campo de valor:
  - Se origem for `select`/`multi_select`: dropdown com as opções daquele campo.
  - Caso contrário: input de texto.
- Botão "Remover condição" → grava `conditional_logic = null`.
- Persistir em `onBlur` / `onChange` final, igual aos outros campos.

## Formulário público (`PublicForm.tsx`)

- Calcular `visibleFieldIds` em função do `values` atual via `useMemo`.
- Helper `isFieldVisible(field, values, fieldsById)`:
  - Sem `conditional_logic` → visível.
  - `field_id` inexistente ou origem oculta → visível (degradação segura).
  - Compara `values[field_id]` com `value` segundo `operator`.
- No `.map()` dos campos, retornar `null` para invisíveis.
- Na submissão:
  - Não validar `required` em campos invisíveis.
  - Remover do `data` os valores de campos invisíveis (para não vazar resposta de pergunta que o usuário não viu).
- Estado dos campos invisíveis: manter no `values` localmente para o usuário não perder o que digitou caso volte a aparecer, mas filtrar no envio.

## Atualizações de código

- Migração: `ALTER TABLE form_fields ADD COLUMN conditional_logic jsonb` + recriar view `form_fields_public` incluindo a nova coluna.
- `src/components/forms/FormsPanel.tsx`: novo bloco na edição do campo + tipo `Field` ganha `conditional_logic`.
- `src/pages/PublicForm.tsx`: tipo `Field` ganha `conditional_logic`, queries incluem a coluna, função de visibilidade, ajustes em validação/submissão.
- `src/integrations/supabase/types.ts`: regenerado automaticamente após a migração.

## Não escopo (fica para depois se você pedir)

- Múltiplas condições (E / OU).
- Condições aninhadas em `partner_group`.
- Condição baseada em data/upload.
- Pular seções inteiras (não temos seções ainda).

## Testes manuais

1. Criar formulário com 2 campos: select "Deseja alterar endereço?" (Sim/Não) e texto "Novo endereço". Configurar condição `equals "Sim"` no segundo. Publicar.
2. No `/f/:slug`, com "Não" selecionado, o campo "Novo endereço" não aparece e o envio funciona mesmo se ele for obrigatório.
3. Trocando para "Sim", o campo aparece; se obrigatório, valida.
4. Resposta gravada não contém o campo oculto.
5. Formulário antigo (sem `conditional_logic`) continua funcionando igual.
6. Operador `not_equals` e `contains` (com `multi_select`) funcionam.
7. RLS/workspace: outro usuário sem permissão em `formularios.view` não consegue ler `conditional_logic`. Público anônimo lê via view sem expor outros campos.
8. Vínculo com modelo de processo (auto_create_process) continua funcionando — `handle_form_response_autoprocess` não depende da nova coluna.

Quando você confirmar, executo a migração e as alterações de código, e paro para você revisar antes da Seção 5.
