// Mnemonics are authored learning aids, separate from the type-chart engine.
// A canonical relationship key is always ordered: attackingType>defendingType.
export const MNEMONICS = Object.freeze({
  'fire-burns-grass': { text: 'Fire burns grass.' },
  'water-douses-fire': { text: 'Water douses fire.' },
  'electric-charges-water': { text: 'Electricity charges water.' },
  'lightning-strikes-fliers': { text: 'Lightning strikes fliers in the sky.' },
  'ground-neutralizes-electricity': { text: 'Ground neutralizes electricity.' },
  'water-erodes-rock': { text: 'Water erodes rock.' },
  'grass-roots-split-rock': { text: 'Roots split rock apart.' },
  'water-soaks-ground': { text: 'Water saturates the ground.' },
  'grass-drinks-water': { text: 'Grass drinks up water.' },
  'ice-freezes-grass': { text: 'Ice freezes fragile grass.' },
  'ice-grounds-fliers': { text: 'Ice weighs down frozen wings.' },
  'ice-stops-dragons': { text: 'Ice freezes dragons in their tracks.' },
  'fighting-breaks-rock': { text: 'Fighting smashes rock.' },
  'fighting-dents-steel': { text: 'Fighting dents steel.' },
  'fighting-shatters-ice': { text: 'Fighting shatters ice.' },
  'fire-melts-ice': { text: 'Fire melts ice.' },
  'fire-heats-steel': { text: 'Fire weakens steel with heat.' },
  'ground-buries-fire': { text: 'Ground smothers fire.' },
  'rock-knocks-down-fliers': { text: 'Rocks knock fliers from the sky.' },
  'rock-crushes-bugs': { text: 'Rocks crush bugs.' },
  'flying-eats-bugs': { text: 'Flying creatures eat bugs.' },
  'bugs-eat-grass': { text: 'Bugs eat grass.' },
  'poison-kills-grass': { text: 'Poison kills plants.' },
  'psychic-controls-fighting': { text: 'Mind over muscle.' },
  'ghost-haunts-psychic': { text: 'Haunting breaks concentration.' },
  'dark-outsmarts-psychic': { text: 'Dirty tricks outsmart careful thought.' },
  'fairy-tames-dragon': { text: 'Fairy-tale magic tames dragons.' },
  'steel-resists-poison': { text: 'Poison cannot sicken steel.' },
  'normal-cannot-touch-ghost': { text: 'Ordinary attacks pass through ghosts.' },
  'ghost-cannot-touch-normal': { text: 'Ghostly attacks pass through the ordinary.' }
});

export const RELATIONSHIP_MNEMONICS = Object.freeze({
  'fire>grass': 'fire-burns-grass',
  'water>fire': 'water-douses-fire',
  'electric>water': 'electric-charges-water',
  'electric>flying': 'lightning-strikes-fliers',
  'ground>electric': 'ground-neutralizes-electricity',
  'water>rock': 'water-erodes-rock',
  'grass>rock': 'grass-roots-split-rock',
  'water>ground': 'water-soaks-ground',
  'grass>water': 'grass-drinks-water',
  'ice>grass': 'ice-freezes-grass',
  'ice>flying': 'ice-grounds-fliers',
  'ice>dragon': 'ice-stops-dragons',
  'fighting>rock': 'fighting-breaks-rock',
  'fighting>steel': 'fighting-dents-steel',
  'fighting>ice': 'fighting-shatters-ice',
  'fire>ice': 'fire-melts-ice',
  'fire>steel': 'fire-heats-steel',
  'ground>fire': 'ground-buries-fire',
  'rock>flying': 'rock-knocks-down-fliers',
  'rock>bug': 'rock-crushes-bugs',
  'flying>bug': 'flying-eats-bugs',
  'bug>grass': 'bugs-eat-grass',
  'poison>grass': 'poison-kills-grass',
  'psychic>fighting': 'psychic-controls-fighting',
  'ghost>psychic': 'ghost-haunts-psychic',
  'dark>psychic': 'dark-outsmarts-psychic',
  'fairy>dragon': 'fairy-tames-dragon',
  'poison>steel': 'steel-resists-poison',
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
