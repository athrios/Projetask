## Overview
Add a theme-aware spotlight hover effect to cards and list items across the app. The effect tracks the mouse position via CSS custom properties and renders a radial gradient glow that adapts automatically to light and dark themes.

## How It Works

```text
┌─────────────────────────────────────┐
│  CSS :root variables                │
│  ├── --spotlight-x, --spotlight-y   │
│  ├── --spotlight-size               │
│  └── --spotlight-opacity            │
│                                      │
│  @layer utilities                    │
│  ├── .spotlight-card               │
│  ├── .spotlight-list-item          │
│  └── .spotlight-reset (base)       │
│                                      │
│  React hook: useSpotlightRef       │
│  └── attaches mousemove listener   │
│      updates --spotlight-x/y       │
│      throttled via requestAnimationFrame
└─────────────────────────────────────┘
```

## Light vs Dark Behavior

| Mode | Effect |
|------|--------|
| **Light** | Very soft radial highlight (warm sand tint), subtle border darkening, light shadow elevation |
| **Dark** | Subtle radial glow using primary/accent color at low opacity, faint bloom |

Both modes use `transition` for smooth entrance/exit and `pointer-events: none` pseudo-element so text remains fully readable and interactive.

## Files to Change

### 1. `src/index.css`
- Add `--spotlight-x`, `--spotlight-y`, `--spotlight-size`, `--spotlight-opacity` custom properties to `:root` and `.dark`
- Add `@layer utilities` class `.spotlight-card` — applies `position: relative; overflow: hidden;` + `::before` pseudo-element with `radial-gradient()` tied to `--spotlight-x/y`
- Add `.spotlight-list-item` — same pattern but with smaller spotlight size and tighter shadow
- All gradients use `hsl()` from existing tokens (`--primary`, `--accent`, `--gold`) so they adapt to the theme automatically

### 2. `src/hooks/useSpotlight.ts` *(new)*
- Hook that returns a `ref` callback
- On `mouseenter`/`mousemove`: reads `offsetX/Y`, writes to element's inline style `--spotlight-x` / `--spotlight-y`
- Throttled via `requestAnimationFrame` for performance
- Cleans up listeners on unmount

### 3. `src/components/ui/card.tsx`
- Add optional `spotlight` prop (default `false`)
- When `spotlight={true}`, applies `spotlight-card` class and wires `useSpotlight` ref
- **Default Card remains unchanged** — opt-in only

### 4. Apply to existing components
Update the following components to opt-in on their main cards / list rows:
- `TodayPanel.tsx` — Stat cards, overdue/pending cards
- `TasksPanel.tsx` — Task list items, card view items
- `ProcessesPanel.tsx` — Process cards / table rows
- `RequestsPanel.tsx` — Request cards / table rows
- `ClientsPanel.tsx` — Client cards / list rows
- `SchedulePanel.tsx` — Schedule items

No functional logic is changed — only className additions and optional ref wiring.

## Technical Details

- **Performance**: Single `requestAnimationFrame` throttle per element; no React re-renders on mouse move
- **Accessibility**: Effect is purely decorative (pseudo-element, `pointer-events: none`). No impact on screen readers or keyboard navigation
- **Theme switching**: All spotlight colors derive from existing CSS variables, so toggling `.dark` immediately adapts without JS
- **Z-index**: Pseudo-element sits at `z-index: 0`; content at `z-index: 1` to preserve clickability
- **Transition**: `opacity 0.4s ease, box-shadow 0.3s ease` for smooth hover-in/hover-out

## No-Go
- No service workers, no canvas, no WebGL
- No changes to business logic or data fetching
- No changes to the shadcn `Table` primitive itself — only the rows rendered inside panels
