# Feature Development Notes

## In progress

- Team detail view launched from team cards at `#team/<team-id>`.
- Team detail roster shows each Pokémon and its types.
- Pokémon individuals are normalized in one persistent `pokemonInstances` map. Each instance stores a stable ID, `speciesId`, optional nickname, optional level (1–100 when set), and up to four normalized current move names; species names, sprites, types, evolutions, and learnsets remain owned by the game-aware Pokémon repository.
- My Pokémon is an ordered `myPokemonIds` collection over those instances. Teams likewise store ordered `memberIds`, so adding an existing My Pokémon to a team shares the same individual record rather than copying it.
- Directly adding a Study species to a team creates a team-only instance whose level may remain unspecified. Team-only and rival Pokémon remain in the central instance repository without appearing in My Pokémon; adding one to My Pokémon initializes a missing level to 1, and removing the final My Pokémon/team reference prunes the orphaned instance.
- Removing a Pokémon from a team reuses the team-delete interaction pattern: an × trigger followed by an inline confirmation with Cancel/Remove actions.
- Team members can be drag-reordered using the same pointer/hold/insertion-marker interaction pattern as team cards; reorder persists only within that team.
- Team member nickname editing updates the shared instance, so the same individual has one nickname everywhere it appears. Clearing it restores the active-game species display name.
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
- Team and My Pokémon views resolve their shared instances through the existing Pokémon repository, so game-aware species data and type logic are not duplicated in instance storage.
- Matchup matrices are intentionally compact: the type column is icon-only, Pokémon names are vertical, images shrink to fit, and horizontal scrolling remains available only as overflow fallback.
- Battle scenario quiz mode uses combined advantage scoring against a displayed Pokémon. Its Answers setting supports Types, Pokémon, or Both.
- Battle scenario type questions ask which hypothetical single-type Pokémon would have positive combined advantage against the displayed Pokémon.
- Battle scenario Pokémon questions show four candidate Pokémon and ask which has the greatest combined type advantage; generation retries until there is a unique highest-scoring candidate so the question remains single-select.
- Answer feedback for Battle Scenario always includes a focused explanation. Pokémon-answer scenarios describe non-neutral attacks for the best option and the user's different choice when applicable; a wrong choice's label also lists its type(s). Type-answer scenarios simply identify the prompt Pokémon's type(s).

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
- Instance storage intentionally omits derived species fields. Team and My Pokémon presentation resolves those fields through the shared Pokémon repository/cache.

- Study Pokémon lookup now shows a game-specific “Moves learned by level” table beneath Incoming damage and Outgoing attacks. The selected game is stored in Settings using PokéAPI version groups, initially FireRed / LeafGreen. Pokémon cache level-up learnsets per selected game, while move type, damage, accuracy, and English description data are cached separately. Tapping a move opens a dismissible bottom details banner.

- Study level-up move rows can be starred. Starred state is persisted by normalized move name independently of Pokémon and level, so it is shared anywhere that move appears. The move table can optionally compare one direct previous/next evolution: rows are merged by level and the compared evolution is visually muted.

- Changing the global game invalidates active requests, materialized Pokémon views, recent lookups, and autocomplete presentation while preserving canonical API records. Pokémon records store compact PokéAPI type history and level-up learnsets for every supported version group, then resolve displayed/calculated types and moves for the selected game (for example, Clefairy is Normal in FireRed / LeafGreen). Explicitly clearing the Pokémon cache still removes all canonical Pokémon, move, encounter, and autocomplete data.

- The active game controls the existing type tools end-to-end: available type choices, the effectiveness engine, Study type lookup, Pokémon incoming/outgoing matchups, team matrices, and type-answer quizzes. The compact chart data is bundled with the PWA and selected synchronously by game generation, so type tools and quizzes remain fully offline. Changing games invalidates active game-resolved views and immediately switches the active ruleset.

- Pokémon availability now follows the selected game generation across existing lookup surfaces. Study autocomplete and direct lookups are limited to the corresponding National Pokédex range, unavailable recent entries are discarded, evolution controls hide forms introduced later, and Pokémon quiz pools offer only generations available in the selected game. Evolution requirements also retain PokéAPI's introduced version group and display the newest rule applicable to the selected game rather than every historical rule.

- Relationship identity is now resolved through the selected game’s type chart. Generic attack direction (`attacking>defending`) is combined with the current chart outcome to create the canonical learned key: `:atk-adv` or `:def-adv`. Progress and mnemonics use only that directional key, so they carry across every chart era with the same direction while facts that changed between eras remain distinct. Neutral pairs have no learned relationship key. Existing generic relationship statistics are reset during the storage-v10 migration; authored mnemonic text is retained and re-keyed to directional relationships.

