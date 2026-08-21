# Bug Investigation Notes

## Active bugs

## Root causes

- Version 2026.08.20.3 deferred router registration until all selected-game type-chart requests completed. On a first load or a failed or slow request, the static header and navigation rendered but no route view was registered. Startup now registers the app immediately and shows a loading/retry route placeholder until the chart is ready.

## Resolved

- 2026.08.20.4 restores immediately responsive navigation and page rendering around the selected-game chart startup load.
