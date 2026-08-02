import { TYPE_META } from '../data/types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_MARKUP = {
  normal: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="3"/>',
  fire: '<path d="M13 2c1 4-2 5-1 8 1-1 2-2 3-4 3 3 5 6 4 10-1 4-4 6-8 6-5 0-8-3-8-8 0-4 3-7 6-10 0 3 1 5 3 6-1-3 1-5 1-8Z" fill="currentColor"/>',
  water: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" fill="currentColor"/>',
  electric: '<path d="M13 1 5 13h6l-1 10 9-14h-6V1Z" fill="currentColor"/>',
  grass: '<path d="M20 3C10 3 4 8 4 15c0 4 3 6 6 6 7 0 10-8 10-18ZM7 18c3-4 6-7 10-10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  ice: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  fighting: '<path d="M6 5h4v7H6zM10 4h4v8h-4zM14 5h4v8h-4zM5 12h13v5c0 3-2 5-5 5h-3c-3 0-5-2-5-5v-5Z" fill="currentColor"/>',
  poison: '<circle cx="12" cy="9" r="6" fill="currentColor"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="13" cy="19" r="2" fill="currentColor"/><circle cx="18" cy="17" r="2.5" fill="currentColor"/>',
  ground: '<path d="M3 19 9 6h5l7 13H3Z" fill="currentColor"/><path d="m12 19 3-7 4 7h-7Z" fill="white" opacity=".45"/>',
  flying: '<path d="M4 13c5-8 11-9 16-7-3 1-5 3-6 5 2-1 4-1 6 0-4 5-9 8-16 7 3-1 5-3 6-5-2 1-4 1-6 0Z" fill="currentColor"/>',
  psychic: '<path d="M12 20a8 8 0 1 1 8-8c0 4-3 7-7 7-3 0-5-2-5-5 0-2 2-4 4-4s3 1 3 3-1 2-2 2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
  bug: '<ellipse cx="12" cy="13" rx="6" ry="8" fill="currentColor"/><path d="M8 5 5 2M16 5l3-3M6 10 2 8M18 10l4-2M6 16l-4 2M18 16l4 2M12 5v16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  rock: '<path d="m4 18 2-11 8-4 6 6-2 11-10 1-4-3Z" fill="currentColor"/><path d="m7 8 6-3 4 4-5 2-5-3Z" fill="white" opacity=".35"/>',
  ghost: '<path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-2 2-2-2-2 2-2-2-3 2Z" fill="currentColor"/><circle cx="9.5" cy="11" r="1.3" fill="white"/><circle cx="14.5" cy="11" r="1.3" fill="white"/>',
  dragon: '<path d="M4 18c2-8 5-13 10-15l-1 6 6-3-3 6 4 3-7 1-2 5-2-5-5 2Z" fill="currentColor"/>',
  dark: '<path d="M14 3a9 9 0 1 0 7 14A7 7 0 1 1 14 3Z" fill="currentColor"/><path d="m15 8 2 3 4 1-3 2v4l-3-2-3 2v-4l-3-2 4-1 2-3Z" fill="currentColor"/>',
  steel: '<path d="m7 3-5 9 5 9h10l5-9-5-9H7Z" fill="currentColor"/><circle cx="12" cy="12" r="4" fill="white" opacity=".55"/>',
  fairy: '<path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2Z" fill="currentColor"/><path d="m19 3 .8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8L19 3Z" fill="currentColor"/>'
};

function assertType(type) {
  const meta = TYPE_META[type];
  if (!meta) throw new Error(`Unknown type: ${type}`);
  return meta;
}

export function createTypeIcon(type, { className = '' } = {}) {
  const meta = assertType(type);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('type-icon');
  if (className) svg.classList.add(className);
  svg.style.setProperty('--type-color', meta.color);
  svg.innerHTML = ICON_MARKUP[meta.icon];
  return svg;
}

export function createTypeBadge(type, { compact = false, className = '' } = {}) {
  const meta = assertType(type);
  const badge = document.createElement('span');
  badge.className = `type-badge${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`;
  badge.dataset.type = type;
  badge.style.setProperty('--type-color', meta.color);
  badge.append(createTypeIcon(type));

  if (!compact) {
    const label = document.createElement('span');
    label.className = 'type-label';
    label.textContent = meta.label;
    badge.append(label);
  } else {
    badge.setAttribute('aria-label', meta.label);
    badge.title = meta.label;
  }

  return badge;
}

export function createTypeList(types, { emptyText = 'None' } = {}) {
  const list = document.createElement('span');
  list.className = 'type-badge-list';
  if (!types.length) {
    list.textContent = emptyText;
    return list;
  }
  for (const type of types) list.append(createTypeBadge(type));
  return list;
}

export function validateTypeIcons() {
  return Object.keys(TYPE_META).map(type => ({
    type,
    passed: Boolean(ICON_MARKUP[TYPE_META[type].icon])
  }));
}
