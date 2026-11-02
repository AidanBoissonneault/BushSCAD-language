/**
 * @author Aidan Boissonneault
 * @file radial-stations.test.ts
 * @purpose Tests radial stations behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { buildRadialStations } from '../../src/operations/radial-stations.js';

describe('buildRadialStations', () => {
  it('keeps angular stations fixed while curves change axial positions', () => {
    const curves = [
      { kind: 'linear' },
      { kind: 'ease-in' },
      { kind: 'ease-out' },
      { kind: 'ease-in-out' },
      { kind: 'cubic-bezier', x1: 0.2, y1: 0.8, x2: 0.4, y2: 1 },
    ] as const;
    const stationSets = curves.map((curve) =>
      buildRadialStations({
        angleDeg: 180,
        lengthMm: 40,
        curve,
        direction: 'ccw',
        startDeg: 0,
        sections: 4,
      }),
    );

    for (const stations of stationSets) {
      for (const rotDeg of [0, 45, 90, 135, 180]) {
        expect(stations.some((s) => s.rotDeg === rotDeg)).toBe(true);
      }
    }

    const middleAxials = stationSets.map((stations) => stations[1].axialMm);
    expect(new Set(middleAxials.map((v) => v.toFixed(6))).size).toBe(
      middleAxials.length,
    );
  });

  it('treats start as absolute and direction as sweep sign only', () => {
    const stations = buildRadialStations({
      angleDeg: 90,
      lengthMm: 10,
      curve: { kind: 'linear' },
      direction: 'cw',
      startDeg: 10,
      sections: 3,
    });

    expect(stations.map((s) => s.rotDeg)).toEqual([10, -20, -50, -80]);
    expect(stations[1].axialMm).toBeCloseTo(10 / 3, 8);
    expect(stations[2].axialMm).toBeCloseTo(20 / 3, 8);
    expect(stations[3].axialMm).toBe(10);
  });

  it('keeps step-start angularly visible with a finite hard transition', () => {
    const stations = buildRadialStations({
      angleDeg: 90,
      lengthMm: 20,
      curve: { kind: 'step-start' },
      direction: 'ccw',
      startDeg: 0,
      sections: 4,
    });

    expect(stations[0]).toMatchObject({ rotDeg: 0, axialMm: 0 });
    expect(stations.some((s) => s.hardBreak && s.rotDeg > 0)).toBe(true);
    expect(stations.at(-1)?.rotDeg).toBe(90);
    expect(stations.at(-1)?.axialMm).toBeCloseTo(20, 8);
    expect(stations[2].axialMm).toBeGreaterThan(stations[1].axialMm);
    expect(
      new Set(stations.map((s) => s.rotDeg.toFixed(6))).size,
    ).toBeGreaterThan(2);
  });

  it('keeps step-end angularly visible with a finite hard transition', () => {
    const stations = buildRadialStations({
      angleDeg: 90,
      lengthMm: 20,
      curve: { kind: 'step-end' },
      direction: 'ccw',
      startDeg: 0,
      sections: 4,
    });

    const hardBreak = stations.find((s) => s.hardBreak);
    expect(hardBreak?.rotDeg).toBeGreaterThan(0);
    expect(hardBreak?.rotDeg).toBeLessThan(90);
    expect(hardBreak?.axialMm).toBeGreaterThan(0);
    expect(hardBreak?.axialMm).toBeLessThan(20);
    expect(stations[1].axialMm).toBeGreaterThan(stations[0].axialMm);
    expect(stations.at(-1)?.rotDeg).toBe(90);
    expect(stations.at(-1)?.axialMm).toBeCloseTo(20, 8);
    expect(
      new Set(stations.map((s) => s.rotDeg.toFixed(6))).size,
    ).toBeGreaterThan(2);
  });

  it('adds a pre-cap station for eased and bezier curves', () => {
    const eased = buildRadialStations({
      angleDeg: 180,
      lengthMm: 40,
      curve: { kind: 'ease-in-out' },
      direction: 'ccw',
      startDeg: 0,
      sections: 4,
    });
    const bezier = buildRadialStations({
      angleDeg: 180,
      lengthMm: 40,
      curve: { kind: 'cubic-bezier', x1: 0.2, y1: 0.8, x2: 0.4, y2: 1 },
      direction: 'ccw',
      startDeg: 0,
      sections: 4,
    });

    expect(eased.at(-2)?.rotDeg).toBeCloseTo(177.3, 5);
    expect(bezier.at(-2)?.rotDeg).toBeCloseTo(177.3, 5);
    expect(eased.at(-1)?.rotDeg).toBe(180);
    expect(bezier.at(-1)?.rotDeg).toBe(180);
  });
});
