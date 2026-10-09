import { AnimatePresence, motion, useAnimate, type TargetAndTransition, type Transition } from 'framer-motion';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { forwardRef, useEffect } from 'react';
import { WaterSortEngine } from '../core/engine';
import type { ColorHex, Tube as TubeData } from '../core/types';
import { POUR_TIMING, type PourPhase } from '../store/useGameStore';
import { PourStream } from './PourStream';

export interface TubePourMotion {
  dx: number;
  dy: number;
  angle: number;
  dir: 1 | -1;
  phase: PourPhase;
}

export interface TubeStream {
  color: ColorHex;
  dir: 1 | -1;
  duration: number;
}

interface TubeProps {
  index: number;
  tube: TubeData;
  capacity: number;
  segment: number;
  width: number;
  selected: boolean;
  hintRole: 'source' | 'target' | null;
  pourMotion: TubePourMotion | null;
  stream: TubeStream | null;
  shakeNonce: number | null;
  disabled: boolean;
  onSelect: (index: number) => void;
}

const SHAKE = { x: [0, -9, 9, -6, 6, -3, 0] };

function motionFor(selected: boolean, pour: TubePourMotion | null): { animate: TargetAndTransition; transition: Transition } {
  if (pour) {
    if (pour.phase === 'travel') {
      return {
        animate: { x: pour.dx, y: pour.dy, rotate: pour.dir * pour.angle * 0.55 },
        transition: { duration: POUR_TIMING.travel / 1000, ease: [0.4, 0, 0.2, 1] },
      };
    }
    if (pour.phase === 'pouring') {
      return {
        animate: { x: pour.dx, y: pour.dy, rotate: pour.dir * pour.angle },
        transition: { duration: 0.22, ease: 'easeOut' },
      };
    }
    return {
      animate: { x: 0, y: 0, rotate: 0 },
      transition: { duration: POUR_TIMING.returnTrip / 1000, ease: [0.4, 0, 0.2, 1] },
    };
  }
  return {
    animate: { x: 0, y: selected ? -24 : 0, rotate: 0 },
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  };
}

/** A glass tube with animated liquid segments, selection lift, pour tilt and shake. */
export const Tube = forwardRef<HTMLButtonElement, TubeProps>(function Tube(
  { index, tube, capacity, segment, width, selected, hintRole, pourMotion, stream, shakeNonce, disabled, onSelect },
  ref,
) {
  const [shakeScope, animateShake] = useAnimate<HTMLDivElement>();
  const neck = Math.round(segment * 0.7);
  const height = capacity * segment + neck;
  const completed = tube.length === capacity && WaterSortEngine.isUniform(tube);
  const top = tube.length > 0 ? tube[tube.length - 1] : null;
  const { animate, transition } = motionFor(selected, pourMotion);

  useEffect(() => {
    if (shakeNonce !== null && shakeScope.current) {
      void animateShake(shakeScope.current, SHAKE, { duration: 0.38, ease: 'easeInOut' });
    }
  }, [shakeNonce, animateShake, shakeScope]);

  const streamTop = -Math.round(segment * 0.55);
  const streamHeight = -streamTop + neck + (capacity - tube.length) * segment + 2;

  const glow = selected
    ? '0 0 0 2px rgb(165 243 252 / 0.95), 0 0 26px 4px rgb(165 243 252 / 0.45)'
    : completed
      ? `0 0 22px 2px ${tube[0]}55`
      : undefined;

  return (
    <motion.button
      ref={ref}
      type="button"
      id={`tube-${index}`}
      aria-label={`Tube ${index + 1}: ${tube.length} of ${capacity} filled${selected ? ', selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(index)}
      className="relative shrink-0 rounded-b-3xl outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
      style={{ width, height, transformOrigin: '50% 0%', zIndex: pourMotion ? 30 : selected ? 10 : 1 }}
      animate={animate}
      transition={transition}
      whileHover={disabled || pourMotion ? undefined : { scale: 1.04 }}
      whileTap={disabled || pourMotion ? undefined : { scale: 0.97 }}
    >
      <div ref={shakeScope} className="h-full w-full">
        <div
          className={`tube-glass h-full w-full transition-shadow duration-300 ${hintRole ? 'animate-hint-pulse' : ''}`}
          style={{ boxShadow: glow }}
        >
          {/* Liquid segments (index 0 = bottom) */}
          <AnimatePresence initial={false}>
            {tube.map((color, i) => (
              <motion.div
                key={i}
                className="liquid absolute inset-x-0"
                style={{ bottom: i * segment, backgroundColor: color }}
                initial={{ height: 0 }}
                animate={{ height: segment + (i === tube.length - 1 ? 0 : 1) }}
                exit={{ height: 0 }}
                transition={{ duration: 0.34, ease: 'easeInOut' }}
              />
            ))}
          </AnimatePresence>

          {/* Curved liquid surface that rides on top of the column */}
          {top && (
            <motion.div
              className="liquid-surface"
              style={{ backgroundColor: top, top: 'auto' }}
              initial={false}
              animate={{ bottom: tube.length * segment - 4 }}
              transition={{ duration: 0.34, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Completed tube badge */}
        <AnimatePresence>
          {completed && !pourMotion && (
            <motion.span
              className="absolute -top-7 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-md"
              style={{ backgroundColor: tube[0] }}
              initial={{ scale: 0, y: 6 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.25 }}
            >
              <Check size={12} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Hint chips */}
        <AnimatePresence>
          {hintRole && (
            <motion.span
              className="absolute -top-8 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-hint text-ink-900 shadow-lg shadow-amber-500/40"
              initial={{ scale: 0, y: 8 }}
              animate={{ scale: 1, y: [0, -4, 0] }}
              exit={{ scale: 0 }}
              transition={{ y: { duration: 0.9, repeat: Infinity }, scale: { type: 'spring', stiffness: 500 } }}
            >
              {hintRole === 'source' ? <ArrowUp size={14} strokeWidth={3} /> : <ArrowDown size={14} strokeWidth={3} />}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {stream && (
          <PourStream
            key="stream"
            color={stream.color}
            dir={stream.dir}
            top={streamTop}
            height={streamHeight}
            duration={stream.duration}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
});
