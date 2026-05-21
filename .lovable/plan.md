## Plano: cortar o espaço em branco do logo Ambitask

O PNG enviado tem bastante margem branca em volta do texto, fazendo o logo parecer pequeno mesmo com `h-14` (login) e `h-6` (sidebar).

### Passos
1. Salvar o PNG enviado em `/tmp/ambitask-raw.png`.
2. Rodar um script Python (Pillow + numpy) que:
   - Detecta o bounding box do conteúdo (ignorando pixels transparentes e quase brancos > 240).
   - Recorta com 8px de respiro.
   - Converte o fundo branco restante em transparente.
3. Substituir os arquivos:
   - `public/ambitask-logo.png`
   - `src/assets/ambitask-logo.png`
4. Manter os tamanhos atuais (`h-14` no login, `h-6` na sidebar) — agora o logo vai ocupar o espaço corretamente.

Nenhuma mudança de código React/CSS é necessária.