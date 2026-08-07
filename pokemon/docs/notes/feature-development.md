# Feature Development Notes

## In progress

- Team detail view launched from team cards at `#team/<team-id>`.
- Team detail roster shows each Pokémon and its types.
- Removing a Pokémon from a team reuses the team-delete interaction pattern: an × trigger followed by an inline confirmation with Cancel/Remove actions.
- Team analysis has Defense and Offense tabs with an 18-type matrix and one Pokémon per column.
- Defense marks an incoming type when the canonical type multiplier against that Pokémon's one/two types is >1.
- Offense marks a defending type when at least one of that Pokémon's own types is >1 effective against it. This intentionally assumes same-type attack coverage but does not apply STAB.
- Team analysis resolves full Pokémon records through the existing Pokémon repository so type logic is not duplicated in team storage.
- Matchup matrices are intentionally compact: the type column is icon-only, Pokémon names are vertical, images shrink to fit, and horizontal scrolling remains available only as overflow fallback.

## Implementation ideas

- Reuse the canonical effectiveness engine for all team matchup calculations.
- Prefer compact intrinsic table sizing over forcing matchup tables to fill the available width.

## Development workflow

- The user will test the app manually; implementation branches do not need to spend time running browser/device tests unless specifically requested.
- Always bump `APP_VERSION` in `pokemon/service-worker.js` after completing a feature or fix so the installed PWA receives an update.

## Follow-up work

- Consider whether team snapshots should eventually persist Pokémon types for fully offline team analysis; current implementation resolves them through the Pokémon repository/cache.
