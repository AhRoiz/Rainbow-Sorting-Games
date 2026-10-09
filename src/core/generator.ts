/**
 * Solvable level generator (Generate-and-Test, see PROJECT_SPEC §5).
 *
 *  1. Pick C colors from a harmonious, colorblind-friendly palette.
 *  2. Build a pool of C × capacity units and shuffle it (Fisher–Yates, seeded).
 *  3. Distribute into C full tubes + E empty tubes.
 *  4. Discard if any tube is already pre-solved (full & uniform).
 *  5. Run the tested BFS solver; accept only if solution.length >= target minimum.
 *  6. Return the level with the exact optimal move count for star ratings.
 *
 * Generation is deterministic for a given (difficulty, levelNumber, seed),
 * so "Medium · Level 7" is always the same puzzle.
 */
import { DEFAULT_CAPACITY, WaterSortEngine } from './engine';
import { solveDetailed } from './solver';
import type { ColorHex, Difficulty, Level, Tube } from './types';

/** Modern pastel, high-contrast palette chosen to stay distinguishable for common color-vision deficiencies. */
export const PALETTE: readonly ColorHex[] = [
  '#FF6B6B', // coral
  '#4D96FF', // azure
  '#FFD93D', // sunflower
  '#6BCB77', // mint green
  '#C77DFF', // lavender
  '#FF9F45', // tangerine
  '#4ECDC4', // teal
  '#FF8FB1', // pink
  '#3D5A80', // deep navy
  '#B5E48C', // lime
];

export interface DifficultyPreset {
  colorRange: readonly [number, number];
  emptyTubes: number;
  /** Optimal-move window: min is a hard requirement, max is preferred. */
  movesRange: readonly [number, number];
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { colorRange: [3, 4], emptyTubes: 2, movesRange: [8, 12] },
  medium: { colorRange: [5, 6], emptyTubes: 2, movesRange: [14, 22] },
  hard: { colorRange: [7, 9], emptyTubes: 2, movesRange: [25, 35] },
};

export interface GeneratorOptions {
  capacity?: number;
  /** Extra entropy; levels with the same seed are identical. */
  seed?: number;
  /** Attempts per color count before escalating to more colors. Default: 40. */
  attemptsPerColorCount?: number;
  /** BFS budget per candidate. Default: 400_000. */
  maxStates?: number;
}

// -----------------------------------------------------------------------------
// Seeded RNG
// -----------------------------------------------------------------------------

/** mulberry32 — tiny, fast, good-enough PRNG for shuffling. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleInPlace<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -----------------------------------------------------------------------------
// Candidate creation
// -----------------------------------------------------------------------------

/** Builds one random (not yet verified) candidate layout. */
export function createCandidate(
  colorCount: number,
  emptyTubes: number,
  capacity: number,
  rnd: () => number,
): Tube[] {
  if (colorCount > PALETTE.length) {
    throw new RangeError(`colorCount ${colorCount} exceeds palette size ${PALETTE.length}`);
  }
  const colors = shuffleInPlace(PALETTE.slice(), rnd).slice(0, colorCount);
  const pool = shuffleInPlace(
    colors.flatMap((c) => Array.from({ length: capacity }, () => c)),
    rnd,
  );
  const tubes: Tube[] = [];
  for (let i = 0; i < colorCount; i++) tubes.push(pool.slice(i * capacity, (i + 1) * capacity));
  for (let i = 0; i < emptyTubes; i++) tubes.push([]);
  return tubes;
}

function hasPreSolvedTube(tubes: readonly Tube[]): boolean {
  return tubes.some((t) => t.length > 0 && WaterSortEngine.isUniform(t));
}

/** Color count grows with level number and cycles through the preset range. */
export function colorCountFor(difficulty: Difficulty, levelNumber: number): number {
  const [min, max] = DIFFICULTY_PRESETS[difficulty].colorRange;
  const span = max - min + 1;
  return min + (Math.floor((Math.max(1, levelNumber) - 1) / 2) % span);
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function generateLevel(
  difficulty: Difficulty,
  levelNumber: number,
  options: GeneratorOptions = {},
): Level {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const attempts = options.attemptsPerColorCount ?? 40;
  const maxStates = options.maxStates ?? 400_000;
  const preset = DIFFICULTY_PRESETS[difficulty];
  const [minMoves, maxMoves] = preset.movesRange;
  const rnd = createRng(hashSeed(difficulty, levelNumber, options.seed ?? 0));

  let best: { tubes: Tube[]; moves: number; colors: number } | null = null;
  const startColors = colorCountFor(difficulty, levelNumber);

  for (let colors = startColors; colors <= preset.colorRange[1]; colors++) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const tubes = createCandidate(colors, preset.emptyTubes, capacity, rnd);
      if (hasPreSolvedTube(tubes)) continue;

      const result = solveDetailed(tubes, { capacity, maxStates });
      if (result.status !== 'solved' || !result.moves) continue;
      const length = result.moves.length;

      // Ideal: inside the preferred window -> accept immediately.
      if (length >= minMoves && length <= maxMoves) {
        return buildLevel(difficulty, levelNumber, capacity, colors, preset.emptyTubes, tubes, length);
      }
      // Otherwise remember the candidate closest to the window (prefer >= min).
      const score = (n: number) => (n >= minMoves ? n - maxMoves : (minMoves - n) * 100);
      if (!best || score(length) < score(best.moves)) best = { tubes, moves: length, colors };
    }
    // A candidate meeting the minimum (but above max) is acceptable; stop escalating.
    if (best && best.moves >= minMoves) break;
  }

  if (!best) {
    throw new Error(`Failed to generate a solvable ${difficulty} level #${levelNumber}`);
  }
  return buildLevel(difficulty, levelNumber, capacity, best.colors, preset.emptyTubes, best.tubes, best.moves);
}

function buildLevel(
  difficulty: Difficulty,
  levelNumber: number,
  capacity: number,
  colorCount: number,
  emptyTubes: number,
  tubes: Tube[],
  minOptimalMoves: number,
): Level {
  const label = difficulty[0].toUpperCase() + difficulty.slice(1);
  return {
    config: {
      id: levelNumber,
      name: `${label} · Level ${levelNumber}`,
      difficulty,
      tubeCapacity: capacity,
      colorCount,
      emptyTubes,
      minOptimalMoves,
    },
    tubes,
  };
}

// -----------------------------------------------------------------------------
// Scoring
// -----------------------------------------------------------------------------

export interface MoveRating {
  stars: 1 | 2 | 3;
  /** optimal / moves, capped at 100. */
  efficiency: number;
}

/** 3★ = optimal, 2★ = within +30%, 1★ = solved. */
export function rateMoves(moves: number, optimal: number): MoveRating {
  const efficiency = moves <= 0 ? 100 : Math.min(100, Math.round((optimal / moves) * 100));
  const stars: 1 | 2 | 3 = moves <= optimal ? 3 : moves <= Math.ceil(optimal * 1.3) ? 2 : 1;
  return { stars, efficiency };
}