- Pokémon recognition progress is keyed by Pokémon ID and the resolved type set, such as `35:normal` or `35:fairy`. Each record also carries its applicable generation range, allowing adaptive sampling and Progress rankings to select the fact that applies to the current game while sharing unchanged type knowledge across games. Storage v11 clears the older ID-only recognition records.

- Move details already resolve type, power, accuracy, and flavor text through the selected PokéAPI version group. They now additionally resolve historical effect text and the pre-Generation-IV type-based Physical/Special split; move details show Power, Class, and Accuracy.

- Shared Pokémon autocomplete accepts a suggestion on `click`, rather than removing it during `pointerdown`; this prevents a touch tap from falling through to the button beneath the popup. It closes on outside pointer presses or when focus leaves the autocomplete field.


- Study Pokémon results now end with a selected-game “Where to find” section backed by PokéAPI’s version-specific location-area encounter endpoint. Locations, encounter method, level range, chance, version differences, and conditions are cached with the Pokémon for the active version group. The UI states that gifts, trades, fossils, and evolution-only acquisition sources may not be represented.


- My Pokémon cards now open an individual owned-entry page from the card body while the image continues to open that species in Study. The detail route is keyed by the entry's stable ID, shows its nickname/species/type information, and reuses the complete level-up move component. The Study evolution arrow/chooser controls are also reused: either arrow changes only that owned entry to the adjacent form while preserving its stable ID and nickname.

- Owned Pokémon level and current moves belong to the individual roster entry, not the shared Pokémon cache. Level defaults to 1 and is constrained to 1–100; current moves are normalized move names capped at four.
- Current moves are selected from the active game version's existing level-up move table. They persist when the owned Pokémon is evolved up or down so retained pre-evolution moves are not discarded; comparison-evolution rows are informational and cannot be selected.

- Current-move summary buttons open the same version-aware move detail banner as move names in the level-up table. Current moves are removed only by toggling the checked control in the table.
- My Pokémon roster ordering is user-controlled and persisted. Its drag handle uses the same pointer-capture, touch hold delay, insertion marker, and immediate-save behavior as the Team detail Members list; reordering is disabled while the roster search filter is active so hidden entries cannot make the target order ambiguous.

- Storage v12 replaces owned-entry arrays and team species snapshots with the normalized instance model. Older storage is intentionally reset rather than migrated during active development.
- The owned Pokémon detail overflow menu can add that exact instance to a team. Study additions still create new individuals: adding to My Pokémon creates an owned instance, while adding directly to a team creates a team-only instance. Distinct instances of the same species are allowed on one team; the same instance cannot be added twice.

- Storage v13 uses one IndexedDB database as the canonical persistent location. Small app state (settings, progress, starred moves, recent lookups, instances, My Pokémon ordering, and teams) occupies one store; canonical Pokémon, move, and autocomplete-index API records occupy their own stores. Cache writes are asynchronous and no longer serialize or duplicate the full app state. Older localStorage data is intentionally ignored rather than migrated.

- Storage v14 deliberately resets the v13 database. User-state writes are coalesced on a high-priority queue separate from disposable API-cache writes, expose pending/committed/error status, and no longer report a queued write as durably saved. Canonical Pokémon and move records contain all supported version-group projections from one API payload; the National Dex name index is stored once and sliced at the output boundary. Repository requests are deduplicated, commit merges are serialized per entity, and game/cache epochs reject stale completions.
- Installed PWA shells are immutable per app version. The active worker serves only its own complete dependency closure; shell entries are never updated piecemeal at runtime. `scripts/validate-service-worker-assets.mjs` verifies that every local HTML/CSS/JavaScript/manifest dependency is precached exactly once and exists on disk.
## My Pokémon roster controls

The My Pokémon page keeps adding secondary to browsing: a compact `+ Add Pokémon` action expands the autocomplete field and focuses it, and collapses again after selection or explicit dismissal. Roster filtering uses the native `hidden` state backed by a global author-level rule so component display styles cannot accidentally override it.

Roster search performs prefix matching independently against nickname, species name, Pokédex number, and each type resolved for the selected game. It does not match arbitrary substrings inside those fields.

Roster level sorting is a display mode rather than a stored reorder. Low-to-high and high-to-low preserve manual order as the tie-breaker, keep missing levels last, and disable drag handles until manual order is restored.

Roster type-advantage sorting treats the selected one- or two-type combination as an opponent Pokémon and ranks owned Pokémon by `getPokemonTypeAdvantageScore`. It is display-only, breaks equal-score ties by level from high to low and then manual order, places unresolved Pokémon last, and excludes the first selected type from the optional second-type choices.
