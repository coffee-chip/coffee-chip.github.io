import { state } from '../state.js';
import { saveStarredMoves } from '../storage.js';

function normalizeMoveName(identifier) {
  return String(identifier ?? '').trim().toLowerCase();
}

export function isMoveStarred(identifier) {
  const moveName = normalizeMoveName(identifier);
  return Boolean(moveName) && state.starredMoves.includes(moveName);
}

export function setMoveStarred(identifier, starred) {
  const moveName = normalizeMoveName(identifier);
  if (!moveName) return false;
  const moves = new Set(state.starredMoves);
  if (starred) moves.add(moveName);
  else moves.delete(moveName);
  state.starredMoves = [...moves];
  void saveStarredMoves(state.starredMoves);
  return true;
}
