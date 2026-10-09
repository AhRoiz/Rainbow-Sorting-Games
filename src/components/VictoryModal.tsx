import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, RotateCcw, Star } from 'lucide-react';
import { useEffect } from 'react';
import { rateMoves } from '../core/generator';
import { useGameStore } from '../store/useGameStore';

function celebrate(): void {
  const colors = ['#FF6B6B', '#4D96FF', '#FFD93D', '#6BCB77', '#C77DFF', '#FF9F45'];
  void confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 }, colors });
  window.setTimeout(() => {
    void confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
    void confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
  }, 250);
}

/** Victory dialog with star rating, move efficiency and confetti. */
export function VictoryModal() {
  const isWon = useGameStore((s) => s.isWon);
  const moveCount = useGameStore((s) => s.moveCount);
  const level = useGameStore((s) => s.level);
  const { nextLevel, restart } = useGameStore.getState();

  useEffect(() => {
    if (!isWon) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) celebrate();
  }, [isWon]);

  const optimal = level?.config.minOptimalMoves ?? moveCount;
  const { stars, efficiency } = rateMoves(moveCount, optimal);

  return (
    <AnimatePresence>
      {isWon && level && (
        <motion.div
          key="victory"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.35 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="victory-title"
            className="glass-panel w-full max-w-sm bg-white/80 p-6 text-center dark:bg-ink-900/90"
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.35 }}
          >
            <h2 id="victory-title" className="text-2xl font-bold">
              Level Complete!
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{level.config.name}</p>

            <div className="my-5 flex justify-center gap-2" aria-label={`${stars} of 3 stars`}>
              {[1, 2, 3].map((n) => (
                <motion.div
                  key={n}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.7 + n * 0.15 }}
                >
                  <Star
                    size={44}
                    strokeWidth={1.5}
                    className={n <= stars ? 'fill-amber-300 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                  />
                </motion.div>
              ))}
            </div>

            <dl className="mb-6 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-black/5 p-2 dark:bg-white/10">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Moves</dt>
                <dd className="text-lg font-bold tabular-nums">{moveCount}</dd>
              </div>
              <div className="rounded-xl bg-black/5 p-2 dark:bg-white/10">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Best</dt>
                <dd className="text-lg font-bold tabular-nums">{optimal}</dd>
              </div>
              <div className="rounded-xl bg-black/5 p-2 dark:bg-white/10">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Efficiency</dt>
                <dd className="text-lg font-bold tabular-nums">{efficiency}%</dd>
              </div>
            </dl>

            <div className="flex gap-2">
              <button
                id="victory-replay"
                type="button"
                onClick={restart}
                className="icon-btn flex-1 border border-slate-300/60 dark:border-white/15"
              >
                <RotateCcw size={16} aria-hidden /> Replay
              </button>
              <button
                id="victory-next"
                type="button"
                onClick={nextLevel}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 active:scale-95"
              >
                Next <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
