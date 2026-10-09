import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { ControlBar } from './components/ControlBar';
import { GameBoard } from './components/GameBoard';
import { VictoryModal } from './components/VictoryModal';
import { useGameAudio } from './hooks/useGameAudio';
import { useGameStore } from './store/useGameStore';

function App() {
  const darkMode = useGameStore((s) => s.darkMode);
  const isGenerating = useGameStore((s) => s.isGenerating);
  const toast = useGameStore((s) => s.toast);
  const init = useGameStore((s) => s.init);
  const dismissToast = useGameStore((s) => s.dismissToast);

  useGameAudio();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismissToast, 3200);
    return () => window.clearTimeout(id);
  }, [toast, dismissToast]);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden px-3 pb-8 pt-4 sm:px-6">
      {/* Ambient background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-24 h-96 w-96 animate-float-slow rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-600/25" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 animate-float-slow rounded-full bg-rose-300/30 blur-3xl [animation-delay:-6s] dark:bg-fuchsia-600/20" />
        <div className="absolute -bottom-24 left-1/4 h-96 w-96 animate-float-slow rounded-full bg-sky-300/30 blur-3xl [animation-delay:-12s] dark:bg-sky-600/20" />
      </div>

      <ControlBar />

      <main className="flex flex-1 items-center justify-center py-6">
        {isGenerating ? (
          <p role="status" className="animate-pulse text-sm font-medium text-slate-500 dark:text-slate-400">
            Mixing a fresh puzzle…
          </p>
        ) : (
          <GameBoard />
        )}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.nonce}
            role="status"
            className="glass-panel fixed bottom-6 left-1/2 z-40 -translate-x-1/2 bg-white/80 px-4 py-2 text-sm font-medium dark:bg-ink-800/90"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <VictoryModal />
    </div>
  );
}

export default App;
