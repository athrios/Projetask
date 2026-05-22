# Seção 1 — Respostas mais legíveis e copiáveis

Escopo restrito: apenas o módulo de Solicitações (`RequestsPanel.tsx`). Sem migration. Sem mudanças em RLS, workspace ou permissões.

## Diagnóstico

- `PublicForm.tsx` já salva `form_responses.data` usando o **label** da pergunta como chave (`cleanValues[f.label]`). Portanto, em respostas novas, o que aparece já é o nome legível.
- Casos que ainda mostram aparência "técnica":
  1. **Respostas antigas** salvas antes da mudança, que podem ter chaves diferentes do label atual.
  2. **Sub-chaves do grupo de sócios / partner_group** (`nome`, `cpf`, `estado_civil`, `regime_bens`, `participacao`, etc.) — renderizadas em snake_case dentro de cada cartão "Sócio N".
  3. **Labels de campos que foram renomeados depois** — a chave salva é o label antigo, e visualmente passa a impressão de "ID".

## O que será implementado

### 1. Mapeamento label-amigável no diálogo de detalhes
- Carregar `form_fields` (id, label) do `form_id` da resposta aberta, restrito ao `workspace_id` atual (RLS já garante isolamento).
- Para cada chave em `open.data`:
  - Se a chave bater com um label atual do formulário → mostrar esse label.
  - Senão, mostrar a própria chave como fallback (já é label de envio, não UUID).
  - Se a chave parecer um UUID técnico (regex), mostrar `Pergunta não encontrada` em itálico discreto.

### 2. Dicionário pt-BR para chaves internas conhecidas do `partner_group`
Mapa local em `RequestsPanel.tsx`:
```
nome → "Nome completo"
nacionalidade → "Nacionalidade"
naturalidade → "Naturalidade (UF / Cidade)"
profissao → "Profissão"
estado_civil → "Estado civil"
regime_bens → "Regime de bens"
endereco → "Endereço residencial"
etnia → "Autodeclaração de etnia"
participacao → "Participação no capital (R$)"
uf → "UF"
cidade → "Cidade"
```
Aplicado apenas ao renderizar sub-itens de sócios e `state_city`, sem alterar o que está salvo no banco.

### 3. Botão "Copiar" por resposta
- Ícone `Copy` (lucide) ao lado de cada valor renderizado no diálogo (pergunta principal + cada linha de sócio + arquivo).
- Ao clicar:
  - `navigator.clipboard.writeText(textoFormatado)` usando o mesmo `formatValue` já existente, ou o `file.name` no caso de anexo.
  - Toast `sonner` "Copiado".
  - Troca momentânea do ícone para `Check` por ~1,5s como feedback visual inline.
- O botão **não** abre modal, não chama o backend, não altera a resposta.
- `stopPropagation` para não interferir com cliques do diálogo.

### 4. Botão "Copiar tudo" no cabeçalho do bloco de dados (bônus pequeno)
- Copia o resultado de `formatData(open.data)` já existente, agora com labels mapeados.
- Mesmo padrão de feedback.

## Arquivos alterados

- `src/components/requests/RequestsPanel.tsx` (única mudança).

## Sem migration

Nenhuma alteração de schema, RLS, views, storage ou edge function.

## Garantias

- `workspace_id` continua sendo o filtro nas queries existentes.
- RLS de `forms`, `form_fields` e `form_responses` inalteradas.
- Não muda nada em `FormsPanel.tsx`, `PublicForm.tsx`, vínculo com modelo de processo, ou conversão em tarefa/processo.

## Testes que você deve fazer

1. **Resposta nova**: Publicar/abrir um formulário existente, responder e abrir em Solicitações → cada campo aparece com o label da pergunta (ex.: "CNPJ", não chave técnica).
2. **Cópia simples**: Clicar no ícone de copiar de um campo → colar em outro lugar → confere o valor; aparece o toast "Copiado" e o ícone vira `Check` brevemente.
3. **Cópia de sócios**: Em formulário com `partner_group`, cada sub-campo do sócio mostra label em PT-BR ("Nome completo", "Estado civil", etc.) e copia individualmente.
4. **Anexo**: Botão copiar ao lado de arquivo copia o nome do arquivo (sem tentar baixar).
5. **Resposta antiga**: Abrir uma solicitação anterior à mudança e confirmar que ainda renderiza (fallback usa a própria chave salva, sem quebrar).
6. **Isolamento**: Trocar de workspace → solicitações de outro ambiente não aparecem (sem regressão).
7. **Conversão**: Converter em tarefa e em processo continuam funcionando como antes.

## Pendente para próximas seções

- Seção 2: rótulo customizável do campo "Seu nome" e do botão "Adicionar sócio".
- Seções 3–10: conforme lista, somente após sua confirmação.
