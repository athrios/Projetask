## Problema

No módulo Clientes, ao digitar um CNPJ válido e sair do campo, a tela fica em branco.

A edge function `lookup-cnpj` retorna:
```json
{ "source": "...", "provider": "...", "data": { "company_name": ..., "address": {...}, ... } }
```

Mas `src/components/clients/ClientForm.tsx` (função `runCnpjLookup`, ~linha 168) faz:
```ts
const d = data as CnpjLookupData;
// usa d.company_name, d.address.street, d.zip_code...
```

Como `data` é o envelope, `d.address` é `undefined` e acessar `d.address.street` lança `TypeError`, derrubando a árvore React e deixando só a cor de fundo.

Note: no `PublicForm.tsx` esse mesmo retorno é tratado corretamente (`data.data`). O bug é exclusivo do `ClientForm.tsx`.

## Correção (escopo mínimo)

Em `src/components/clients/ClientForm.tsx`, dentro de `runCnpjLookup`:

1. Extrair corretamente o payload:
   ```ts
   const payload = (data as { data?: CnpjLookupData })?.data ?? null;
   if (!payload) {
     setCnpjError("Não encontramos dados públicos para este CNPJ. Você pode continuar mesmo assim.");
     setCnpjPreview(null);
     return;
   }
   const d = payload;
   ```

2. Tornar o acesso a `d.address` defensivo (caso provider retorne sem o bloco):
   ```ts
   const addr = d.address ?? { street: null, number: null, complement: null, neighborhood: null };
   ```
   e usar `addr.street`, `addr.number`, etc. no `setDraft`.

3. Tratar erros do invoke com mensagem específica quando `error.message`/`context.status` indicar `cnpj_not_found` vs falha de upstream (opcional, melhora UX — mesma semântica usada no PublicForm).

## Fora do escopo

- Não alterar a edge function.
- Não alterar `AddressField`, `PublicForm`, navegação, tabelas, RLS, identidade visual.
- Não mexer em outros módulos.

## Validação

1. Abrir Clientes → Novo cliente → Pessoa jurídica.
2. Digitar um CNPJ válido (ex.: o usado no replay) e sair do campo.
3. Esperado: spinner aparece, depois o bloco "Dados públicos consultados" com razão social/situação; campos Nome, Endereço, CEP, etc. são pré-preenchidos; tela não fica em branco.
4. Digitar CNPJ inválido → mensagem "CNPJ inválido…", sem crash.
5. CNPJ válido mas inexistente → mensagem "Não encontramos dados públicos…", sem crash.
