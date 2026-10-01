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

Use `actionButton()`, `formActions()`, and `iconButton()` when creating controls in JavaScript.

## Action layouts

Use a small reusable vocabulary:

- `.action-group` — ordinary peer actions.
- `.page-actions` — page-level action group spacing.
- `.card-actions` — actions inside a card.
- `.compact-actions` — icon/compact controls in a dense row.
- `.form-actions` — submit/cancel controls.
- `.form-panel` — panel containing a create/edit form.

Avoid page-specific action classes unless the layout is genuinely unique.

## Design tokens

Shared colors, radii, shadows, and spacing live in `:root` as semantic CSS custom properties. General UI should use tokens instead of raw color values. Specialized decorative effects, such as the pearlescent goal backgrounds, may keep local colors when they are not part of the general application palette.
