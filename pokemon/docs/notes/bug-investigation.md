# Bug Investigation Notes

## Active bugs

## Root causes

- Version 2026.08.20.3 deferred router registration until all selected-game type-chart requests completed. On a first load or a failed or slow request, the static header and navigation rendered but no route view was registered.

## Resolved

- 2026.08.27.1 replaces the monolithic synchronous browser-storage cache that could stall navigation after Pokémon data accumulated. Persistent app state and cached API records now use separate stores in one IndexedDB database, cache writes are queued asynchronously, and views no longer walk or rewrite the full cache during navigation.
- 2026.08.20.4 restores immediately responsive navigation and page rendering around the selected-game chart startup load.
- 2026.08.20.5 removes the runtime type-chart fetch entirely. Bundled chart data is available synchronously, so startup and game changes no longer have a chart-loading state.

- 2026.08.21.4 closes the autocomplete popup after restoring input focus on suggestion selection. This prevents the focus handler from recreating a one-item popup after a selection.
