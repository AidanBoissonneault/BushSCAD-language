/**
 * @author Aidan Boissonneault
 * @file profiles.ts
 * @purpose Provides profiles behavior for the profiles in std tolerances package.
 * @last-edited October 6, 2026
 */

import type { ProfileOffsets } from '../types/types.js';

export const PROFILES: Record<string, ProfileOffsets> = {
  'std.printing.fdm': {
    clearance: { normal: 0.25, tight: 0.15, loose: 0.4 },
    slip: { normal: 0.15, tight: 0.08, loose: 0.25 },
    press: { normal: -0.1, tight: -0.05, loose: -0.15 },
    interference: { normal: -0.2, tight: -0.1, loose: -0.3 },
    loose: { normal: 0.4, tight: 0.25, loose: 0.55 },
    tight: { normal: 0.08, tight: 0.05, loose: 0.15 },
  },
  'std.printing.resin': {
    clearance: { normal: 0.1, tight: 0.05, loose: 0.2 },
    slip: { normal: 0.05, tight: 0.02, loose: 0.1 },
    press: { normal: -0.05, tight: -0.02, loose: -0.1 },
    interference: { normal: -0.1, tight: -0.05, loose: -0.2 },
    loose: { normal: 0.2, tight: 0.1, loose: 0.3 },
    tight: { normal: 0.03, tight: 0.01, loose: 0.08 },
  },
  'std.machining.cnc': {
    clearance: { normal: 0.05, tight: 0.02, loose: 0.1 },
    slip: { normal: 0.02, tight: 0.01, loose: 0.05 },
    press: { normal: -0.02, tight: -0.01, loose: -0.05 },
    interference: { normal: -0.05, tight: -0.02, loose: -0.1 },
    loose: { normal: 0.1, tight: 0.05, loose: 0.2 },
    tight: { normal: 0.01, tight: 0.005, loose: 0.03 },
  },
  'std.cutting.laser': {
    clearance: { normal: 0.15, tight: 0.08, loose: 0.25 },
    slip: { normal: 0.1, tight: 0.05, loose: 0.15 },
    press: { normal: 0, tight: 0, loose: 0 },
    interference: { normal: 0, tight: 0, loose: 0 },
    loose: { normal: 0.25, tight: 0.15, loose: 0.4 },
    tight: { normal: 0.05, tight: 0.02, loose: 0.1 },
  },
};

// FDM is the default when no process profile is active.
export const DEFAULT_PROFILE = 'std.printing.fdm';
