export function truncateText(value, maxLength, ellipsis = '…') {
  const text = String(value ?? '');
  const limit = Math.max(0, Math.floor(Number(maxLength) || 0));
  if (!limit || text.length <= limit) return text;
  if (limit <= ellipsis.length) return ellipsis.slice(0, limit);
  return `${text.slice(0, limit - ellipsis.length).trimEnd()}${ellipsis}`;
}
