/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for std hardware package.
 * @last-edited October 6, 2026
 */

export type {
  HardwareSpecKind,
  HoleSpec,
  ClearanceHoleSpec,
  TapHoleSpec,
  CounterboreSpec,
  CountersinkSpec,
  HeatsetInsertSpec,
  PilotHoleSpec,
  HardwareSizeEntry,
} from './types/types.js';

export {
  METRIC_HARDWARE,
  lookupMetricSpec,
  normalizeSize,
} from './catalog/metric.js';
