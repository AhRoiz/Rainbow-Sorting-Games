import { describe, expect, it } from 'vitest';
import { WaterSortEngine } from './engine';
import type { Tube } from './types';

const R = '#FF6B6B';
const B = '#4D96FF';
const G = '#6BCB77';

const engine = new WaterSortEngine(4);

describe('Skenario 1 — Penuangan warna yang sama', () => {
  describe('ke tabung kosong', () => {
    it('menuang seluruh run warna teratas dari tabung campuran', () => {
      const res = engine.pour([[B, R, R], []], 0, 1);
      expect(res).not.toBeNull();
      expect(res!.tubes).toEqual([[B], [R, R]]);
      expect(res!.move).toEqual({ from: 0, to: 1, count: 2, colorsPoured: [R, R] });
    });

    it('menuang 1 segmen bila hanya 1 warna teratas yang sama', () => {
      const res = engine.pour([[R, B, G], []], 0, 1);
      expect(res!.tubes).toEqual([[R, B], [G]]);
      expect(res!.move.count).toBe(1);
    });

    it('menolak langkah trivial: tabung satu warna -> tabung kosong', () => {
      expect(engine.canPour([[R, R], []], 0, 1)).toEqual({ ok: false, reason: 'trivial-move' });
      expect(engine.canPour([[R, R, R, R], []], 0, 1)).toEqual({ ok: false, reason: 'trivial-move' });
      expect(engine.pour([[R, R], []], 0, 1)).toBeNull();
    });
  });

  describe('ke tabung terisi', () => {
    it('menuang ke tabung dengan warna teratas yang sama', () => {
      const res = engine.pour([[B, R], [G, R]], 0, 1);
      expect(res!.tubes).toEqual([[B], [G, R, R]]);
      expect(res!.move.count).toBe(1);
    });

    it('menuang multi-segmen sekaligus bila ruang cukup', () => {
      const res = engine.pour([[B, R, R], [G, R]], 0, 1);
      expect(res!.tubes).toEqual([[B], [G, R, R, R]]);
      expect(res!.move.count).toBe(2);
    });

    it('membatasi jumlah tuang ke sisa kapasitas: min(k, capacity - target.length)', () => {
      const res = engine.pour([[B, R, R, R], [G, G, R]], 0, 1);
      expect(res!.tubes).toEqual([[B, R, R], [G, G, R, R]]);
      expect(res!.move.count).toBe(1);
    });

    it('mengizinkan tabung satu warna dituang ke tabung terisi warna sama', () => {
      const res = engine.pour([[R, R], [B, R]], 0, 1);
      expect(res!.tubes).toEqual([[], [B, R, R, R]]);
    });
  });

  it('pour bersifat immutable dan undo mengembalikan state persis', () => {
    const start: Tube[] = [[B, R, R], [G, R]];
    const snapshot = structuredClone(start);
    const res = engine.pour(start, 0, 1)!;
    expect(start).toEqual(snapshot);
    expect(engine.undo(res.tubes, res.move)).toEqual(snapshot);
  });
});

describe('Skenario 2 — Penolakan tuang', () => {
  it('menolak bila warna berbeda', () => {
    expect(engine.canPour([[R], [B]], 0, 1)).toEqual({ ok: false, reason: 'color-mismatch' });
    expect(engine.pour([[G, R], [G, B]], 0, 1)).toBeNull();
  });

  it('menolak bila tabung tujuan penuh (meski warnanya sama)', () => {
    expect(engine.canPour([[R], [B, R, R, R]], 0, 1)).toEqual({ ok: false, reason: 'target-full' });
    expect(engine.canPour([[B], [B, R, G, R]], 0, 1)).toEqual({ ok: false, reason: 'target-full' });
  });

  it('menolak bila tabung sumber kosong', () => {
    expect(engine.canPour([[], [R]], 0, 1)).toEqual({ ok: false, reason: 'source-empty' });
  });

  it('menolak tuang ke diri sendiri dan indeks tidak valid', () => {
    expect(engine.canPour([[R], []], 0, 0)).toEqual({ ok: false, reason: 'same-tube' });
    expect(engine.canPour([[R], []], 0, 5)).toEqual({ ok: false, reason: 'invalid-index' });
    expect(engine.canPour([[R], []], -1, 1)).toEqual({ ok: false, reason: 'invalid-index' });
  });

  it('state tidak berubah setelah penolakan', () => {
    const start: Tube[] = [[R], [B]];
    expect(engine.pour(start, 0, 1)).toBeNull();
    expect(start).toEqual([[R], [B]]);
  });
});

describe('Skenario 3 — Kondisi kemenangan', () => {
  it('isTubeSolved: kosong atau penuh dengan satu warna', () => {
    expect(engine.isTubeSolved([])).toBe(true);
    expect(engine.isTubeSolved([R, R, R, R])).toBe(true);
    expect(engine.isTubeSolved([R, R, R])).toBe(false); // satu warna tapi belum penuh
    expect(engine.isTubeSolved([R, R, R, B])).toBe(false); // penuh tapi campur
  });

  it('isWon: true bila semua tabung solved', () => {
    expect(engine.isWon([[R, R, R, R], [], [B, B, B, B], []])).toBe(true);
  });

  it('isWon: false bila ada warna yang terpecah di dua tabung', () => {
    expect(engine.isWon([[R, R, R], [R], [B, B, B, B]])).toBe(false);
  });

  it('isWon: false bila ada tabung campur', () => {
    expect(engine.isWon([[R, R, R, B], [B, B, B, R]])).toBe(false);
  });

  it('langkah terakhir yang menyelesaikan puzzle memicu kemenangan', () => {
    const res = engine.pour([[B, B, B, B], [R, R, R], [R]], 2, 1)!;
    expect(engine.isWon(res.tubes)).toBe(true);
  });

  it('isStuck: tidak ada langkah legal dan belum menang', () => {
    expect(engine.isStuck([[R, B, R, B], [B, R, B, R]])).toBe(true);
    expect(engine.isStuck([[R, R, R, R], [B, B, B, B]])).toBe(false);
  });
});

describe('Invariant validation', () => {
  it('menerima state dengan kekekalan cairan', () => {
    expect(engine.validateState([[R, R, B, B], [B, B, R, R], []]).valid).toBe(true);
  });

  it('menolak jumlah warna yang salah atau tabung overflow', () => {
    expect(engine.validateState([[R, R, R], [B, B, B, B]]).valid).toBe(false);
    expect(new WaterSortEngine(2).validateState([[R, R, R]]).valid).toBe(false);
  });
});
