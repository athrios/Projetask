# CNPJ autofill — backend & cache (etapa 1)

Objetivo: criar a infraestrutura de consulta de CNPJ (edge function + cache) sem mexer na UI dos formulários ainda.

## 1. Tabela de cache

Migration para criar `public.cnpj_lookup_cache`:

- `cnpj` text PK (apenas 14 dígitos, sem máscara)
- `provider` text — `cnpja_open` | `brasilapi`
- `data` jsonb — payload normalizado
- `raw` jsonb — resposta original do provedor
- `fetched_at` timestamptz not null default now()
- `created_at` timestamptz not null default now()
- Índice em `fetched_at` para futura expiração

RLS: habilitada. Sem políticas para usuários (acesso apenas via service role na edge function). Isso protege a tabela e ainda permite a function gravar/ler usando `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Edge function `lookup-cnpj`

Arquivo: `supabase/functions/lookup-cnpj/index.ts`. Config em `supabase/config.toml` com `verify_jwt = true` (só usuários autenticados podem consultar — evita uso abusivo do endpoint público).

Fluxo:

1. CORS + valida método `POST`.
2. Lê `{ cnpj: string }` do body com Zod.
3. Sanitiza: remove tudo que não é dígito, exige 14 dígitos, valida DV (algoritmo padrão de CNPJ). Rejeita sequências repetidas (`00000000000000` etc.).
4. Consulta `cnpj_lookup_cache` pelo CNPJ sanitizado. Se existir e `fetched_at` < 30 dias, retorna `{ source: "cache", data, provider }`.
5. Senão chama provedores em ordem:
   - **CNPJá Open** (primário): `https://open.cnpja.com/office/{cnpj}` — gratuito, sem chave.
   - **BrasilAPI** (fallback): `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`.
   Timeout de ~6s por chamada via `AbortController`. Em erro/timeout/404 do primário, tenta o fallback.
6. Normaliza para o shape comum:
   ```ts
   {
     cnpj, company_name, trade_name, status,
     address: { street, number, complement, neighborhood },
     city, state, zip_code,
     main_cnae: { code, description },
     secondary_cnaes: [{ code, description }],
     phone, email
   }
   ```
   Mapeamento por provedor documentado dentro do arquivo (campos diferem: CNPJá usa `company.name`/`alias`/`address.*`/`mainActivity`; BrasilAPI usa `razao_social`/`nome_fantasia`/`logradouro`/`cnae_fiscal*`).
7. Faz `upsert` em `cnpj_lookup_cache` com `provider`, `data` (normalizado), `raw` (resposta crua), `fetched_at = now()`.
8. Retorna `{ source: "provider", provider, data }`.

Erros retornam JSON com `error` e status apropriado (400 inválido, 404 não encontrado nos dois provedores, 502 falha de upstream, 401 sem auth).

## 3. Fora de escopo nesta etapa

- Sem alterações em `AddressField`, `PublicForm`, editor de formulários ou qualquer outra tela.
- Sem novo tipo de campo `cnpj` no schema do formulário (fica para a próxima etapa, junto com a UI).
- Sem cron de limpeza da cache (TTL é aplicado em leitura).

## Detalhes técnicos

- Migration cria tabela + RLS habilitada + comentário explicando que o acesso é só via service role.
- Function usa `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` para escrever na cache contornando RLS.
- Validação CNPJ implementada inline (sem dependência nova).
- Zod via `npm:zod`.
- CORS via `npm:@supabase/supabase-js@2/cors`.

Confirma que posso seguir com a migration + edge function?
