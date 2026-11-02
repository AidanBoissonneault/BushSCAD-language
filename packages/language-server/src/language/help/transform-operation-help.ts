/**
 * @author Aidan Boissonneault
 * @file transform-operation-help.ts
 * @purpose Provides transform operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const transformOperationHelp: Record<string, LanguageHelpEntry> = {
  pattern: {
    summary:
      'Copies an existing object into a linear grid or an evenly spaced circular array.',
    signatures: [
      'pattern(target, linear, countX, spacing, countY);',
      'pattern(target, linear, x: countX, y: countY, spacing: (dx, dy));',
      'pattern(target, radial, count, around: object.face.center);',
    ],
    parameters: [
      {
        name: 'target',
        description:
          'Existing object name; target: and object: named forms are accepted.',
      },
      {
        name: 'linear / radial',
        description: 'Pattern mode; defaults to linear when omitted.',
      },
      {
        name: 'count / countX / countY',
        description:
          'Rounded integer instance counts, including the original; countY defaults to 1.',
      },
      {
        name: 'spacing',
        description:
          'Linear displacement between instances; use a scalar for X or (dx, dy) for a grid.',
      },
      {
        name: 'around',
        description:
          'Required axis reference for radial mode; instances span a full 360-degree turn.',
      },
    ],
    behavior: [
      'The original instance is retained; additional copies begin at the next spacing/angle.',
      'Linear patterns of hardware holes replay their cut recipes on the target body.',
    ],
    examples: [
      'obj peg = cylinder(8, d: 4);\npattern(peg, linear, x: 3, y: 2, spacing: (12, 12));',
    ],
    related: ['linear', 'radial', 'mirror', 'for'],
  },
  linear: {
    summary:
      'Selects a linear object pattern, or uniform axial progress for a radial curve.',
    signatures: [
      'pattern(target, linear, count, spacing);',
      'radial_extrude(profile, axis: z, angle: a, length: h, curve: linear)',
    ],
    behavior: [
      'In patterns, spacing advances along X and optionally Y. In radial operations, curve: linear advances axial length uniformly with rotation, like natural.',
    ],
    examples: ['obj peg = cylinder(8, d: 4);\npattern(peg, linear, 3, 12);'],
    related: ['pattern', 'curve', 'natural'],
  },
  mirror: {
    summary:
      'Adds a reflected copy of an existing object across a world, face, or center plane.',
    signatures: [
      'mirror(target, X);',
      'mirror(target: object, across: object.face);',
      'mirror(target, plane(center));',
    ],
    parameters: [
      { name: 'target', description: 'Existing object to copy.' },
      {
        name: 'across',
        description:
          'X/Y/Z world-normal plane, face reference, or plane(center). World X reflects across the YZ plane through the origin.',
      },
    ],
    behavior: [
      'The source object remains; mirror adds a reflected body.',
      'Use uppercase X/Y/Z for the world-plane shorthand. Face arguments do not take a leading @.',
    ],
    examples: [
      'obj block = cube([10, 8, 4]);\ntransform(block, translate(15));\nmirror(block, X);',
    ],
    related: ['across', 'transform', 'pattern'],
  },
  across: {
    summary: 'Names the reflection plane argument in a mirror call.',
    signatures: ['mirror(target: object, across: X);'],
    parameters: [
      {
        name: 'plane',
        description:
          'Uppercase X/Y/Z, an object face reference, or plane(center).',
      },
    ],
    examples: [
      'obj block = cube([10, 8, 4]);\nmirror(target: block, across: Z);',
    ],
    related: ['mirror', 'plane'],
  },
  transform: {
    summary:
      'Applies a translation, rotation, or uniform scale to an existing object.',
    signatures: [
      'transform(target, translate(x, y, z));',
      'transform(target, rotate(angle: degrees, around: z));',
      'transform(target, scale(factor));',
    ],
    parameters: [
      {
        name: 'target',
        description: 'Existing object name; target: is also accepted.',
      },
      {
        name: 'operation',
        description:
          'translate, rotate, or scale; operation: is the named argument form.',
      },
      {
        name: 'translate',
        description:
          'X/Y/Z offsets in length units; omitted components are zero.',
      },
      {
        name: 'rotate',
        description: 'Angle in degrees and required world/reference axis.',
      },
      {
        name: 'scale',
        description:
          'Dimensionless uniform scale factor applied to the geometry.',
      },
    ],
    behavior: [
      'Transform changes the existing body. To generate repeated copies, use pattern or mirror.',
    ],
    examples: [
      'obj block = cube([20, 10, 4]);\ntransform(block, translate(x: 10, y: 5));\ntransform(block, rotate(angle: 45deg, around: z));',
    ],
    related: ['rotate', 'mirror', 'pattern'],
  },
};
