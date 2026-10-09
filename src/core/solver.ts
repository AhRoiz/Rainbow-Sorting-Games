/**
 * Canonical BFS solver with symmetry reduction + hint finder.
 *
 * Symmetry reduction: tube order is irrelevant to solvability, so N tubes
 * yield up to N! equivalent states. Each state is reduced to a canonical key
 * (tubes sorted lexicographically, then joined) before checking `visited`.
 *
 * Internally colors are encoded as single characters and tubes as strings,
 * which makes hashing, slicing and comparisons very cheap.
 */
import { DEFAULT_CAPACITY, WaterSortEngine } from './engine';
import type { ColorHex, Move, SolveResult, SolverOptions, Tube } from './types';

export const DEFAULT_MAX_STATES = 300_000;
export const DEFAULT_FALLBACK_MAX_STATES = 1_000_000;

/** Encoded state: one string per tube, one char per color unit (bottom -> top). */
type EncodedState = string[];

interface InternalMove {
  from: number;
  to: number;
  count: number;
  color: string;
}

interface ParentLink {
  parent: string | null;
  move: InternalMove | null;
}

interface Codec {
  encode: (tubes: readonly Tube[]) => EncodedState;
  decodeColor: (ch: string) => ColorHex;
}

// -----------------------------------------------------------------------------
// Encoding helpers
// -----------------------------------------------------------------------------

function createCodec(tubes: readonly Tube[]): Codec {
  const toChar = new Map<ColorHex, string>();
  const toColor = new Map<string, ColorHex>();
  for (const tube of tubes) {
    for (const color of tube) {
      if (!toChar.has(color)) {
        // Start at '0' (code 48); stays well clear of the '|' separator for any realistic palette.
        const ch = String.fromCharCode(48 + toChar.size);
        toChar.set(color, ch);
        toColor.set(ch, color);
      }
    }
  }
  return {
    encode: (ts) => ts.map((t) => t.map((c) => toChar.get(c) ?? '').join('')),
    decodeColor: (ch) => toColor.get(ch) ?? ch,
  };
}

/** Canonical (order-independent) key for symmetry reduction. */
export function canonicalKey(state: readonly string[]): string {
  return state.slice().sort().join('|');
}

function isWonEncoded(state: EncodedState, capacity: number): boolean {
  for (const t of state) {
    if (t.length === 0) continue;
    if (t.length !== capacity) return false;
    const c = t.charCodeAt(0);
    for (let i = 1; i < t.length; i++) if (t.charCodeAt(i) !== c) return false;
  }
  return true;
}

function topRun(t: string): number {
  const n = t.length;
  if (n === 0) return 0;
  const top = t.charCodeAt(n - 1);
  let run = 1;
  while (run < n && t.charCodeAt(n - 1 - run) === top) run++;
  return run;
}

/**
 * Generates legal moves following the engine rules, with one extra
 * optimality-preserving pruning: when several empty tubes exist, only the
 * first one is considered as a target (all empty targets are symmetric).
 */
function expand(state: EncodedState, capacity: number): InternalMove[] {
  const moves: InternalMove[] = [];
  const n = state.length;
  const firstEmpty = state.indexOf('');

  for (let from = 0; from < n; from++) {
    const src = state[from];
    if (src.length === 0) continue;
    const run = topRun(src);
    const uniform = run === src.length;
    // A full uniform tube is already solved; it can never usefully move.
    if (uniform && src.length === capacity) continue;
    const top = src[src.length - 1];

    for (let to = 0; to < n; to++) {
      if (to === from) continue;
      const dst = state[to];
      if (dst.length >= capacity) continue;
      if (dst.length === 0) {
        if (uniform || to !== firstEmpty) continue;
      } else if (dst[dst.length - 1] !== top) {
        continue;
      }
      moves.push({ from, to, count: Math.min(run, capacity - dst.length), color: top });
    }
  }
  return moves;
}

function applyEncoded(state: EncodedState, m: InternalMove): EncodedState {
  const next = state.slice();
  next[m.from] = state[m.from].slice(0, state[m.from].length - m.count);
  next[m.to] = state[m.to] + m.color.repeat(m.count);
  return next;
}

function toPublicMove(m: InternalMove, codec: Codec): Move {
  const color = codec.decodeColor(m.color);
  return {
    from: m.from,
    to: m.to,
    count: m.count,
    colorsPoured: Array.from({ length: m.count }, () => color),
  };
}

function assertValid(tubes: readonly Tube[], capacity: number): void {
  const check = new WaterSortEngine(capacity).validateState(tubes);
  if (!check.valid) throw new Error(`Invalid puzzle state: ${check.errors.join('; ')}`);
}

// -----------------------------------------------------------------------------
// BFS (shortest / optimal path)
// -----------------------------------------------------------------------------

/**
 * Breadth-first search over canonical states. Guarantees the minimum number
 * of moves when `status === 'solved'`.
 */
