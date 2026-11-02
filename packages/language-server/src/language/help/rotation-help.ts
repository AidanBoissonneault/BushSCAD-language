/**
 * @author Aidan Boissonneault
 * @file rotation-help.ts
 * @purpose Provides rotation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Rotation forms retain their axis/anchor distinctions instead of generic transform help. */
export const rotationHelp: Record<string, LanguageHelpEntry> = {
  rotate: {
    summary:
      'Rotates a placed component before snapping, or rotates an existing object around a chosen axis.',
    signatures: [
      'place(component, @target) rotate(angle);',
      'place(component) rotate(x: angle, y: angle, z: angle);',
      'rotate target angle around axis;',
    ],
    parameters: [
      {
        name: 'angle',
        description:
          'Degrees; the single-angle placement form uses the placement plane normal.',
      },
      {
        name: 'axis',
        description:
          'x, y, z, or a face-derived axis/anchor for standalone rotation.',
      },
    ],
    behavior: [
      'The placement suffix rotates before anchor snapping. Standalone rotation targets a named object or the latest placed instance of a component. Select anchors carefully when later operations depend on rotated topology.',
    ],
    examples: ['obj block = cube([20, 10, 4]);\nrotate block 30deg around z;'],
    related: ['place', 'around', 'transform'],
  },
  around: {
    summary: 'Supplies the axis for a standalone rotation or radial operation.',
    signatures: [
      'rotate target angle around x | y | z;',
      'rotate target angle around face.center;',
    ],
    behavior: [
      'A face-derived reference supplies both an axis direction and a point on the axis. A named coordinate axis uses the world frame.',
    ],
    examples: ['obj pin = cylinder(12, d: 4);\nrotate pin 90deg around x;'],
    related: ['rotate', 'radial_extrude', 'pattern'],
  },
  ...Object.fromEntries(
    ['X', 'Y', 'Z'].map((axis) => [
      `rotate${axis}`,
      {
        summary: `Appends a rotation about the ${axis.toLowerCase()} axis before component anchor snapping.`,
        signatures: [`place(component, @target) rotate${axis}(angle);`],
        parameters: [
          {
            name: 'angle',
            description: 'Rotation in degrees; use a deg suffix for clarity.',
          },
        ],
        behavior: [
          'This is a placement suffix. Use rotate target angle around axis for an already-created object.',
        ],
        examples: [
          `ref tab { obj body = cube([20, 8, 3]); }\nplace(tab) rotate${axis}(90deg);`,
        ],
        related: ['place', 'rotate'],
      },
    ]),
  ),
};
