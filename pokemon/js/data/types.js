export const TYPES = [
  'normal','fire','water','electric','grass','ice','fighting','poison','ground',
  'flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'
];

export const TYPE_META = Object.fromEntries(
  TYPES.map(id => [id, {
    id,
    label: id[0].toUpperCase() + id.slice(1),
    color: \`var(--type-\${id})\`,
    icon: id
  }])
);
