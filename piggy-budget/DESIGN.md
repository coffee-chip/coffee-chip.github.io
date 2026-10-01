# Piggy Budget UI conventions

## Form activities

Create and edit activities use the same three-step interaction:

1. **Open** — a trigger reveals the form. Triggers open; they do not also act as the close control.
2. **Submit** — the primary action commits the change.
3. **Cancel** — a visible Cancel action exits without saving and discards unsaved input.

Use the shared `disclosure()` helper for open/close state so `hidden`, `aria-expanded`, `aria-controls`, and initial focus behave consistently.

Successful create/transfer activities reset and close their forms. Edit activities re-render from saved state after submit or cancel so unsaved changes cannot leak into the next edit.

## Button system

Button classes are composed by dimension instead of encoding page-specific behavior.

### Interaction component

- `.button` — shared geometry and interaction states.
- Hover, active, disabled, and focus behavior belongs here rather than in each visual variant.

### Visual style

- `.button--primary` — emphasized action.
- `.button--secondary` — outlined/lower-emphasis action.
- `.button--transparent` — low-emphasis action with no persistent surface.

These variants set CSS custom properties consumed by the shared `.button` state rules.

### Context modifiers

- `.button--compact` — reduced-size control.
- `.button--icon` — square icon action.
- `.button--danger` — destructive tone without redefining interaction behavior.

Destructive X/icon actions always require an explicit confirmation prompt before data is deleted.

Use `actionButton()`, `formActions()`, and `iconButton()` when creating controls in JavaScript.

## Action layouts

Use a small reusable vocabulary:

- `.action-group` — ordinary peer actions.
- `.launch-actions` — actions that reveal a separate following card; provides spacing between the trigger group and that card.
- `.card-actions` — actions inside a card.
- `.compact-actions` — icon/compact controls in a dense row.
- `.form-actions` — submit/cancel controls.
- `.panel--narrow` — reusable width modifier for constrained panels.

Avoid page-specific action classes unless the layout is genuinely unique.

## Initial rendering

Dynamic page content is hidden while the page module performs its first render. `theme.js` marks the document as `app-hydrating` before CSS paints, and `setupPage()` removes that state immediately after the initial render and storage warning are complete. The header remains visible, so navigation feels immediate without exposing partially constructed cards or forms. A short fail-open timeout prevents the page from remaining hidden if initialization fails.

## Page spacing

The app shell owns the standard gap below the header via `main` padding (currently 16px). Top-level page components do not add top spacing. Top-level siblings use bottom spacing so the header gap is deterministic and does not depend on CSS margin-collapsing behavior. The final top-level item keeps that bottom spacing; the page shell already provides the outer page padding.

Margin collapsing can still occur naturally inside ordinary block content, but it is not used as the page-spacing contract because padding, borders, flex, and grid contexts change when margins collapse.

## Themes and design tokens

Color and appearance are independent preferences:

- Color themes: Garnet, Amber, Lapis.
- Appearance: Light, Dark, System.
- UI preferences are stored separately from budget data and are not part of budget backups.
- `theme.js` applies the saved preferences before the stylesheet paints. System appearance follows `prefers-color-scheme` and updates when the OS preference changes.

Shared colors, radii, shadows, and spacing live in semantic CSS custom properties. General UI must consume those variables instead of hard-coded theme colors.

Theme-facing color variables include the core surface/text palette plus:

- `--color-accent-soft`
- `--color-accent-alt`
- `--color-accent-translucent`
- `--color-shadow-tint`
- `--color-pearl-border`

The pearlescent goal material also uses dedicated `--pearl-*` variables. Those variables describe the material treatment rather than a specific page, and dark appearance provides an appropriately darker pearl treatment.
