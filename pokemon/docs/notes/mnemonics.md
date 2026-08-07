# Pokémon Type Trainer — Mnemonic Workbook

This file is the authoring scratchpad for type-relationship mnemonics.

It is **not loaded by the app**. Only mnemonics copied into `pokemon/js/data/mnemonics.js` are shown to users.

## Workflow

Use these statuses when reviewing a canonical relationship (`attackingType>defendingType`):

- **Missing** — no useful candidate yet.
- **Draft** — candidate wording exists but is not approved.
- **Approved** — solidified and shipped in `mnemonics.js`.
- **Rejected** — considered but deliberately not used.
- **Superseded** — previously used, then replaced by better wording.

A mnemonic may be mapped to more than one relationship when one vivid real-world event naturally teaches all of them. Examples:

- `water>rock` and `water>ground`: “Water erodes rock and soil.”
- `ground>rock` and `ground>steel`: “Earthquakes destroy stone and steel.”

## Style guide

1. Prefer common sayings when they fit naturally.
2. Prefer short wording, usually about 3–8 words.
3. Use the Pokémon type names directly when they create a natural image.
4. Use a concrete example of a type only when it makes the relationship substantially clearer or more memorable.
5. Do not substitute metaphors merely to reuse wording across unrelated types.
6. Prefer one vivid mental image over a technical explanation.
7. Favor memorability over strict scientific precision when the exaggeration is obvious and useful.
8. The mnemonic may use whichever framing is most natural: attacking advantage, defending weakness, attacking weakness, resistance, or immunity.
9. Do not automatically reframe or invert mnemonic wording at runtime.
10. Direction must still be clear enough to reinforce the canonical ordered relationship.
11. Shared mnemonics are encouraged only when a single natural phenomenon genuinely demonstrates multiple relationships.
12. A relationship may remain without a mnemonic rather than shipping a confusing or weak one.

## Approved runtime data

The source of truth for user-visible approved mnemonics is:

`pokemon/js/data/mnemonics.js`

Do not maintain a duplicate full approved list here. This workbook may contain notes about approved wording when useful, but runtime data takes precedence.

## Draft candidates

| Relationship | Candidate | Notes |
|---|---|---|
| `poison>fairy` | Poison spoils fairy magic. | Direction is understandable, but the image feels invented rather than intuitive. |
| `psychic>poison` | The mind controls toxins. | Too abstract; does not create a strong visual scene. |
| `bug>dark` | Bugs expose hidden things. | Weak link to Dark and unclear mechanism. |
| `fairy>fighting` | Fairy magic calms fighters. | Gentle image, but may suggest pacification rather than type advantage. |
| `dark>ghost` | — | Needs a new approach. Literal darkness and “dark magic” candidates were not convincing. |

## Rejected or superseded wording

| Relationship | Wording | Status | Reason |
|---|---|---|---|
| `fire>steel` | Fire weakens steel with heat. | Superseded | Too technical and indirect; replaced by “Fire melts steel.” |
| `water>ground` | Water washes away ground. | Superseded | Replaced by the stronger shared image “Water erodes rock and soil.” |
| `water>rock` | Water erodes rock. | Superseded | Expanded into the shared rock-and-soil mnemonic. |
| `ice>dragon` | Dragons hate the cold. | Superseded | Did not use the memorable fire-breathing image. |
| `ice>dragon` | Cold stops dragon fire. | Superseded | Less personified and more ambiguous than the approved wording. |
| `ground>poison` | Dirt buries poison. | Superseded | “Ground absorbs poison.” is simpler and clearer. |
| `bug>grass` | Bugs eat leaves. | Superseded | “Pests kill plants.” is more visceral. |
| `dark>ghost` | Darkness consumes ghosts. | Rejected | Hard to visualize and does not suggest why the relationship works. |
| `dark>ghost` | Dark magic controls ghosts. | Rejected | Adds an unnecessary concept and still feels arbitrary. |
| `grass>ground` | Plants grow in the ground. | Superseded | Direction was unclear; replaced by “Grass takes root in the ground.” |
| `ground>rock` | Earth shifts break rock. | Superseded | Replaced by the stronger shared earthquake mnemonic. |
| `ground>rock`, `ground>steel` | Earthquakes damage stone and steel. | Superseded | “Destroy” was chosen as more vivid and memorable. |
| `steel>fairy` | Steel cuts through fairy magic. | Superseded | Replaced by the more concrete “Scissors clip fairy wings.” |
| `rock>ice` | Rock shatters ice. | Superseded | Replaced by the idiomatic “Rocks break the ice.” |

## Review checklist

Before approving a mnemonic, ask:

- Can I picture it immediately?
- Is the direction clear?
- Does it reinforce the actual Pokémon relationship rather than a neighboring one?
- Is it simpler than an explanation of the rule?
- Does it avoid extra mental translation?
- Is it distinct enough from mnemonics for similar but differently behaving types?
- Would recalling it during battle be fast?
- Is it strong enough to deserve a lightbulb in the Study view?

## Promotion process

When a draft is approved:

1. Add or reuse a mnemonic ID in `MNEMONICS` inside `pokemon/js/data/mnemonics.js`.
2. Map the canonical relationship key in `RELATIONSHIP_MNEMONICS`.
3. Remove it from **Draft candidates** here.
4. Preserve notable rejected or superseded wording here only when it may prevent repeating old work.
5. Bump the app/service-worker version only because the runtime file changed—not for workbook-only edits.
