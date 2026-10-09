import { describe, expect, it } from 'vitest';
import { WaterSortEngine } from './engine';
import { canonicalKey, getNextBestMove, solve, solveAny, solveDetailed } from './solver';
import type { Move, Tube } from './types';

const R = '#FF6B6B';
const B = '#4D96FF';
const G = '#6BCB77';
const Y = '#FFD93D';

/** Replays a move list through the engine; fails if any move is illegal. */
function play(engine: WaterSortEngine, tubes: Tube[], moves: Move[]): Tube[] {
  return moves.reduce<Tube[]>((state, m) => {
    const res = engine.pour(state, m.from, m.to);
    if (!res) throw new Error(`Illegal move in solution: ${m.from}->${m.to}`);
    expect(res.move.count).toBe(m.count);
    expect(res.move.colorsPoured).toEqual(m.colorsPoured);
    return res.tubes;
  }, tubes);
}

/**
 * Independent reference: naive BFS using only the public engine API,
 * WITHOUT canonical hashing or any pruning. Slow but obviously correct,
 * so it serves as ground truth for the optimal move count.
 */
function naiveOptimalLength(tubes: Tube[], capacity: number): number | null {
  const engine = new WaterSortEngine(capacity);
  const seen = new Set<string>([JSON.stringify(tubes)]);
  let frontier: Tube[][] = [tubes];
  let depth = 0;
  while (frontier.length > 0) {
    if (frontier.some((s) => engine.isWon(s))) return depth;
    const next: Tube[][] = [];
    for (const s of frontier) {
      for (const m of engine.getLegalMoves(s)) {
        const n = engine.pour(s, m.from, m.to)!.tubes;
        const k = JSON.stringify(n);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(n);
        }
      }
    }
    frontier = next;
    depth++;
  }
  return null;
}

/** Deterministic seeded shuffle so test cases are reproducible. */
function seededPuzzle(colors: string[], capacity: number, empties: number, seed: number): Tube[] {
  let s = seed >>> 0;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pool = colors.flatMap((c) => Array.from({ length: capacity }, () => c));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const tubes: Tube[] = colors.map((_, i) => pool.slice(i * capacity, (i + 1) * capacity));
  for (let i = 0; i < empties; i++) tubes.push([]);
  return tubes;
}

