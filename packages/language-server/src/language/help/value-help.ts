/**
 * @author Aidan Boissonneault
 * @file value-help.ts
 * @purpose Provides value help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const lengthUnits: Record<string, { name: string; millimetres: number }> = {
  mm: { name: 'millimetres', millimetres: 1 },
  cm: { name: 'centimetres', millimetres: 10 },
  m: { name: 'metres', millimetres: 1000 },
  ft: { name: 'feet', millimetres: 304.8 },
};

/** Numeric values and dimensions explain both units and the context they measure. */
export const valueHelp: Record<string, LanguageHelpEntry> = {
  ...Object.fromEntries(
    Object.entries(lengthUnits).map(([unit, info]) => [
      unit,
      {
        summary: `An explicit length suffix denoting ${info.name}; 1${unit} equals ${info.millimetres}mm.`,
        signatures: [`number${unit}`, `base_unit = ${unit};`],
        behavior: [
          'An explicit suffix overrides the file base unit for that value. Lengths, angles, and dimensionless counts are different kinds of parameters; check the operation signature.',
        ],
        examples: [`base_unit = mm;\nsketch plate = rect(2${unit}, 10mm);`],
        related: ['base_unit', 'in', 'deg'],
      },
    ]),
  ),
  deg: {
    summary:
      "An angular suffix specifying degrees, independent of the file's length unit.",
    signatures: ['numberdeg'],
    behavior: [
      'Use for rotations, radial sweeps, and angle constraints. A full turn is 360deg and a right angle is 90deg.',
    ],
    examples: ['obj block = cube([20, 10, 4]);\nrotate block 45deg around z;'],
    related: ['rotate', 'radial'],
  },
  ...Object.fromEntries(
    ['true', 'false'].map((value) => [
      value,
      {
        summary: `The boolean literal ${value}, used for conditions and boolean build parameters.`,
        signatures: [value],
        behavior: [
          'Write booleans without quotes. A quoted string is a different value and does not declare a boolean parameter.',
        ],
        examples: [
          `env enabled fallback ${value};\npart sample {\n  if enabled { obj pin = cylinder(8, d: 3); }\n}`,
        ],
        related: ['if', 'env'],
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries({ XY: '+Z', XZ: '-Y', YZ: '+X' }).map(([plane, normal]) => [
      plane,
      {
        summary: `The ${plane} starting sketch plane, whose positive extrusion normal is ${normal}.`,
        signatures: [`workplane = ${plane};`],
        behavior: [
          'Used when no explicit target frame supplies placement. Geometry face names stay local to the resulting solid.',
        ],
        examples: [
          `workplane = ${plane};\nobj plate = extrude(rect(20, 10), 3);`,
        ],
        related: ['workplane', 'plane'],
      },
    ]),
  ),
  width: {
    summary:
      "Reads a sketch or face's width as a numeric dimension, or drives a supported compact sketch dimension.",
    signatures: [
      'profile.width',
      'body.face.width',
      '@profile.width = expression;',
    ],
    behavior: [
      "Dimension properties can feed new profiles and within loops. A compact driving assignment is different from editing a built solid's bounding box.",
    ],
    examples: [
      'sketch plate = rect(40, 30);\nsketch insert = rect(plate.width - 4, plate.height - 4);',
    ],
    related: ['height', 'length', 'within', '_'],
  },
  height: {
    summary:
      "Reads a sketch or face's height as a numeric dimension, or drives a supported compact sketch height.",
    signatures: [
      'profile.height',
      'body.face.height',
      '@profile.height = expression;',
    ],
    behavior: [
      "Height is measured in the profile/face frame, so it is not always world Z. A solid's extrusion depth is a separate operation argument.",
    ],
    examples: [
      'sketch plate = rect(40, 30);\nsketch insert = rect(plate.width - 4, plate.height - 4);',
    ],
    related: ['width', 'length', '_'],
  },
  length: {
    summary:
      'A compatibility dimension alias for sketch height and supported face/edge-like lengths.',
    signatures: ['profile.length', 'body.face.length'],
    behavior: [
      'Prefer width and height for profile dimensions. The meaning of length depends on whether the referenced entity is a sketch, face, or edge.',
    ],
    examples: ['sketch plate = rect(40, 30);\nvar old_height = plate.length;'],
    related: ['width', 'height'],
  },
  this: {
    summary:
      'Refers to the current placement context when evaluating a reusable profile or component.',
    signatures: [
      'this.width',
      'this.height',
      'this.center',
      'this.area',
      'this.normal',
    ],
    behavior: [
      'The target face or plane supplies context at placement time. Define adaptive sketches with this.width/height rather than hard-coding the dimensions of one caller.',
    ],
    examples: [
      'ref cover {\n  sketch outline = rect(this.width - 4, this.height - 4);\n  obj plate = extrude(outline, 2);\n}\nobj base = cube([40, 30, 6]);\nplace(cover, @base.top.center);',
    ],
    related: ['place', 'inset', 'width'],
  },
  depth: {
    summary:
      'A named length argument for operations that remove or extend material to a finite depth.',
    signatures: [
      'cut(profile, depth: value, @target)',
      'hole(size, depth: value, @target)',
    ],
    behavior: [
      "Use through for a full-body cut. Depth follows the operation's placement frame and is not necessarily a world-Z coordinate.",
    ],
    examples: [
      'obj base = cube([40, 30, 8]);\nobj pocket = cut(circle(10), depth: 3, @base.top.center);',
    ],
    related: ['cut', 'through', 'hole'],
  },
};
