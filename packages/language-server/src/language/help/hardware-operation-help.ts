/**
 * @author Aidan Boissonneault
 * @file hardware-operation-help.ts
 * @purpose Provides hardware operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const hardwareOperationHelp: Record<string, LanguageHelpEntry> = {
  hole: {
    summary:
      'Cuts a hardware-sized hole using a metric preset instead of manually choosing drill dimensions.',
    signatures: [
      'obj name = hole(M3.clearance, through target, @placement);',
      'obj name = hole(M3.counterbore, depth: distance, @placement);',
    ],
    parameters: [
      {
        name: 'size.kind',
        description:
          'Metric size M2, M2.5, M3, M4, M5, M6, or M8 with clearance, tap, pilot, counterbore, countersink, or heatset_insert.',
      },
      {
        name: 'depth / through',
        description:
          'Blind depth in length units or penetration through the named/inferred target.',
      },
      {
        name: '@placement',
        description:
          'Face placement identifying the target body; may be supplied by an active placement context.',
      },
    ],
    behavior: [
      'Hardware tables are built in; use std.hardware.metric is optional documentation of intent.',
      'Counterbores emit a larger head recess and a clearance cut. Current countersink lowering emits the clearance cut only; it does not build a conical seat.',
      'The tap preset supplies a cylindrical drill diameter. It does not cut a helical thread; use thread separately when needed.',
      'Linear pattern replays the generated hole recipe.',
    ],
    examples: [
      'obj plate = cube([40, 30, 8]);\nobj mount = hole(M3.clearance, through, @plate.top.center);',
    ],
    related: ['heatset_insert', 'thread', 'pattern', 'std'],
  },
  heatset_insert: {
    summary:
      'Cuts a cylindrical pocket sized for a metric heat-set insert, with optional depth override.',
    signatures: [
      'obj name = heatset_insert(M3, depth: distance, @placement);',
      'obj name = heatset_insert(M3, @placement);',
    ],
    parameters: [
      { name: 'size', description: 'Metric preset size such as M3 or M2.5.' },
      {
        name: 'depth',
        description:
          'Optional pocket depth in length units; omitted depth uses the preset default.',
      },
      {
        name: '@placement',
        description:
          'Target face placement; otherwise an active placement context is required.',
      },
    ],
    behavior: [
      'Uses the preset outer diameter for the pocket and produces insert display metadata. Check the selected preset against the insert being used.',
    ],
    examples: [
      'obj boss = cylinder(12, d: 12);\nobj insert_pocket = heatset_insert(M3, depth: 5, @boss.top.center);',
    ],
    related: ['hole', 'std', 'cut'],
  },
  std: {
    summary:
      'Names the built-in standard-library namespace used by hardware presets and manufacturing process profiles.',
    signatures: ['use std.hardware.metric;', 'use std.fits.fdm_pla;'],
    behavior: [
      'Hardware presets are always available. A recognized std.fits profile selects manufacturing tolerance defaults for fit declarations.',
    ],
    examples: [
      'use std.hardware.metric;\nobj plate = cube([30, 20, 6]);\nobj mount = hole(M3.clearance, through, @plate.top.center);',
    ],
    related: ['use', 'hole', 'heatset_insert', 'fit'],
  },
};
