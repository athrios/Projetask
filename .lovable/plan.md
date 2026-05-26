## Objetivo

Na tela de mapeamento da importação de planilha (`ImportClientsDialog`, etapa 2), adicionar um botão discreto **“+ Extra”** ao lado do nome de cada coluna da planilha que ainda não corresponde a um campo conhecido do sistema. Ao clicar, criar automaticamente um Campo Extra global nas configurações de Clientes e já selecioná-lo no dropdown daquela linha.

## Escopo

Apenas frontend, no fluxo de importação. Sem alterações de banco, sem novas tabelas, sem mexer em CNPJ/CEP, sem mudar identidade visual.

## Onde mexer

- `src/components/clients/ImportClientsDialog.tsx` — adicionar lógica de detecção, botão e criação inline.
- `src/components/clients/ClientsPanel.tsx` — passar `onExtraCreated` / garantir recarregamento das settings após criação.
- Reutilizar `useClientSettings.save()` para persistir o novo `ExtraFieldDef` em `client_settings.extra_fields`.

## Regras de detecção (campo “já existe”)

Para o título de cada coluna da planilha, normalizar (`lowercase`, sem acentos, sem caracteres não alfanuméricos — já existe `normalize()` no arquivo) e considerar como **existente** se:

1. Bate com alguma chave do dicionário `guessMapping` (CNPJ, CPF, nome, e-mail, telefone, endereço, etc.).
2. Bate (por `normalize`) com o `label` de algum `ExtraFieldDef` em `settings.extra_fields`.
3. O usuário já mapeou manualmente aquela linha para algo diferente de `std:ignore`.

Caso contrário (mapping atual = `std:ignore` e título não bate com nada) → mostrar botão **“+ Extra”**.

## Botão “+ Extra”

- Pequeno, `variant="ghost"` ou `outline` `size="sm"`, ícone `Plus` + texto “Extra”.
- Tooltip: “Criar Campo Extra com este nome”.
- Posicionado ao lado do título na grid existente (`grid-cols-[1fr_1fr]` → ajustar para `grid-cols-[1fr_auto_1fr]` ou agrupar título + botão num flex à esquerda mantendo alinhamento).
- Desabilitado/oculto se o usuário não tiver permissão `clientes.edit` (a UI atual já só abre esse dialog para quem pode importar; reaproveitar a mesma checagem que `ClientsPanel` faz para o botão “Configurações”). Se já houver um prop/flag de permissão, usar; senão, manter visível e deixar o RLS barrar.

## Ação ao clicar

1. Verificação anti-duplicidade: procurar em `extraFields` algum `label` cujo `normalize()` == `normalize(header)`. Se achar → não criar, apenas setar `mapping[i] = "extra:" + def.id` e sair.
2. Criar novo `ExtraFieldDef`:
   ```ts
   { id: crypto.randomUUID(), label: header.trim(), type: "text", required: false }
   ```
3. Chamar `saveSettings({ ...settings, extra_fields: [...settings.extra_fields, novo] }, userId)` — feito via um callback passado pelo `ClientsPanel` (`onCreateExtra(label) => Promise<ExtraFieldDef>`) para manter o hook centralizado no painel.
4. Após sucesso:
   - Atualizar a lista local de `extraFields` (vinda por prop) — `ClientsPanel` recarrega settings e re-renderiza o dialog com a nova lista.
   - `setMapping(m => ({ ...m, [i]: "extra:" + novo.id }))`.
   - Toast: “Campo Extra criado: {label}”.
   - O botão desaparece naturalmente porque o título agora bate com um extra existente.
5. Em caso de erro do `save`, toast de erro e não alterar mapping.

## Importação dos dados

Nenhuma mudança necessária: o pipeline já trata `m.startsWith("extra:")` em `built`, monta `custom_fields` com `source: "extra"` e `extra_id`, e insere normalmente. O `ClientForm`/`ClientsPanel` já renderizam extras a partir de `settings.extra_fields`, então o campo recém-criado aparecerá automaticamente nas configurações, novos cadastros e cards.

## Layout (exemplo)

```text
┌──────────────────────────────┬──────────────────────────┐
│ CNPJ                         │ [Dropdown: CNPJ      ▾] │
│ IE              [+ Extra]    │ [Dropdown: Ignorar   ▾] │
│ SENHA WEB       [+ Extra]    │ [Dropdown: Ignorar   ▾] │
│ CPF                          │ [Dropdown: CPF       ▾] │
└──────────────────────────────┴──────────────────────────┘
```

Após clique em “+ Extra” na linha IE:

```text
│ IE                           │ [Dropdown: Extra: IE ▾] │
```

## Critérios de aceite

- Colunas reconhecidas (CNPJ, CPF, e-mail…) não exibem botão.
- Colunas não reconhecidas exibem botão “+ Extra” com tooltip.
- Clique cria o extra global no workspace ativo, sem duplicidade (case/acentos/espaços ignorados).
- Dropdown da linha passa a “Extra: {label}” automaticamente.
- Botão some após criação.
- Extra aparece em Configurações de Clientes, novos cadastros e cards.
- Valores da coluna são salvos no extra correspondente ao concluir a importação.
- Tudo isolado pelo `workspace_id` atual via RLS existente.
