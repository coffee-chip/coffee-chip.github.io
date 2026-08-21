# Style Cleanup Notes

## Issues

## Proposed fixes

## Completed

- Standardized overflow/options menu trigger behavior across Study Pokémon cards and Teams: no tap-outside dismissal; tapping the trigger toggles the menu; the trigger shows `⋯` when closed and `×` while expanded; `aria-expanded` tracks the open state. Shared behavior lives in `js/components/overflowMenuButton.js`.
- Removed the Study Pokémon menu's outside `pointerdown` dismissal, which caused a second tap on the trigger to close on pointer-down and reopen on click/pointer-up.
- Clarified CSS ownership around team-related UI: shared `.team-drag-handle` rendering lives in `teams.css`; member-only sizing/edit controls remain in `team-member-controls.css`; Study Pokémon team-picker styles live in `pokemon-lookup.css` because they render only in the Study Pokémon card.
- Standardized key icon-control sizes: team and Study overflow buttons use 2.5rem; team-member action controls use 2rem. Kept those sizes explicit within their feature scopes rather than adding a global size utility.
- Kept `team-member-controls.css` as a separate stylesheet because it contains only member-specific action and edit-form rules.
- My Pokémon is now the first tab in the Teams section and the primary Teams bottom-nav destination.
- Pokémon lookup/add fields in Study and My Pokémon no longer use Search/Add submit buttons. Selecting an autocomplete option is the action that performs the lookup/add. The shared autocomplete emits `pokemon-autocomplete-select` for this behavior.
- My Pokémon no longer shows a success message after adding a Pokémon; errors are still shown.
- Study mode tabs now sit outside the controls panel and use the same shared `button-selector` / `button-selector-option` styling primitive as the Teams/My Pokémon tabs.
