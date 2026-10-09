import { useEffect, useMemo, useRef, useState } from 'react';
import { POUR_TIMING, useGameStore } from '../store/useGameStore';
import { Tube, type TubePourMotion, type TubeStream } from './Tube';

interface BoardMetrics {
  segment: number;
  width: number;
  gap: number;
  rowGap: number;
  perRow: number;
}

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** Picks the row count that yields the largest tubes for the current viewport. */
function computeMetrics(count: number, capacity: number, vw: number, vh: number): BoardMetrics {
  const gap = vw < 640 ? 14 : 24;
  const availW = Math.min(vw, 1100) - 32;
  const availH = Math.max(260, vh - (vw < 640 ? 250 : 220));
  let best: BoardMetrics = { segment: 18, width: 22, gap, rowGap: 30, perRow: count };

  for (let rows = 1; rows <= 3; rows++) {
    const perRow = Math.ceil(count / rows);
    const fromWidth = (availW - (perRow - 1) * gap) / perRow / 1.2;
    // Each row: capacity segments + neck (0.7) ; between rows: 1.5 segments for lift & badges.
    const fromHeight = availH / (rows * (capacity + 0.7) + (rows - 1) * 1.5 + 1);
    const segment = Math.floor(Math.max(18, Math.min(46, fromWidth, fromHeight)));
    if (segment > best.segment || rows === 1) {
      best = { segment, width: Math.round(segment * 1.2), gap, rowGap: Math.round(segment * 1.5), perRow };
    }
  }
  return best;
}

/** Responsive layout for all tubes; computes pour geometry between source and target. */
export function GameBoard() {
  const tubes = useGameStore((s) => s.tubes);
  const level = useGameStore((s) => s.level);
  const selected = useGameStore((s) => s.selected);
  const hint = useGameStore((s) => s.hint);
  const pour = useGameStore((s) => s.pour);
  const shake = useGameStore((s) => s.shake);
  const isWon = useGameStore((s) => s.isWon);
  const boardNonce = useGameStore((s) => s.boardNonce);
  const selectTube = useGameStore((s) => s.selectTube);

  const capacity = level?.config.tubeCapacity ?? 4;
  const { w, h } = useViewport();
  const metrics = useMemo(() => computeMetrics(tubes.length, capacity, w, h), [tubes.length, capacity, w, h]);
  const tubeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Pour geometry is computed once per pour from untransformed layout offsets.
  const pourNonce = pour?.nonce;
  const geometry = useMemo(() => {
    if (!pour) return null;
    const src = tubeRefs.current[pour.from];
    const tgt = tubeRefs.current[pour.to];
    if (!src || !tgt) return null;
    const srcCenter = src.offsetLeft + src.offsetWidth / 2;
    const tgtCenter = tgt.offsetLeft + tgt.offsetWidth / 2;
    const dir: 1 | -1 = tgtCenter >= srcCenter ? 1 : -1;
    // Rotation pivots at the source mouth (top-center); park it just beside & above the target mouth.
    const dx = tgtCenter - dir * tgt.offsetWidth * 0.38 - srcCenter;
    const dy = tgt.offsetTop - metrics.segment * 0.95 - src.offsetTop;
    // Fuller tubes need less tilt: 45° (full) .. 75° (nearly empty).
    const angle = 45 + 30 * ((capacity - pour.sourceFill) / Math.max(1, capacity - 1));
    return { dx, dy, dir, angle: Math.min(75, angle) };
    // Recompute only when a new pour starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pourNonce, metrics.segment, capacity]);

  const pourDuration = pour ? POUR_TIMING.pourBase + POUR_TIMING.pourPerUnit * pour.count : 0;

  return (
    <div
      className="relative mx-auto flex flex-wrap content-center items-end justify-center"
      style={{
        columnGap: metrics.gap,
        rowGap: metrics.rowGap,
        maxWidth: metrics.perRow * (metrics.width + metrics.gap),
        paddingTop: metrics.segment * 1.2,
      }}
    >
      {tubes.map((tube, i) => {
        const pourMotion: TubePourMotion | null =
          pour && geometry && pour.from === i ? { ...geometry, phase: pour.phase } : null;
        const stream: TubeStream | null =
          pour && geometry && pour.to === i && pour.phase === 'pouring'
            ? { color: pour.color, dir: geometry.dir, duration: pourDuration / 1000 }
            : null;
        const hintRole = hint ? (hint.from === i ? 'source' : hint.to === i ? 'target' : null) : null;

        return (
          <Tube
            key={`${boardNonce}-${i}`}
            ref={(el) => {
              tubeRefs.current[i] = el;
            }}
            index={i}
            tube={tube}
            capacity={capacity}
            segment={metrics.segment}
            width={metrics.width}
            selected={selected === i}
            hintRole={hintRole}
            pourMotion={pourMotion}
            stream={stream}
            shakeNonce={shake && shake.tube === i ? shake.nonce : null}
            disabled={isWon}
            onSelect={selectTube}
          />
        );
      })}
    </div>
  );
}
