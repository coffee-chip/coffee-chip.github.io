// Mnemonics are authored learning aids, separate from the type-chart engine.
// A canonical relationship key is always ordered: attackingType>defendingType.
export const MNEMONICS = Object.freeze({
  'fire-burns-grass': { text: 'Fire burns grass.' },
  'water-douses-fire': { text: 'Water douses fire.' },
  'electric-charges-water': { text: 'Electricity charges water.' },
  'lightning-strikes-fliers': { text: 'Lightning strikes birds in the sky.' },
  'ground-grounds-electricity': { text: 'Ground grounds electricity.' },
  'water-erodes-rock-and-soil': { text: 'Water erodes rock and soil.' },
  'grass-roots-split-rock': { text: 'Roots split rocks.' },
  'grass-drinks-water': { text: 'Plants drink water.' },
  'grass-takes-root': { text: 'Grass takes root in the ground.' },
  'ice-freezes-grass': { text: 'Frost kills plants.' },
  'ice-freezes-ground': { text: 'Frost freezes the ground.' },
  'ice-grounds-fliers': { text: 'Birds freeze in winter.' },
  'cold-stops-dragon-fire': { text: "Dragons can't breathe fire in the cold." },
  'fighting-beats-normal': { text: 'A punch beats ordinary people.' },
  'fighting-breaks-rock': { text: 'A hammer breaks rocks.' },
  'fighting-bends-steel': { text: 'A hammer bends steel.' },
  'fighting-shatters-ice': { text: 'Ice shatters when struck.' },
  'fighting-beats-dark': { text: 'Bullies beat cowards.' },
  'fire-melts-ice': { text: 'Fire melts ice.' },
  'fire-melts-steel': { text: 'Fire melts steel.' },
  'ground-smothers-fire': { text: 'Dirt smothers fire.' },
  'ground-absorbs-poison': { text: 'Ground absorbs poison.' },
  'rock-kills-birds': { text: 'One stone kills two birds.' },
  'rock-crushes-bugs': { text: 'Rocks crush bugs.' },
  'rock-smothers-fire': { text: 'Rocks smother fire.' },
  'birds-eat-bugs': { text: 'Birds eat bugs.' },
  'birds-eat-seeds': { text: 'Birds eat seeds.' },
  'pests-kill-plants': { text: 'Pests kill plants.' },
  'poison-kills-grass': { text: 'Poison kills plants.' },
  'psychic-controls-fighting': { text: 'Mind over muscle.' },
  'ghost-haunts-psychic': { text: 'Haunting breaks concentration.' },
  'dark-outsmarts-psychic': { text: 'Dirty tricks outsmart careful thought.' },
  'fairy-tames-dragon': { text: 'Fairy-tale magic tames dragons.' },
  'steel-resists-poison': { text: 'Poison cannot sicken steel.' },
  'steel-breaks-rock': { text: 'Steel breaks stone.' },
  'ghosts-haunt-ghosts': { text: 'Ghosts haunt ghosts.' },
  'dragon-slays-dragon': { text: 'Only a dragon can slay a dragon.' },
  'normal-cannot-touch-ghost': { text: 'Ordinary attacks pass through ghosts.' },
  'ghost-cannot-touch-normal': { text: 'Ghostly attacks pass through the ordinary.' }
});

export const RELATIONSHIP_MNEMONICS = Object.freeze({
  'fire>grass': 'fire-burns-grass',
  'water>fire': 'water-douses-fire',
  'electric>water': 'electric-charges-water',
  'electric>flying': 'lightning-strikes-fliers',
  'ground>electric': 'ground-grounds-electricity',
  'water>rock': 'water-erodes-rock-and-soil',
  'water>ground': 'water-erodes-rock-and-soil',
  'grass>rock': 'grass-roots-split-rock',
  'grass>water': 'grass-drinks-water',
  'grass>ground': 'grass-takes-root',
  'ice>grass': 'ice-freezes-grass',
  'ice>ground': 'ice-freezes-ground',
  'ice>flying': 'ice-grounds-fliers',
  'ice>dragon': 'cold-stops-dragon-fire',
  'fighting>normal': 'fighting-beats-normal',
  'fighting>rock': 'fighting-breaks-rock',
  'fighting>steel': 'fighting-bends-steel',
  'fighting>ice': 'fighting-shatters-ice',
  'fighting>dark': 'fighting-beats-dark',
  'fire>ice': 'fire-melts-ice',
  'fire>steel': 'fire-melts-steel',
  'ground>fire': 'ground-smothers-fire',
  'ground>poison': 'ground-absorbs-poison',
  'rock>flying': 'rock-kills-birds',
  'rock>bug': 'rock-crushes-bugs',
  'rock>fire': 'rock-smothers-fire',
  'flying>bug': 'birds-eat-bugs',
  'flying>grass': 'birds-eat-seeds',
  'bug>grass': 'pests-kill-plants',
  'poison>grass': 'poison-kills-grass',
  'psychic>fighting': 'psychic-controls-fighting',
  'ghost>psychic': 'ghost-haunts-psychic',
  'dark>psychic': 'dark-outsmarts-psychic',
  'fairy>dragon': 'fairy-tames-dragon',
  'poison>steel': 'steel-resists-poison',
  'steel>rock': 'steel-breaks-rock',
  'ghost>ghost': 'ghosts-haunt-ghosts',
  'dragon>dragon': 'dragon-slays-dragon',
  'normal>ghost': 'normal-cannot-touch-ghost',
  'ghost>normal': 'ghost-cannot-touch-normal'
});

export function getMnemonicForRelationship(relationshipKey) {
  const mnemonicId = RELATIONSHIP_MNEMONICS[relationshipKey];
  const mnemonic = mnemonicId ? MNEMONICS[mnemonicId] : null;
  return mnemonic ? { id: mnemonicId, relationshipKey, ...mnemonic } : null;
}

export function getMnemonicsForRelationships(relationshipKeys) {
  return relationshipKeys.map(getMnemonicForRelationship).filter(Boolean);
}