export function solveDetailed(tubes: readonly Tube[], options: SolverOptions = {}): SolveResult {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  assertValid(tubes, capacity);

  const codec = createCodec(tubes);
  const start = codec.encode(tubes);
  if (isWonEncoded(start, capacity)) return { status: 'solved', moves: [], statesExplored: 1 };

  const startKey = canonicalKey(start);
  const parents = new Map<string, ParentLink>([[startKey, { parent: null, move: null }]]);
  const queueStates: (EncodedState | undefined)[] = [start];
  const queueKeys: string[] = [startKey];
  let head = 0;

  while (head < queueStates.length) {
    const state = queueStates[head] as EncodedState;
    const key = queueKeys[head];
    queueStates[head] = undefined; // release memory early
    head++;

    for (const m of expand(state, capacity)) {
      const next = applyEncoded(state, m);
      const nextKey = canonicalKey(next);
      if (parents.has(nextKey)) continue;
      parents.set(nextKey, { parent: key, move: m });

      if (isWonEncoded(next, capacity)) {
        return {
          status: 'solved',
          moves: reconstruct(parents, nextKey).map((im) => toPublicMove(im, codec)),
          statesExplored: parents.size,
        };
      }
      if (parents.size >= maxStates) {
        return { status: 'limit-exceeded', moves: null, statesExplored: parents.size };
      }
      queueStates.push(next);
      queueKeys.push(nextKey);
    }
  }

  return { status: 'unsolvable', moves: null, statesExplored: parents.size };
}

function reconstruct(parents: Map<string, ParentLink>, endKey: string): InternalMove[] {
  const path: InternalMove[] = [];
  let link = parents.get(endKey);
  while (link && link.move && link.parent !== null) {
    path.push(link.move);
    link = parents.get(link.parent);
  }
  return path.reverse();
}

/**
 * Returns the shortest optimal path, or `null` if unsolvable or the search
 * budget (`maxStates`) is exhausted.
 */
export function solve(tubes: readonly Tube[], options: SolverOptions = {}): Move[] | null {
  return solveDetailed(tubes, options).moves;
}

// -----------------------------------------------------------------------------
// Heuristic DFS fallback (fast, not necessarily optimal)
// -----------------------------------------------------------------------------

/** Lower is better: prefers completing tubes and stacking onto matching colors. */
function moveScore(state: EncodedState, m: InternalMove, capacity: number): number {
  const src = state[m.from];
  const dst = state[m.to];
  let score = 0;
  if (dst.length + m.count === capacity && topRun(dst) === dst.length) score -= 100; // completes a tube
  if (m.count === topRun(src)) score -= 10; // moves the whole top run
  if (src.length === m.count) score -= 5; // empties the source
  if (dst.length === 0) score += 20; // spending an empty tube is costly
  return score;
}

/**
 * Depth-first search with greedy move ordering. Used when BFS exceeds its
 * budget (large "hard" levels) so the hint system always has an answer.
 */
export function solveAny(tubes: readonly Tube[], options: SolverOptions = {}): SolveResult {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  assertValid(tubes, capacity);

  const codec = createCodec(tubes);
  const start = codec.encode(tubes);
  if (isWonEncoded(start, capacity)) return { status: 'solved', moves: [], statesExplored: 1 };

  const visited = new Set<string>([canonicalKey(start)]);
  interface Frame {
    state: EncodedState;
    moves: InternalMove[];
    next: number;
  }
  const sortedMoves = (s: EncodedState): InternalMove[] =>
    expand(s, capacity).sort((a, b) => moveScore(s, a, capacity) - moveScore(s, b, capacity));

  const stack: Frame[] = [{ state: start, moves: sortedMoves(start), next: 0 }];
  const path: InternalMove[] = [];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next >= frame.moves.length) {
      stack.pop();
      path.pop();
      continue;
    }
    const m = frame.moves[frame.next++];
    const next = applyEncoded(frame.state, m);
    const key = canonicalKey(next);
    if (visited.has(key)) continue;
    visited.add(key);
    path.push(m);

    if (isWonEncoded(next, capacity)) {
      return {
        status: 'solved',
        moves: path.map((im) => toPublicMove(im, codec)),
        statesExplored: visited.size,
      };
    }
    if (visited.size >= maxStates) {
      return { status: 'limit-exceeded', moves: null, statesExplored: visited.size };
    }
    stack.push({ state: next, moves: sortedMoves(next), next: 0 });
  }

  return { status: 'unsolvable', moves: null, statesExplored: visited.size };
}

// -----------------------------------------------------------------------------
// Hint finder
// -----------------------------------------------------------------------------

/**
 * Next recommended move for the in-game hint button.
 * Tries the optimal BFS first; if the budget is exceeded it falls back to the
 * heuristic DFS. Returns `null` when the puzzle is already won or the current
 * position is a dead end (player should undo/restart).
 */
export function getNextBestMove(tubes: readonly Tube[], options: SolverOptions = {}): Move | null {
  const optimal = solveDetailed(tubes, options);
  if (optimal.status === 'solved') return optimal.moves?.[0] ?? null;
  if (optimal.status === 'unsolvable') return null;

  const fallback = solveAny(tubes, {
    ...options,
    maxStates: options.fallbackMaxStates ?? DEFAULT_FALLBACK_MAX_STATES,
  });
  return fallback.moves?.[0] ?? null;
}
