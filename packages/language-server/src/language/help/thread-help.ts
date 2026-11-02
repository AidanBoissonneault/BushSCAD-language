/**
 * @author Aidan Boissonneault
 * @file thread-help.ts
 * @purpose Provides thread help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const threadHelp: Record<string, LanguageHelpEntry> = {
  thread: {
    summary:
      'Adds an external or internal screw thread to an existing object inside a part or component body.',
    signatures: [
      'thread(target, type, d, pitch, length: extent, direction: regular);',
    ],
    parameters: [
      {
        name: 'target',
        description:
          'Existing object name; named arguments accept target: or object:.',
      },
      {
        name: 'type',
        description: 'Required external or internal thread type.',
      },
      {
        name: 'd, pitch',
        description:
          'Required diameter and axial spacing between turns. The current evaluator emits these numeric values directly as millimeters; use base_unit = mm.',
      },
      {
        name: 'length',
        description:
          'Optional axial extent. A cut target can supply its recorded cut depth when omitted.',
      },
      {
        name: 'direction',
        description:
          'regular, clockwise, or counter_clockwise; handedness: and hand: are aliases.',
      },
      {
        name: 'angle',
        description: 'Optional angle in degrees, also accepted as degrees:.',
      },
    ],
    behavior: [
      'Use this as a body statement after creating the target. It is not an object constructor.',
      'The removed depth: argument is rejected; use length:. A cut target supplies its recorded placement axis.',
    ],
    examples: [
      'base_unit = mm;\npart fastener {\n  sketch profile = circle(3);\n  obj shaft = extrude(profile, 12);\n  thread(shaft, external, 6, 1, length: 10);\n}',
    ],
    related: ['helix', 'cut', 'extrude'],
  },
};
