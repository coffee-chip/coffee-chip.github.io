# Feature Development Notes

## In progress

- Team detail view launched from team cards at `#team/<team-id>`.
- Team detail roster shows each Pokémon and its types.
- Removing a Pokémon from a team reuses the team-delete interaction pattern: an × trigger followed by an inline confirmation with Cancel/Remove actions.
- Team members can be drag-reordered using the same pointer/hold/insertion-marker interaction pattern as team cards; reorder persists only within that team.
- Team members have an edit control for a team-local display-name alias. The alias is stored on the team Pokémon snapshot and does not modify the shared Pokémon cache/repository. Clearing the edit field resets to the canonical fetched display name.
- Team-level Rename, Rival, Opponent, and Delete actions are centralized in a shared overflow-menu component used by both team cards and the single-team view. Team cards keep the separate drag handle.
- Rivalries are persisted as reciprocal one-to-one team links using `rivalTeamId`. Setting a rivalry automatically clears any previous rival on either side; clearing or deleting a team also clears the reciprocal link.
- Rival assignment/change/removal is available from the shared team actions menu in both the Teams list and single-team page. The single-team page additionally shows a direct `Rival: {team} →` navigation link below its Members / Matchups / Advantage selector when a rival exists; Teams list cards intentionally do not show rival goto links yet.
- Teams have a persisted `isOpponent` flag. Opponent teams use danger coloring for the detail-page title and a subtle danger-colored outline on their team-list card.
- `My team` and `Opponents` are initial defaults for fresh storage only. Existing stored teams are authoritative; deleted defaults are not re-injected.
- Each Pokémon row on a team detail page is expandable. The expanded section shows type icons for types the Pokémon has a positive combined advantage score over and types it has a negative combined advantage score against.
- Combined type advantage scoring is centralized in the effectiveness engine. For Pokémon types `Ptypes` and another type `Otype`: `Peffect` is the maximum effectiveness of either Pokémon type against `Otype`; `Oeffect` is `Otype`'s effectiveness against the Pokémon's full type combination. Each multiplier is converted to a tier score using log2 for nonzero values (4→2, 2→1, 1→0, 0.5→-1, 0.25→-2) and immunity 0→-3. Overall advantage is `tier(Peffect) - tier(Oeffect)`.
- Team analysis has Defense and Offense tabs with an 18-type matrix and one Pokémon per column.
- Defense has Weak and Resistant subviews. Weak marks incoming type multipliers >1; Resistant marks incoming type multipliers <1, including immunities.
- Offense has Strong and Weak subviews. Strong marks a defending type when at least one of the Pokémon's own types is >1 effective against it. Weak marks a defending type only when all of the Pokémon's own types are <1 effective against it, representing a true same-type coverage gap.
- Matchup relationship colors are perspective-aware. For ordinary teams, Offense/Strong and Defense/Resistant use success styling while Offense/Weak and Defense/Weak use danger styling. For opponent teams the semantic colors reverse.
- Offense/Defense remain mutually exclusive, but the two relationship filters within the active mode can be selected independently and displayed together. Cells use one success/danger dot because the relationship predicates are mutually exclusive per cell.
- Team detail has top-level Members / Matchups / Advantage tabs so the roster, raw matchup matrix, and overall advantage matrix are shown separately.
- Overall advantage matrix uses the combined advantage score. Ordinary teams show positive-score green dots; opponent teams show negative-score red dots. Dot intensity buckets are magnitude 1, 2, and 3+.
- Offensive analysis intentionally assumes same-type attack coverage but does not apply STAB.
- Team analysis resolves full Pokémon records through the existing Pokémon repository so type logic is not duplicated in team storage.
- Matchup matrices are intentionally compact: the type column is icon-only, Pokémon names are vertical, images shrink to fit, and horizontal scrolling remains available only as overflow fallback.
- Battle scenario quiz mode uses combined advantage scoring against a displayed Pokémon. Its Answers setting supports Types, Pokémon, or Both.
- Battle scenario type questions ask which hypothetical single-type Pokémon would have positive combined advantage against the displayed Pokémon.
- Battle scenario Pokémon questions show four candidate Pokémon and ask which has the greatest combined type advantage; generation retries until there is a unique highest-scoring candidate so the question remains single-select.

## Implementation ideas

- Reuse the canonical effectiveness engine for all team matchup calculations.
- Prefer compact intrinsic table sizing over forcing matchup tables to fill the available width.
- Keep team-level management actions in the shared overflow-menu component so list and detail views do not drift apart.
- Treat rivalry as a symmetric relationship; perspective remains separate and comes from the viewed team and `isOpponent` state.

## Development workflow

- The user will test the app manually; implementation branches do not need to spend time running browser/device tests unless specifically requested.
- Always bump `APP_VERSION` in `pokemon/service-worker.js` after completing a feature or fix so the installed PWA receives an update.
- Storage migrations are not required during active development unless the user explicitly requests safe migration work.

## Follow-up work

- Use rivalry as the default pairing primitive for future full-team-vs-full-team creation and evaluation.
- Consider whether team snapshots should eventually persist Pokémon types for fully offline team analysis; current implementation resolves them through the Pokémon repository/cache.
