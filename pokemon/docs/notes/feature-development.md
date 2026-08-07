# Feature Development Notes

## In progress

- Team detail view launched from team cards at `#team/<team-id>`.
- Team detail roster shows each Pokémon and its types.
- Removing a Pokémon from a team reuses the team-delete interaction pattern: an × trigger followed by an inline confirmation with Cancel/Remove actions.
- Teams have a persisted `isOpponent` flag editable with an Opponent toggle near the top of the team detail page. Opponent teams use danger coloring for the detail-page title and a subtle danger-colored outline on their team-list card.
- The built-in `Opponents` team defaults to opponent status; existing saved versions of that team without the new flag are normalized to opponent status, while an explicit toggle-off is preserved afterward.
- Each Pokémon row on a team detail page is expandable. The expanded section shows type icons for types the Pokémon has a positive combined advantage score over and types it has a negative combined advantage score against.
- Combined type advantage scoring is centralized in the effectiveness engine. For Pokémon types `Ptypes` and another type `Otype`: `Peffect` is the maximum effectiveness of either Pokémon type against `Otype`; `Oeffect` is `Otype`'s effectiveness against the Pokémon's full type combination. Each multiplier is converted to a tier score using log2 for nonzero values (4→2, 2→1, 1→0, 0.5→-1, 0.25→-2) and immunity 0→-3. Overall advantage is `tier(Peffect) - tier(Oeffect)`.
- Team analysis has Defense and Offense tabs with an 18-type matrix and one Pokémon per column.
- Defense has Weak and Resistant subviews. Weak marks incoming type multipliers >1; Resistant marks incoming type multipliers <1, including immunities.
- Offense has Strong and Weak subviews. Strong marks a defending type when at least one of the Pokémon's own types is >1 effective against it. Weak marks a defending type only when all of the Pokémon's own types are <1 effective against it, representing a true same-type coverage gap.
- Offensive analysis intentionally assumes same-type attack coverage but does not apply STAB.
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
