/**
 * Core domain types for the Water Sort Puzzle engine.
 * This module has ZERO UI dependencies and is safe to import anywhere
 * (React components, Zustand store, Web Workers, unit tests).
 */

/** A CSS hex color string, e.g. `#FF6B6B`. Used as the identity of a liquid. */
export type ColorHex = string;

/**
 * A Tube is a stack represented by an array of ColorHex.
 * Index 0 is the bottom, index `length - 1` is the top.
 */
export type Tube = ColorHex[];

/** A single pour action, fully reversible thanks to `colorsPoured` + `count`. */
export interface Move {
  /** Index of the source tube. */
  from: number;
  /** Index of the target tube. */
  to: number;
  /** The exact segments that were moved (all identical by the pour rule). */
  colorsPoured: ColorHex[];
  /** Number of segments moved (equals `colorsPoured.length`). */
  count: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: Difficulty;
  tubeCapacity: number;
  colorCount: number;
  emptyTubes: number;
  minOptimalMoves: number;
}

/** A fully generated, playable level: config + initial tube layout. */
export interface Level {
  config: LevelConfig;
  tubes: Tube[];
}

/** Runtime game state (consumed by the Zustand store). */
export interface GameState {
  level: Level;
  tubes: Tube[];
  /** History stack of applied moves; popping + reversing implements undo. */
  history: Move[];
  moveCount: number;
  isWon: boolean;
}

/** Why a pour was rejected (useful for UI feedback such as shake/thud). */
export type PourRejection =
  | 'invalid-index'
  | 'same-tube'
  | 'source-empty'
  | 'target-full'
  | 'color-mismatch'
  | 'trivial-move';

export type PourValidation =
  | { ok: true; count: number; color: ColorHex }
  | { ok: false; reason: PourRejection };

/** Result of applying a pour: a new (immutable) tube array plus the move record. */
export interface PourResult {
  tubes: Tube[];
  move: Move;
}

export interface StateValidation {
  valid: boolean;
  errors: string[];
}

export type SolveStatus = 'solved' | 'unsolvable' | 'limit-exceeded';

export interface SolveResult {
  status: SolveStatus;
  /** Moves from the given state to a winning state (empty if already won). */
  moves: Move[] | null;
  /** Number of unique canonical states visited. */
  statesExplored: number;
}

export interface SolverOptions {
  /** Units per tube. Default: 4. */
  capacity?: number;
  /** Safety budget on unique canonical states explored. Default: 300_000. */
  maxStates?: number;
  /** Budget for the heuristic DFS fallback used by the hint finder. Default: 1_000_000. */
  fallbackMaxStates?: number;
}
