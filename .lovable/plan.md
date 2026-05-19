# Plano — Templates de Processo com tipo Tabela

Adicionar suporte a **dois tipos** de modelo de processo: `tasks` (atual, intocado) e `table` (novo, planilha simples). Implementação incremental, sem quebrar o que já existe.

---

## 1. Banco de dados (1 migração)

Manter tudo simples com JSONB. Sem tabelas novas.

```sql
ALTER TABLE process_templates
  ADD COLUMN template_type text NOT NULL DEFAULT 'tasks',
  ADD COLUMN table_schema jsonb NOT NULL DEFAULT '{"columns":[],"rows":[]}'::jsonb;

ALTER TABLE processes
  ADD COLUMN template_type text NOT NULL DEFAULT 'tasks',
  ADD COLUMN table_data jsonb NOT NULL DEFAULT '{"columns":[],"rows":[]}'::jsonb;

-- Validação
CREATE OR REPLACE FUNCTION validate_template_type() RETURNS trigger AS $$
BEGIN
  IF NEW.template_type NOT IN ('tasks','table') THEN
    RAISE EXCEPTION 'invalid template_type: %', NEW.template_type;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SET search_path=public;

CREATE TRIGGER process_templates_type BEFORE INSERT OR UPDATE ON process_templates
  FOR EACH ROW EXECUTE FUNCTION validate_template_type();
CREATE TRIGGER processes_type BEFORE INSERT OR UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION validate_template_type();
```

Modelos e processos antigos ficam automaticamente com `template_type = 'tasks'` pelo `DEFAULT`. RLS e `workspace_id` continuam valendo sem mudança (as colunas novas estão nas mesmas tabelas).

**Formato do JSON da tabela:**
```json
{
  "columns": [
    { "id": "A", "label": "Descrição", "kind": "text"  },
    { "id": "B", "label": "Valor",     "kind": "number"},
    { "id": "C", "label": "Observação","kind": "text"  }
  ],
  "rows": [
    { "id": "r1", "cells": { "A": "Honorários", "B": "500", "C": "Pago" } },
    { "id": "r2", "cells": { "A": "Total", "B": "=SOMA(B1:B1)", "C": "" } }
  ]
}
```
Referências de fórmula usam **letra da coluna + índice 1-based da linha** (independente do `id` interno).

---

## 2. Engine de fórmulas (`src/lib/sheetFormula.ts`)

Sem `eval`. Parser próprio mínimo e seguro:

- Detecta `=` no início da célula.
- Tokens permitidos: números, refs `[A-Z]+\d+`, ranges `REF:REF`, operadores `+ - * /`, parênteses, funções `SOMA|SUM|MEDIA|AVERAGE`.
- Avaliação por shunting-yard → RPN.
- Refs vazias = 0; texto em célula referenciada num cálculo numérico = 0.
- Detecção de ciclo via set de células em avaliação → retorna `#CICLO`.
- Erros retornam `#ERRO` (mostrado discreto na célula) com tooltip da mensagem.
- Recalcula tudo a cada edição (tabelas pequenas; barato).

Tests: `src/test/sheetFormula.test.ts` cobrindo +, -, *, /, SOMA/SUM, MEDIA/AVERAGE, ref vazia, ciclo, fórmula inválida.

---

## 3. Frontend — modelo

**`ProcessesPanel.tsx`** (diálogo Criar/Editar modelo):
- Adicionar `<Select>` "Tipo de modelo" com opções `Tarefas` / `Tabela`.
- Se `tasks`: UI atual (etapas).
- Se `table`: renderizar `<TableBuilder />` (novo componente) operando sobre `table_schema`.

**Novo `src/components/processes/TableBuilder.tsx`:**
- Adicionar/remover/renomear coluna (label + kind text|number).
- Adicionar/remover linha.
- Editar células (inputs em linha, mesmo visual leve).
- Preview de fórmulas usando o engine.
- Validação (zod): máx 50 colunas, máx 500 linhas, label ≤ 60 chars, célula ≤ 1000 chars.

---

## 4. Frontend — criação de processo

Ao criar processo a partir de um modelo:
- Se `template_type = 'tasks'`: fluxo atual (cria `process_steps` a partir dos `process_template_steps`).
- Se `table'`: copiar `template.table_schema` para `processes.table_data` (deep clone), não criar steps.

---

## 5. Frontend — detalhe do processo

Reaproveitar o drawer atual. Switch por `template_type`:

- `tasks` → componente atual (etapas).
- `table` → novo `<ProcessTableView />`:
  - Cabeçalho: nome do processo, nome do modelo, `<StatusPill>` editável, botões **Salvar**, **Adicionar linha**, **Adicionar coluna**.
  - Grid: cabeçalho de colunas + linhas numeradas (1, 2, 3…) + células editáveis. Células de fórmula mostram valor calculado; ao focar, mostra a fórmula crua.
  - Visual: bordas suaves (`border-border`), `bg-card`, células alinhadas, sem peso visual de formulário (inspirado em Notion/Sheets).
  - Salvar = `UPDATE processes SET table_data = ...`.

**Status automático:**
- Criação: `nao_iniciado` (default já existente).
- Primeira edição salva com células preenchidas: passa a `em_andamento` (se ainda estava `nao_iniciado`).
- Usuário pode marcar `concluido` ou `cancelado` manualmente pelo StatusPill.

**Card do processo:** adicionar badge pequena "Tabela" quando `template_type='table'`. Mantém cor do modelo.

---

## 6. Permissões / Ambientes

Sem mudança de regra. As colunas novas ficam nas tabelas `process_templates` e `processes` que já têm RLS por `workspace_id` + `has_workspace_permission('processos', ...)`. O autofill de `workspace_id` continua funcionando.

`GlobalSearch` e listagens já filtram por workspace — sem alteração.

---

## 7. Arquivos

**Migração**
- `supabase/migrations/<ts>_process_template_types.sql`

**Criar**
- `src/lib/sheetFormula.ts` (parser + avaliador + helpers de letra→índice)
- `src/components/processes/TableBuilder.tsx` (editor de schema no modelo)
- `src/components/processes/ProcessTableView.tsx` (tabela no processo)
- `src/test/sheetFormula.test.ts`

**Editar**
- `src/components/processes/ProcessesPanel.tsx`
  - Tipos `Template` e `Process` ganham `template_type` e payload de tabela.
  - Diálogo de modelo com seletor de tipo + render condicional.
  - Criação de processo: branch tasks vs table.
  - Drawer/detalhe: branch tasks vs table.
  - Card: badge de tipo.
- `src/lib/validation.ts` — schemas `tableColumnSchema`, `tableCellSchema`.
- `src/integrations/supabase/types.ts` — atualizado automaticamente pela migração.

---

## 8. Critérios de aceite

1. Modelo Tarefas existente continua funcionando idêntico ao atual.
2. Criar modelo Tabela "Apuração mensal" com colunas Descrição/Valor/Observação, linhas, fórmula `=SOMA(B1:B3)` → salva e recalcula.
3. Criar processo a partir desse modelo → tabela independente; editar processo não altera o modelo.
4. Trocar de workspace esconde modelos e processos do outro ambiente.
5. Permissões de Processos (view/create/edit/delete) aplicam-se ao novo tipo.
