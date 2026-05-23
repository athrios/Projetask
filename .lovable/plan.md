# Investigar: condições em multipla escolha aparentemente ignoradas

## O que eu já verifiquei

- Os dados estão salvos certo no banco. As 3 perguntas condicionais têm condições válidas (`contains`/`not_contains` apontando para o multi_select "Deseja incluir alterações?").
- A view `form_fields_public` expõe `conditional_logic` e o anon consegue ler (confirmado por `curl` direto na API).
- A engine `evaluateCondition` em `src/lib/formConditions.ts` trata `contains`/`not_contains` corretamente (array + case-insensitive).
- `PublicForm.tsx` carrega `conditional_logic`, parseia, monta `visibility` em ordem de `position` e usa `if (!visibility[f.id]) return null;` no render.

Pela leitura, o caso "Quais serão as novas atividades?" (`contains "Atividades exercidas"`) deveria ficar **oculto** até o usuário marcar essa opção. Os outros dois (`not_contains`) deveriam aparecer só enquanto a opção correspondente **não** estiver marcada.

## Hipótese principal

O formulário aberto pelo usuário está sendo servido por uma versão publicada antiga, anterior à introdução da visibilidade condicional. A URL preview (`/f/<slug>` no domínio `id-preview--…lovable.app`) carrega o código atual; a URL publicada (`ambitask.com.br` / `ambitask.lovable.app`) só atualiza após um novo Publish.

## Passos da investigação (em build mode)

1. Abrir `/f/<slug>` da preview no browser via ferramenta interna e marcar/desmarcar opções no multi_select para confirmar o comportamento esperado:
   - "Quais serão as novas atividades?" oculto até marcar "Atividades exercidas".
   - "Endereço novo" some quando "Endereço Comercial" é marcado.
   - "Novo capital social" some quando "Capital Social" é marcado.
2. Capturar `console.log` temporário do `visibility` map para validar (remover depois).
3. **Se preview estiver OK:** confirmar que o bug só acontece no domínio publicado e orientar o usuário a republicar. Não há fix de código.
4. **Se preview também falhar:** então há bug real. Próximos suspeitos a checar:
   - `parseCondition` rejeitando silenciosamente (logar valor recebido).
   - `values[f.label]` divergindo da chave esperada (e.g. label com espaços trailing).
   - Ordem do `fields` quebrada quando duas perguntas têm a mesma `position`.

## Não escopo

- Múltiplas opções por condição (E/OU) — fica para depois conforme decidido na seção anterior.
- Migração de dados antigos.

Confirma que sigo investigar dessa forma?
