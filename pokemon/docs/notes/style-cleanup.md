# Style Cleanup Notes

## Issues

## Proposed fixes

## Completed

- Standardized overflow/options menu trigger behavior across Study Pokémon cards and Teams: no tap-outside dismissal; tapping the trigger toggles the menu; the trigger shows `⋯` when closed and `×` while expanded; `aria-expanded` tracks the open state. Shared behavior lives in `js/components/overflowMenuButton.js`.
- Removed the Study Pokémon menu's outside `pointerdown` dismissal, which caused a second tap on the trigger to close on pointer-down and reopen on click/pointer-up.
