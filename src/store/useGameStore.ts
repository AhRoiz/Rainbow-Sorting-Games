/**
 * useGameStore — Zustand store bridging the pure core engine to the React UI.
 *
 * Responsibilities:
 *  - level loading (deterministic generator), restart, next level, difficulty
 *  - selection / pour orchestration with an animation phase machine
 *  - unlimited undo via the reversible Move history stack
 *  - hint lookup through the BFS solver
 *  - UI events (consumed by useGameAudio) and persisted settings
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WaterSortEngine } from '../core/engine';
import { generateLevel } from '../core/generator';
import { getNextBestMove } from '../core/solver';
import type { ColorHex, Difficulty, Level, Move, Tube } from '../core/types';

// -----------------------------------------------------------------------------
// Animation timings (ms) — shared with components for consistent motion.
// -----------------------------------------------------------------------------
export const POUR_TIMING = {
  travel: 380,
  pourBase: 320,
  pourPerUnit: 110,
  returnTrip: 340,
} as const;

export type PourPhase = 'travel' | 'pouring' | 'return';

export interface PourAnimation {
  from: number;
  to: number;
  color: ColorHex;
  count: number;
  /** Units in the source tube before the pour (drives tilt angle). */
  sourceFill: number;
  phase: PourPhase;
  nonce: number;
}

export type GameEventType = 'select' | 'deselect' | 'pour' | 'error' | 'undo' | 'hint' | 'win' | 'restart';

export interface GameEvent {
  type: GameEventType;
  nonce: number;
}

interface Toast {
  message: string;
  nonce: number;
}

interface GameStore {
  // Level & board
  difficulty: Difficulty;
  progress: Record<Difficulty, number>;
  level: Level | null;
  tubes: Tube[];
  history: Move[];
  moveCount: number;
  isWon: boolean;
  isGenerating: boolean;
  /** Increments on every level load/restart so components can remount cleanly. */
  boardNonce: number;

  // Interaction
  selected: number | null;
  hint: Move | null;
  pour: PourAnimation | null;
  shake: { tube: number; nonce: number } | null;
  event: GameEvent | null;
  toast: Toast | null;

  // Settings
  darkMode: boolean;
  soundEnabled: boolean;

  // Actions
  init: () => void;
  loadLevel: (difficulty: Difficulty, levelNumber: number) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  nextLevel: () => void;
  restart: () => void;
  selectTube: (index: number) => void;
  undo: () => void;
  showHint: () => void;
  toggleDarkMode: () => void;
  toggleSound: () => void;
  dismissToast: () => void;
}

let nonceCounter = 0;
const nextNonce = () => ++nonceCounter;

/** Invalidates pending animation timers whenever the board is reset. */
let animationToken = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();
function schedule(fn: () => void, ms: number): void {
  const id = setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
}
function cancelAnimations(): void {
  animationToken++;
  timers.forEach(clearTimeout);
  timers.clear();
}

