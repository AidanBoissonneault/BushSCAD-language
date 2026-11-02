/**
 * @author Aidan Boissonneault
 * @file part-layout.test.ts
 * @purpose Tests part layout behavior in the core in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, it, expect } from 'vitest';
import { computePartLayout } from '../../src/core/part-layout.js';

describe('computePartLayout', () => {
  it('returns empty map for no parts', () => {
    const out = computePartLayout([], 10);
    expect(out.size).toBe(0);
  });

  it('returns zero offset for a single part', () => {
    const out = computePartLayout([{ name: 'a', spanX: 50, minX: -25 }], 10);
    expect(out.get('a')).toBe(0);
  });

  it('lays two equal parts symmetric across origin with gap', () => {
    const out = computePartLayout(
      [
        { name: 'a', spanX: 20, minX: -10 },
        { name: 'b', spanX: 20, minX: -10 },
      ],
      10,
    );
    // total span = 20 + 10 + 20 = 50, half = 25
    // sorted by name asc on tie → a first at cursor 0, then b at 30
    // offsets: a = (0 - -10) + (-25) = -15; b = (30 - -10) + (-25) = 15
    expect(out.get('a')).toBe(-15);
    expect(out.get('b')).toBe(15);
  });

  it('orders parts by descending span', () => {
    const out = computePartLayout(
      [
        { name: 'small', spanX: 10, minX: 0 },
        { name: 'big', spanX: 100, minX: 0 },
      ],
      5,
    );
    // sorted: big (0..100), then small (105..115). totalSpan=115. shift=-57.5
    expect(out.get('big')).toBeCloseTo(-57.5, 6);
    expect(out.get('small')).toBeCloseTo(105 - 57.5, 6);
  });

  it('handles non-zero minX (off-origin bboxes)', () => {
    const out = computePartLayout(
      [
        { name: 'a', spanX: 40, minX: 100 },
        { name: 'b', spanX: 40, minX: -200 },
      ],
      0,
    );
    // sorted by name asc on tie. cursor=0: a offset = 0 - 100 = -100; cursor=40: b offset = 40 - -200 = 240.
    // totalSpan=80, shift=-40. final: a=-140, b=200.
    expect(out.get('a')).toBe(-140);
    expect(out.get('b')).toBe(200);
  });

  it('uses max of spanX/spanY/spanZ as slot width', () => {
    // Two parts: a has small X-span but big Y-span (e.g. radial sweep along Y).
    // b has tiny extent in every axis. Slot for a must use spanY=80 so b
    // does not overlap a's bbox.
    const out = computePartLayout(
      [
        { name: 'a', spanX: 10, minX: -5, spanY: 80, spanZ: 5 },
        { name: 'b', spanX: 10, minX: -5, spanY: 5, spanZ: 5 },
      ],
      0,
    );
    // sorted: a (slot=80) first. a at cursor 0..80 (center 40), b at 80..90 (center 85).
    // totalSpan=90, shift=-45.
    // a partCenter=0 → slotCenter=40 → offset=40 (then -45) → -5
    // b partCenter=0 → slotCenter=85 → offset=85 (then -45) → 40
    expect(out.get('a')).toBeCloseTo(-5, 6);
    expect(out.get('b')).toBeCloseTo(40, 6);
    // Distance between part centers (45) must equal half-slots sum (40 + 5).
    expect((out.get('b') ?? 0) - (out.get('a') ?? 0)).toBeCloseTo(45, 6);
  });

  it('is deterministic for repeated runs', () => {
    const input = [
      { name: 'c', spanX: 30, minX: 0 },
      { name: 'a', spanX: 30, minX: 0 },
      { name: 'b', spanX: 30, minX: 0 },
    ];
    const r1 = computePartLayout(input, 5);
    const r2 = computePartLayout(input, 5);
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });
});
