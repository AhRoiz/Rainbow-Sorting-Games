import { Lightbulb, Moon, RotateCcw, Sun, Target, Undo2, Volume2, VolumeX } from 'lucide-react';
import type { Difficulty } from '../core/types';
import { useGameStore } from '../store/useGameStore';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

/** Interactive header: level, moves, optimal target, undo / hint / restart, difficulty and settings. */
export function ControlBar() {
  const level = useGameStore((s) => s.level);
  const difficulty = useGameStore((s) => s.difficulty);
  const moveCount = useGameStore((s) => s.moveCount);
  const canUndo = useGameStore((s) => s.history.length > 0 && !s.pour && !s.isGenerating);
  const busy = useGameStore((s) => s.isGenerating || s.pour !== null);
  const isWon = useGameStore((s) => s.isWon);
  const darkMode = useGameStore((s) => s.darkMode);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const { undo, showHint, restart, setDifficulty, toggleDarkMode, toggleSound } = useGameStore.getState();

  const optimal = level?.config.minOptimalMoves;
  const overPar = optimal !== undefined && moveCount > optimal;

  return (
    <header className="glass-panel mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-4 sm:justify-start">
        <div>
          <h1 className="bg-gradient-to-r from-rose-400 via-amber-300 to-sky-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Rainbow Sort
          </h1>
          <p id="level-indicator" className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {level ? level.config.name : 'Loading…'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/60 px-3 py-1 text-center dark:bg-white/10" aria-live="polite">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Moves</p>
            <p
              id="move-counter"
              className={`text-lg font-bold leading-tight tabular-nums ${overPar ? 'text-amber-500' : ''}`}
            >
              {moveCount}
            </p>
          </div>
          <div
            id="optimal-badge"
            title="Fewest possible moves for this level"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-400/20 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300"
          >
            <Target size={16} aria-hidden />
            <span className="tabular-nums">Best {optimal ?? '–'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
        <button id="undo-btn" type="button" className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo last move">
          <Undo2 size={18} aria-hidden />
          <span className="hidden md:inline">Undo</span>
        </button>
        <button
          id="hint-btn"
          type="button"
          className="icon-btn"
          onClick={showHint}
          disabled={busy || isWon}
          aria-label="Show hint"
        >
          <Lightbulb size={18} className="text-hint" aria-hidden />
          <span className="hidden md:inline">Hint</span>
        </button>
        <button
          id="restart-btn"
          type="button"
          className="icon-btn"
          onClick={restart}
          disabled={!level || busy}
          aria-label="Restart level"
        >
          <RotateCcw size={18} aria-hidden />
          <span className="hidden md:inline">Restart</span>
        </button>

        <label htmlFor="difficulty-select" className="sr-only">
          Difficulty
        </label>
        <select
          id="difficulty-select"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="h-10 rounded-xl border border-white/60 bg-white/60 px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-ink-800 dark:text-slate-100"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <button
          id="sound-btn"
          type="button"
          className="icon-btn"
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
          aria-pressed={!soundEnabled}
        >
          {soundEnabled ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
        </button>
        <button
          id="theme-btn"
          type="button"
          className="icon-btn"
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        </button>
      </div>
    </header>
  );
}
