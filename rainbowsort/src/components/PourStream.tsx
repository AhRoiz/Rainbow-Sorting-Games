import { motion } from 'framer-motion';
import type { ColorHex } from '../core/types';

interface PourStreamProps {
  color: ColorHex;
  /** Stream length in px, from the source spout to the target liquid surface. */
  height: number;
  /** +1 when the source pours from the left, -1 from the right. */
  dir: 1 | -1;
  /** Offset (px) of the stream top above the tube's mouth. */
  top: number;
  duration: number;
}

/** Animated vertical liquid stream rendered above the target tube. */
export function PourStream({ color, height, dir, top, duration }: PourStreamProps) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 z-20"
      style={{ top, marginLeft: -dir * 6 - 3, width: 6, height }}
      initial={{ scaleY: 0, originY: 0, opacity: 0.6 }}
      animate={{ scaleY: 1, originY: 0, opacity: 1 }}
      exit={{ scaleY: 0, originY: 1, opacity: 0 }}
      transition={{ duration: Math.min(0.18, duration / 3), ease: 'easeOut' }}
    >
      <div
        className="pour-stream h-full w-full rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}88` }}
      />
      {/* Splash ripple at the landing point */}
      <motion.div
        className="absolute -bottom-1 left-1/2 h-2 w-5 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: color, filter: 'brightness(1.25)' }}
        animate={{ scaleX: [0.6, 1.2, 0.8, 1.1, 0.6], opacity: [0.6, 1, 0.8, 1, 0.6] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}
