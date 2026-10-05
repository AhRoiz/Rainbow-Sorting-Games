/**
 * WaterSortEngine — pure, immutable game rules.
 *
 * Rules (see PROJECT_SPEC §4):
 *  1. Capacity is fixed per level (default 4).
 *  2. Pour rule:
 *     - source must not be empty
 *     - target must not be full
 *     - poured color must match the target's top color, or the target is empty
 *     - trivial-move pruning: never pour a single-uniform-color tube into an empty tube
 *     - multi-segment pour: k identical top blocks move min(k, capacity - target.length)
 *  3. Win: every tube is empty OR full with exactly one uniform color.
 */
import type {
  ColorHex,
  Move,
  PourResult,
  PourValidation,
  StateValidation,
  Tube,
} from './types';

export const DEFAULT_CAPACITY = 4;

export class WaterSortEngine {
  readonly capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`Invalid tube capacity: ${capacity}`);
    }
    this.capacity = capacity;
  }

  // ---------------------------------------------------------------------------
  // Tube queries
  // ---------------------------------------------------------------------------

  static topColor(tube: Tube): ColorHex | null {
    return tube.length > 0 ? tube[tube.length - 1] : null;
  }

  /** Number of identical consecutive color blocks on the top of the tube. */
  static topRunLength(tube: Tube): number {
    const n = tube.length;
    if (n === 0) return 0;
    const top = tube[n - 1];
    let run = 1;
    while (run < n && tube[n - 1 - run] === top) run++;
    return run;
  }

  /** True if the tube is non-empty and contains exactly one color. */
  static isUniform(tube: Tube): boolean {
    return tube.length > 0 && WaterSortEngine.topRunLength(tube) === tube.length;
  }

  isFull(tube: Tube): boolean {
    return tube.length >= this.capacity;
  }

  /** Empty, or full with a single uniform color. */
  isTubeSolved(tube: Tube): boolean {
    return tube.length === 0 || (tube.length === this.capacity && WaterSortEngine.isUniform(tube));
  }

  isWon(tubes: readonly Tube[]): boolean {
    return tubes.every((t) => this.isTubeSolved(t));
  }

  // ---------------------------------------------------------------------------
  // Pour mechanics
  // ---------------------------------------------------------------------------

  canPour(tubes: readonly Tube[], from: number, to: number): PourValidation {
    if (!this.isValidIndex(tubes, from) || !this.isValidIndex(tubes, to)) {
      return { ok: false, reason: 'invalid-index' };
    }
    if (from === to) return { ok: false, reason: 'same-tube' };

    const source = tubes[from];
    const target = tubes[to];

    if (source.length === 0) return { ok: false, reason: 'source-empty' };
    if (this.isFull(target)) return { ok: false, reason: 'target-full' };

    const color = source[source.length - 1];

    if (target.length === 0) {
      // Trivial-move pruning: moving a uniform tube into an empty one changes nothing.
      if (WaterSortEngine.isUniform(source)) return { ok: false, reason: 'trivial-move' };
    } else if (target[target.length - 1] !== color) {
      return { ok: false, reason: 'color-mismatch' };
    }

    const count = Math.min(WaterSortEngine.topRunLength(source), this.capacity - target.length);
    return { ok: true, count, color };
  }

  /** Applies a pour immutably. Returns `null` if the pour is illegal. */
  pour(tubes: readonly Tube[], from: number, to: number): PourResult | null {
    const check = this.canPour(tubes, from, to);
    if (!check.ok) return null;

    const { count, color } = check;
    const next = tubes.map((t) => t.slice());
    next[from].length -= count;
    const colorsPoured: ColorHex[] = Array.from({ length: count }, () => color);
    next[to].push(...colorsPoured);

    return { tubes: next, move: { from, to, colorsPoured, count } };
  }

  /** Reverts a previously applied move (used by the unlimited undo stack). */
  undo(tubes: readonly Tube[], move: Move): Tube[] {
    const next = tubes.map((t) => t.slice());
    const target = next[move.to];
    if (!target || target.length < move.count) {
      throw new Error(`Cannot undo move ${move.from}->${move.to}: target state is inconsistent`);
    }
    next[move.to].length -= move.count;
    next[move.from].push(...move.colorsPoured);
    return next;
  }

  /** All legal pours from the current state. */
  getLegalMoves(tubes: readonly Tube[]): Move[] {
    const moves: Move[] = [];
    for (let from = 0; from < tubes.length; from++) {
      for (let to = 0; to < tubes.length; to++) {
        const check = this.canPour(tubes, from, to);
        if (check.ok) {
          moves.push({
            from,
            to,
            count: check.count,
            colorsPoured: Array.from({ length: check.count }, () => check.color),
          });
        }
      }
    }
    return moves;
  }

  /** No legal moves left and not yet won. */
  isStuck(tubes: readonly Tube[]): boolean {
    return !this.isWon(tubes) && this.getLegalMoves(tubes).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Invariant validation
  // ---------------------------------------------------------------------------

  /**
   * Validates structural invariants of a puzzle state:
   *  - no tube exceeds capacity
   *  - every color appears exactly `capacity` times (conservation of liquid)
   */
  validateState(tubes: readonly Tube[]): StateValidation {
    const errors: string[] = [];
    const counts = new Map<ColorHex, number>();

    tubes.forEach((tube, i) => {
      if (tube.length > this.capacity) {
        errors.push(`Tube ${i} overflows: ${tube.length}/${this.capacity}`);
      }
      for (const c of tube) counts.set(c, (counts.get(c) ?? 0) + 1);
    });

    for (const [color, n] of counts) {
      if (n !== this.capacity) {
        errors.push(`Color ${color} has ${n} units (expected ${this.capacity})`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidIndex(tubes: readonly Tube[], i: number): boolean {
    return Number.isInteger(i) && i >= 0 && i < tubes.length;
  }
}
