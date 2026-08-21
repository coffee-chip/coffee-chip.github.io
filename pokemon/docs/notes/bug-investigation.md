# Bug Investigation Notes

## Active bugs

## Root causes

- Version 2026.08.20.3 deferred router registration until all selected-game type-chart requests completed. On a first load or a failed or slow request, the static header and navigation rendered but no route view was registered.

## Resolved

- 2026.08.20.4 restores immediately responsive navigation and page rendering around the selected-game chart startup load.
- 2026.08.20.5 removes the runtime type-chart fetch entirely. Bundled chart data is available synchronously, so startup and game changes no longer have a chart-loading state.
