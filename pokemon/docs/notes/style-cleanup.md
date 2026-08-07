# Style Cleanup Notes

## Issues

## Proposed fixes

## Completed

- Standardized overflow/options menu trigger behavior across Study Pokémon cards and Teams: no tap-outside dismissal; tapping the trigger toggles the menu; the trigger shows `⋯` when closed and `×` while expanded; `aria-expanded` tracks the open state. Shared behavior lives in `js/components/overflowMenuButton.js`.
- Removed the Study Pokémon menu's outside `pointerdown` dismissal, which caused a second tap on the trigger to close on pointer-down and reopen on click/pointer-up.
- Clarified CSS ownership around team-related UI: shared `.team-drag-handle` rendering lives in `teams.css`; member-only sizing/edit controls remain in `team-member-controls.css`; Study Pokémon team-picker styles were moved out of `teams.css` into `pokemon-lookup.css`.
- Reviewed icon-button dimensions and kept context-specific sizes rather than introducing a premature shared size variant: team actions use 2.5rem, Study Pokémon menu actions 2.25rem, and team-member controls 2.1rem (1.95rem on narrow screens).
- Kept `team-member-controls.css` as a separate stylesheet because, after removing shared drag rendering, it now contains only member-specific action and edit-form rules.
