Substituir o favicon pelo logo enviado (musgo/areia).

Passos:
1. Copiar `user-uploads://LOGO_AMBITASK_MUSGO-AREIA.png` para `public/favicon.png`.
2. Remover `public/favicon.ico` (se existir) para evitar conflito com a requisição padrão do navegador.
3. Atualizar `index.html` para referenciar `<link rel="icon" href="/favicon.png" type="image/png">`.

Sem alterações de lógica ou de outros componentes.