/**
 * @author Aidan Boissonneault
 * @file joint-help.ts
 * @purpose Provides joint help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const jointKinds: Record<
  string,
  { summary: string; range: string; valueKind: string }
> = {
  fixed: {
    summary: 'Declares a rigid relation with no preview motion.',
    range: '0deg..0deg',
    valueKind: 'no motion',
  },
  revolute: {
    summary: "Declares rotation about the joint's resolved axis.",
    range: '0deg..120deg',
    valueKind: 'angles',
  },
  slider: {
    summary: "Declares translation along the joint's resolved axis.",
    range: '0mm..80mm',
    valueKind: 'lengths',
  },
  planar: {
    summary:
      'Declares planar motion; preview currently exposes one scalar translation along the resolved axis.',
    range: '0mm..80mm',
    valueKind: 'lengths',
  },
  ball: {
    summary:
      'Declares ball motion; preview currently exposes one scalar rotation about the resolved axis.',
    range: '0deg..120deg',
    valueKind: 'angles',
  },
};

/** Joint help describes the compact type-led declarations used by every editor. */
export const jointHelp: Record<string, LanguageHelpEntry> = {
  ...Object.fromEntries(
    Object.entries(jointKinds).map(([kind, details]) => [
      kind,
      {
        summary: details.summary,
        signatures: [
          `${kind} name(@moving.reference, @support.reference) { range = ${details.range}; default = value; }`,
        ],
        parameters: [
          {
            name: 'moving reference',
            description:
              'The independently rendered part transformed by the preview control.',
          },
          {
            name: 'support reference',
            description:
              'The stationary side used to describe the relationship.',
          },
        ],
        behavior: [
          `Range and default values use ${details.valueKind}. Preview motion does not alter authored geometry or create an animated STEP export.`,
        ],
        examples: [
          `${kind} motion(@moving.axis, @support.axis) {\n  range = ${details.range};\n  default = ${details.range.split('..')[0]};\n}`,
        ],
        related: ['range', 'default'],
      },
    ]),
  ),
  range: {
    summary:
      'Sets inclusive motion bounds for a joint preview; this property is distinct from the range(...) loop function.',
    signatures: ['range = minimum..maximum;'],
    behavior: [
      'The minimum and maximum are inclusive. Use length units for slider and planar joints, and angle units for revolute and ball joints.',
    ],
    examples: [
      'slider drawer_slide(@drawer.front, @case.front) {\n  range = 0mm..80mm;\n}',
      'revolute lid_hinge(@lid.right, @case.right) {\n  range = -90deg..90deg;\n}',
    ],
    related: ['slider', 'revolute', 'default'],
  },
  default: {
    summary: 'Sets the initial scalar value shown by a joint preview control.',
    signatures: ['default = value;'],
    behavior: [
      'The value must lie within the joint range when one is present.',
    ],
    examples: [
      'revolute hinge(@lid.right, @box.right) { range = 0deg..120deg; default = 15deg; }',
    ],
    related: ['range', 'revolute', 'slider'],
  },
};
