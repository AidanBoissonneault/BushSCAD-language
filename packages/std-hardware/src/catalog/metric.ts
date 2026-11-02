/**
 * @author Aidan Boissonneault
 * @file metric.ts
 * @purpose Provides metric behavior for the catalog in std hardware package.
 * @last-edited October 6, 2026
 */

import type {
  HardwareSizeEntry,
  HardwareSpecKind,
  HoleSpec,
} from '../types/types.js';

// All dimensions in mm. Values per ISO standards with common engineering defaults.
export const METRIC_HARDWARE: Record<string, HardwareSizeEntry> = {
  M2: {
    clearance: { kind: 'clearance', diameter: 2.4 },
    tap: { kind: 'tap', diameter: 1.6, pitch: 0.4 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 2.4,
      boreDiameter: 4.0,
      boreDepth: 2.0,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 2.4,
      sinkDiameter: 4.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 3.2,
      defaultDepth: 3.5,
    },
    pilot: { kind: 'pilot', diameter: 1.6 },
  },
  M2_5: {
    clearance: { kind: 'clearance', diameter: 2.9 },
    tap: { kind: 'tap', diameter: 2.05, pitch: 0.45 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 2.9,
      boreDiameter: 5.0,
      boreDepth: 2.5,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 2.9,
      sinkDiameter: 5.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 3.8,
      defaultDepth: 4.0,
    },
    pilot: { kind: 'pilot', diameter: 2.05 },
  },
  M3: {
    clearance: { kind: 'clearance', diameter: 3.4 },
    tap: { kind: 'tap', diameter: 2.5, pitch: 0.5 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 3.4,
      boreDiameter: 6.0,
      boreDepth: 3.0,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 3.4,
      sinkDiameter: 6.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 4.6,
      defaultDepth: 5.0,
    },
    pilot: { kind: 'pilot', diameter: 2.5 },
  },
  M4: {
    clearance: { kind: 'clearance', diameter: 4.5 },
    tap: { kind: 'tap', diameter: 3.3, pitch: 0.7 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 4.5,
      boreDiameter: 8.0,
      boreDepth: 4.0,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 4.5,
      sinkDiameter: 8.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 5.6,
      defaultDepth: 6.0,
    },
    pilot: { kind: 'pilot', diameter: 3.3 },
  },
  M5: {
    clearance: { kind: 'clearance', diameter: 5.5 },
    tap: { kind: 'tap', diameter: 4.2, pitch: 0.8 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 5.5,
      boreDiameter: 10.0,
      boreDepth: 5.0,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 5.5,
      sinkDiameter: 10.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 7.0,
      defaultDepth: 7.5,
    },
    pilot: { kind: 'pilot', diameter: 4.2 },
  },
  M6: {
    clearance: { kind: 'clearance', diameter: 6.6 },
    tap: { kind: 'tap', diameter: 5.0, pitch: 1.0 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 6.6,
      boreDiameter: 11.0,
      boreDepth: 6.0,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 6.6,
      sinkDiameter: 11.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 8.0,
      defaultDepth: 9.0,
    },
    pilot: { kind: 'pilot', diameter: 5.0 },
  },
  M8: {
    clearance: { kind: 'clearance', diameter: 9.0 },
    tap: { kind: 'tap', diameter: 6.8, pitch: 1.25 },
    counterbore: {
      kind: 'counterbore',
      clearanceDiameter: 9.0,
      boreDiameter: 14.0,
      boreDepth: 8.0,
    },
    countersink: {
      kind: 'countersink',
      clearanceDiameter: 9.0,
      sinkDiameter: 14.0,
      angle: 90,
    },
    heatset_insert: {
      kind: 'heatset_insert',
      outerDiameter: 10.9,
      defaultDepth: 12.0,
    },
    pilot: { kind: 'pilot', diameter: 6.8 },
  },
};

/** Normalizes decimal metric size names for identifier-safe catalog lookups. */
export function normalizeSize(size: string): string {
  return size.replace('.', '_');
}

/**
 * Looks up metric spec by its declared key.
 */
export function lookupMetricSpec(
  size: string,
  specKind: HardwareSpecKind,
): HoleSpec | null {
  const entry = METRIC_HARDWARE[normalizeSize(size)];
  if (!entry) return null;
  return entry[specKind] ?? null;
}
