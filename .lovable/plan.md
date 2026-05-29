## Plano: ícone ao salvar na tela inicial (iOS/Android)

Usar o `public/favicon.png` atual como base.

### 1. Gerar ícones (ImageMagick)
A partir de `public/favicon.png`, criar em `public/`:
- `apple-touch-icon.png` — 180×180 (iOS)
- `icon-192.png` — 192×192 (Android)
- `icon-512.png` — 512×512 (Android, splash)

### 2. Criar `public/manifest.webmanifest`
```json
{
  "name": "Ambitask",
  "short_name": "Ambitask",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### 3. Atualizar `<head>` do `index.html`
Adicionar:
```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#ffffff" />
<meta name="apple-mobile-web-app-title" content="Ambitask" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### Observações
- Sem service worker (evita problemas de cache no preview).
- iOS cacheia agressivamente o apple-touch-icon: para ver o novo, remover o atalho da tela inicial e adicionar de novo.
- Se quiser usar uma cor de marca em `theme_color`/`background_color` em vez de branco, basta dizer.
