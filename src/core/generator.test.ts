import { describe, expect, it } from 'vitest';
import { WaterSortEngine } from './engine';
import { DIFFICULTY_PRESETS, generateLevel, rateMoves } from './generator';
import { solve } from './solver';
import type { Difficulty } from './types';

const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

describe('generateLevel', () => {
  for (const difficulty of difficulties) {
    it.each([1, 2, 3, 4, 5, 6])(`${difficulty} level %i: valid, solvable, optimal count matches`, (n) => {
      const level = generateLevel(difficulty, n);
      const { config, tubes } = level;
      const engine = new WaterSortEngine(config.tubeCapacity);
      const preset = DIFFICULTY_PRESETS[difficulty];

      expect(engine.validateState(tubes).valid).toBe(true);
      expect(tubes).toHaveLength(config.colorCount + config.emptyTubes);
      expect(config.colorCount).toBeGreaterThanOrEqual(preset.colorRange[0]);
      expect(config.colorCount).toBeLessThanOrEqual(preset.colorRange[1]);
      expect(tubes.filter((t) => t.length === 0)).toHaveLength(preset.emptyTubes);

      // No tube is pre-solved.
      expect(tubes.some((t) => t.length > 0 && WaterSortEngine.isUniform(t))).toBe(false);

      // Precomputed optimum is the real optimum and meets the difficulty minimum.
      const moves = solve(tubes, { capacity: config.tubeCapacity, maxStates: 1_000_000 });
      expect(moves).not.toBeNull();
      expect(moves!.length).toBe(config.minOptimalMoves);
      expect(config.minOptimalMoves).toBeGreaterThanOrEqual(preset.movesRange[0]);
    });
  }

  it('is deterministic for the same difficulty/level/seed', () => {
    expect(generateLevel('medium', 3)).toEqual(generateLevel('medium', 3));
    expect(generateLevel('medium', 3, { seed: 1 }).tubes).not.toEqual(generateLevel('medium', 3).tubes);
  });
});

describe('rateMoves', () => {
  it('awards stars by efficiency', () => {
    expect(rateMoves(10, 10)).toEqual({ stars: 3, efficiency: 100 });
    expect(rateMoves(13, 10).stars).toBe(2);
    expect(rateMoves(20, 10)).toEqual({ stars: 1, efficiency: 50 });
  });
});