const engineFor = (level: Level | null) => new WaterSortEngine(level?.config.tubeCapacity ?? 4);
const cloneTubes = (tubes: readonly Tube[]): Tube[] => tubes.map((t) => t.slice());

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const emit = (type: GameEventType) => set({ event: { type, nonce: nextNonce() } });
      const toast = (message: string) => set({ toast: { message, nonce: nextNonce() } });

      return {
        difficulty: 'easy',
        progress: { easy: 1, medium: 1, hard: 1 },
        level: null,
        tubes: [],
        history: [],
        moveCount: 0,
        isWon: false,
        isGenerating: false,
        boardNonce: 0,
        selected: null,
        hint: null,
        pour: null,
        shake: null,
        event: null,
        toast: null,
        darkMode: true,
        soundEnabled: true,

        init: () => {
          const { level, difficulty, progress } = get();
          if (!level) get().loadLevel(difficulty, progress[difficulty]);
        },

        loadLevel: (difficulty, levelNumber) => {
          cancelAnimations();
          set({ isGenerating: true, difficulty, selected: null, hint: null, pour: null });
          // Defer so the UI can paint the loading state before the (synchronous) BFS runs.
          schedule(() => {
            const level = generateLevel(difficulty, levelNumber);
            set((s) => ({
              level,
              tubes: cloneTubes(level.tubes),
              history: [],
              moveCount: 0,
              isWon: false,
              isGenerating: false,
              boardNonce: s.boardNonce + 1,
              progress: { ...s.progress, [difficulty]: levelNumber },
            }));
          }, 30);
        },

        setDifficulty: (difficulty) => get().loadLevel(difficulty, get().progress[difficulty]),

        nextLevel: () => {
          const { difficulty, progress } = get();
          get().loadLevel(difficulty, progress[difficulty] + 1);
        },

        restart: () => {
          const { level, isGenerating } = get();
          if (!level || isGenerating) return;
          cancelAnimations();
          set((s) => ({
            tubes: cloneTubes(level.tubes),
            history: [],
            moveCount: 0,
            isWon: false,
            selected: null,
            hint: null,
            pour: null,
            boardNonce: s.boardNonce + 1,
          }));
          emit('restart');
        },

        selectTube: (index) => {
          const { pour, isWon, isGenerating, selected, tubes, level } = get();
          if (pour || isWon || isGenerating || !level) return;

          if (selected === null) {
            if (tubes[index].length === 0) {
              set({ shake: { tube: index, nonce: nextNonce() } });
              emit('error');
              return;
            }
            set({ selected: index });
            emit('select');
            return;
          }

          if (selected === index) {
            set({ selected: null });
            emit('deselect');
            return;
          }

          const engine = engineFor(level);
          const result = engine.pour(tubes, selected, index);
          if (!result) {
            set({ selected: null, shake: { tube: index, nonce: nextNonce() } });
            emit('error');
            return;
          }

          // --- Pour animation state machine: travel -> pouring -> return ---
          const token = animationToken;
          const { move } = result;
          const base: Omit<PourAnimation, 'phase'> = {
            from: move.from,
            to: move.to,
            color: move.colorsPoured[0],
            count: move.count,
            sourceFill: tubes[move.from].length,
            nonce: nextNonce(),
          };
          set({ selected: null, hint: null, pour: { ...base, phase: 'travel' } });

          const pourDuration = POUR_TIMING.pourBase + POUR_TIMING.pourPerUnit * move.count;

          schedule(() => {
            if (token !== animationToken) return;
            set((s) => ({
              tubes: result.tubes,
              history: [...s.history, move],
              moveCount: s.history.length + 1,
              pour: { ...base, phase: 'pouring' },
            }));
            emit('pour');
          }, POUR_TIMING.travel);

          schedule(() => {
            if (token !== animationToken) return;
            set({ pour: { ...base, phase: 'return' } });
          }, POUR_TIMING.travel + pourDuration);

          schedule(() => {
            if (token !== animationToken) return;
            const current = get().tubes;
            const won = engine.isWon(current);
            set({ pour: null, isWon: won });
            if (won) emit('win');
            else if (engine.isStuck(current)) toast('No moves left — try Undo or Restart.');
          }, POUR_TIMING.travel + pourDuration + POUR_TIMING.returnTrip);
        },

        undo: () => {
          const { pour, history, tubes, level, isGenerating } = get();
          if (pour || isGenerating || history.length === 0) return;
          const last = history[history.length - 1];
          const restored = engineFor(level).undo(tubes, last);
          set({
            tubes: restored,
            history: history.slice(0, -1),
            moveCount: history.length - 1,
            isWon: false,
            selected: null,
            hint: null,
          });
          emit('undo');
        },

        showHint: () => {
          const { pour, isWon, isGenerating, tubes, level } = get();
          if (pour || isWon || isGenerating || !level) return;
          const move = getNextBestMove(tubes, { capacity: level.config.tubeCapacity });
          if (!move) {
            toast('No solution from here — Undo a few moves or Restart.');
            emit('error');
            return;
          }
          set({ hint: move, selected: null });
          emit('hint');
        },

        toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
        toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
        dismissToast: () => set({ toast: null }),
      };
    },
    {
      name: 'rainbowsort-settings',
      version: 1,
      partialize: (s) => ({
        difficulty: s.difficulty,
        progress: s.progress,
        darkMode: s.darkMode,
        soundEnabled: s.soundEnabled,
      }),
    },
  ),
);