describe('Skenario 4 — BFS solver menemukan langkah optimal', () => {
  it('puzzle sudah selesai -> 0 langkah', () => {
    expect(solve([[R, R, R, R], [], [B, B, B, B]])).toEqual([]);
  });

  it('puzzle 1 langkah -> tepat 1 langkah', () => {
    const tubes: Tube[] = [[B, B, B, B], [R, R, R], [R]];
    const moves = solve(tubes)!;
    expect(moves).toHaveLength(1);
    expect(new WaterSortEngine(4).isWon(play(new WaterSortEngine(4), tubes, moves))).toBe(true);
  });

  it('puzzle kapasitas 2 yang diverifikasi manual -> tepat 3 langkah', () => {
    // [R,B] [B,R] [] : tops berbeda, langkah pertama harus ke tabung kosong.
    // Optimal: 0->2 (B), 1->0 (R), 1->2 (B)  => 3 langkah, 2 langkah mustahil.
    const engine = new WaterSortEngine(2);
    const tubes: Tube[] = [[R, B], [B, R], []];
    const moves = solve(tubes, { capacity: 2 })!;
    expect(moves).toHaveLength(3);
    expect(engine.isWon(play(engine, tubes, moves))).toBe(true);
  });

  it('puzzle 2 warna kapasitas 4 -> panjang sama dengan BFS naif', () => {
    const engine = new WaterSortEngine(4);
    const tubes: Tube[] = [[R, B, R, B], [B, R, B, R], [], []];
    const moves = solve(tubes)!;
    expect(engine.isWon(play(engine, tubes, moves))).toBe(true);
    expect(moves.length).toBe(naiveOptimalLength(tubes, 4));
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'puzzle acak 3 warna (seed %i) -> optimal sesuai BFS naif',
    (seed) => {
      const engine = new WaterSortEngine(4);
      const tubes = seededPuzzle([R, B, G], 4, 2, seed);
      const result = solveDetailed(tubes);
      const reference = naiveOptimalLength(tubes, 4);

      if (reference === null) {
        expect(result.status).toBe('unsolvable');
        return;
      }
      expect(result.status).toBe('solved');
      expect(result.moves!.length).toBe(reference);
      expect(engine.isWon(play(engine, tubes, result.moves!))).toBe(true);
    },
  );

  it('symmetry reduction mengeksplorasi lebih sedikit state tanpa mengorbankan optimalitas', () => {
    const tubes = seededPuzzle([R, B, G, Y], 4, 2, 42);
    const result = solveDetailed(tubes);
    expect(result.status).toBe('solved');
    // Reference without canonical hashing on the same puzzle:
    expect(result.moves!.length).toBe(naiveOptimalLength(tubes, 4));
  });

  it('melaporkan unsolvable bila tidak ada langkah legal', () => {
    expect(solveDetailed([[R, B, R, B], [B, R, B, R]]).status).toBe('unsolvable');
    expect(solve([[R, B, R, B], [B, R, B, R]])).toBeNull();
  });

  it('melaporkan limit-exceeded bila budget state habis', () => {
    const tubes = seededPuzzle([R, B, G, Y], 4, 2, 7);
    expect(solveDetailed(tubes, { maxStates: 3 }).status).toBe('limit-exceeded');
  });

  it('melempar error untuk state yang melanggar invariant', () => {
    expect(() => solve([[R, R, R], []])).toThrow(/Invalid puzzle state/);
  });
});

describe('Canonical hashing', () => {
  it('kunci tidak bergantung pada urutan tabung', () => {
    expect(canonicalKey(['01', '', '10'])).toBe(canonicalKey(['10', '01', '']));
    expect(canonicalKey(['01', '10'])).not.toBe(canonicalKey(['01', '01']));
  });
});

describe('DFS fallback & hint', () => {
  it('BFS tidak pernah lebih panjang dari DFS heuristik', () => {
    const engine = new WaterSortEngine(4);
    const tubes = seededPuzzle([R, B, G, Y], 4, 2, 99);
    const bfs = solveDetailed(tubes);
    const dfs = solveAny(tubes);
    expect(dfs.status).toBe('solved');
    expect(engine.isWon(play(engine, tubes, dfs.moves!))).toBe(true);
    expect(bfs.moves!.length).toBeLessThanOrEqual(dfs.moves!.length);
  });

  it('hint = langkah pertama solusi optimal dan legal', () => {
    const engine = new WaterSortEngine(4);
    const tubes: Tube[] = [[R, B, R, B], [B, R, B, R], [], []];
    const hint = getNextBestMove(tubes)!;
    expect(engine.canPour(tubes, hint.from, hint.to).ok).toBe(true);
    // Following the hint must leave a position that is exactly one move shorter.
    const after = engine.pour(tubes, hint.from, hint.to)!.tubes;
    expect(solve(after)!.length).toBe(solve(tubes)!.length - 1);
  });

  it('hint null bila sudah menang atau buntu', () => {
    expect(getNextBestMove([[R, R, R, R], []])).toBeNull();
    expect(getNextBestMove([[R, B, R, B], [B, R, B, R]])).toBeNull();
  });

  it('hint tetap tersedia lewat fallback DFS saat budget BFS habis', () => {
    const engine = new WaterSortEngine(4);
    const tubes = seededPuzzle([R, B, G, Y], 4, 2, 7);
    const hint = getNextBestMove(tubes, { maxStates: 3 });
    expect(hint).not.toBeNull();
    expect(engine.canPour(tubes, hint!.from, hint!.to).ok).toBe(true);
  });
});
