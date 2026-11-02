/**
 * @author Aidan Boissonneault
 * @file imported-shape-help.ts
 * @purpose Provides imported shape help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const importedShapeHelp: Record<string, LanguageHelpEntry> = {
  shape: {
    summary:
      'Imports external CAD geometry under a name for placement and geometry operations.',
    signatures: ["import shape name = './asset.step';"],
    parameters: [
      { name: 'name', description: 'Local imported-shape identifier.' },
      {
        name: 'path',
        description: 'Quoted asset path resolved relative to the source file.',
      },
    ],
    behavior: [
      'The workspace must provide the referenced asset. Use a ref wrapper when imported geometry needs local healing, defeaturing, or anchors.',
    ],
    examples: ["import shape motor = './motor.step';\nplace(motor);"],
    related: ['import', 'ref', 'heal', 'defeature'],
  },
  heal: {
    summary:
      'Runs OCCT shape repair with an explicit tolerance on an existing shape.',
    signatures: [
      'heal object tolerance: distance;',
      'heal tolerance: distance; // inside a ref wrapper',
    ],
    parameters: [
      {
        name: 'object',
        description:
          'Existing target shape; omitted only when a ref wrapper supplies the target.',
      },
      {
        name: 'tolerance',
        description:
          'Repair tolerance in length units; use a small value appropriate to the source geometry.',
      },
    ],
    behavior: [
      'Repair replaces the target shape and refreshes its topology labels. It can fail when shape fixing cannot produce a valid result.',
    ],
    examples: ['obj block = cube([20, 10, 4]);\nheal block tolerance: 0.01;'],
    related: ['shape', 'defeature', 'ref'],
  },
  defeature: {
    summary:
      'Removes selected small cylindrical faces through OCCT defeaturing.',
    signatures: [
      'defeature object holes smaller_than: distance;',
      'defeature object pockets smaller_than: distance;',
    ],
    parameters: [
      {
        name: 'object',
        description: 'Target shape; may be omitted inside a ref wrapper.',
      },
      {
        name: 'holes / pockets',
        description:
          'Parsed feature-category request. The current bridge uses the same cylindrical-face selection for both.',
      },
      {
        name: 'smaller_than',
        description:
          'Maximum cylindrical-face radius, inclusive, in the current implementation.',
      },
    ],
    behavior: [
      'The current bridge does not distinguish holes from pockets or classify arbitrary pocket geometry. It selects cylindrical faces with radius > 0 and <= threshold.',
      'When no faces match, the shape remains unchanged.',
    ],
    examples: [
      'obj block = cube([20, 10, 4]);\ndefeature block holes smaller_than: 1;',
    ],
    related: ['smaller_than', 'heal', 'shape'],
  },
  smaller_than: {
    summary: 'Sets the face-size threshold for a defeature statement.',
    signatures: ['defeature object holes smaller_than: threshold;'],
    parameters: [
      {
        name: 'threshold',
        description:
          'Current selection compares cylindrical radius, not diameter, using radius <= threshold.',
      },
    ],
    examples: [
      'obj block = cube([20, 10, 4]);\ndefeature block holes smaller_than: 1;',
    ],
    related: ['defeature'],
  },
};
