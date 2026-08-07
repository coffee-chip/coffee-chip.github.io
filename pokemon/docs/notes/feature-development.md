# Feature Development Notes

## In progress

- Team detail view launched from team cards at `#team/<team-id>`.
- Team detail roster shows each Pokémon and its types, with removal controls.
- Team analysis has Defense and Offense tabs with an 18-type matrix and one Pokémon per column.
- Defense marks an incoming type when the canonical type multiplier against that Pokémon's one/two types is >1.
- Offense marks a defending type when at least one of that Pokémon's own types is >1 effective against it. This intentionally assumes same-type attack coverage but does not apply STAB.
- Team analysis resolves full Pokémon records through the existing Pokémon repository so type logic is not duplicated in team storage.

## Implementation ideas

- Keep the matchup matrix intentionally horizontally scrollable on mobile; freeze the type column so six-member teams remain legible.
- Reuse the canonical effectiveness engine for all team matchup calculations.

## Follow-up work

- Test the team-detail route and matrices in the installed/mobile PWA, especially six-member horizontal scrolling and removal behavior.
- Consider whether team snapshots should eventually persist Pokémon types for fully offline team analysis; current implementation resolves them through the Pokémon repository/cache.
