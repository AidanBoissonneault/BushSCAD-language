/**
 * @author Aidan Boissonneault
 * @file radial-operation-help.ts
 * @purpose Provides radial operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Makes standalone radial-operation examples so modifier help can be tried directly. */
function radialExample(options: string): string {
  return `sketch section = rect(4, 3);\nobj rib = radial_extrude(section, axis: z, angle: 90, length: 20, ${options});`;
}

const radialParameters = [
  { name: 'profile', description: 'Closed named or inline sketch section.' },
  {
    name: 'axis / from',
    description:
      'Explicit x/y/z or reference axis; otherwise infer the axis from a from placement.',
  },
  {
    name: 'angle, length',
    description:
      'Angular travel in degrees and axial travel in length units; both are required in this extent mode.',
  },
  {
    name: 'from, to, along',
    description:
      'Alternative bridge mode joins two placements, optionally along a named 3D path.',
  },
  {
    name: 'curve',
    description:
      'Controls axial progress relative to rotation; defaults to natural.',
  },
  {
    name: 'start, direction, radius',
    description:
      'Initial angle (default 0), ccw/cw direction (default ccw), and profile radial offset (default 0).',
  },
  {
    name: 'twist, taper, sections',
    description:
      'Section twist and taper angles; optional section count, default auto.',
  },
];
const radialBehavior = [
  'Choose one extent mode: angle and length, between(a, b), or from and to placements with optional along path. Labels are optional and may be mixed with positional values. Do not combine modes.',
  'Taper must be strictly between -89 and 89 degrees. Cubic-bezier X controls must be in [0,1].',
  'The OCCT angle/length path rejects nonzero twist and taper. between: is parsed but unsupported by the geometry bridge; use angle:+length: or a placement bridge.',
  'Use base_unit = mm for radial length/radius values: these currently pass directly from evaluated numbers into millimeter IR fields.',
];

export const radialOperationHelp: Record<string, LanguageHelpEntry> = {
  radial_extrude: {
    summary:
      'Adds a solid by moving a closed section through simultaneous rotation and axial travel, or between referenced placements.',
    signatures: [
      'obj name = radial_extrude(profile, z, degrees, distance);',
      'obj name = radial_extrude(profile, axis: z, angle: degrees, length: distance);',
      'obj name = radial_extrude(profile, start, end, path);',
    ],
    parameters: radialParameters,
    behavior: radialBehavior,
    examples: [radialExample('radius: 15, curve: ease-in-out')],
    related: ['radial_cut', 'curve', 'revolve', 'sweep'],
  },
  radial_cut: {
    summary:
      'Subtracts a radial or guided swept section from the body owning the starting placement.',
    signatures: [
      'obj name = radial_cut(profile, target.face.center, degrees, distance);',
      'obj name = radial_cut(profile, from: start, to: end, along: path);',
    ],
    parameters: radialParameters,
    behavior: [
      ...radialBehavior,
      'Requires a starting placement or an active placement context to identify the body to subtract from.',
    ],
    examples: [
      'obj base = cube([40, 40, 20]);\nsketch slot = rect(3, 2);\nobj groove = radial_cut(slot, axis: z, from: base.top.center, angle: 90, length: 5, radius: 10);',
    ],
    related: ['radial_extrude', 'cut', 'curve'],
  },
  curve: {
    summary:
      'Chooses how axial travel progresses while radial rotation advances, changing the shape of the swept path.',
    signatures: [
      'radial_extrude(profile, axis: z, angle: a, length: h, curve: ease-in-out)',
    ],
    parameters: [
      {
        name: 'curve',
        description:
          'natural, linear, ease, ease-in, ease-out, ease-in-out, step-start, step-end, or cubic-bezier(x1,y1,x2,y2).',
      },
    ],
    behavior: [
      'The default is natural. Rotation follows raw progress while axial travel follows the selected curve.',
    ],
    examples: [radialExample('curve: ease-in-out')],
    related: ['natural', 'ease', 'cubic-bezier', 'sections'],
  },
  sections: {
    summary:
      'Sets the number of sampled section intervals used to build a radial swept solid.',
    signatures: [
      'radial_extrude(profile, axis: z, angle: a, length: h, sections: auto)',
    ],
    parameters: [
      {
        name: 'sections',
        description:
          'auto chooses density from angle and curve; numeric values are rounded and clamped to at least 1.',
      },
    ],
    behavior: [
      'More sections improve curve approximation and increase geometry work. Step/eased curves may insert additional boundary samples.',
    ],
    examples: [radialExample('sections: 48')],
    related: ['curve', 'radial_extrude'],
  },
  twist: {
    summary:
      'Declares a radial section twist angle; nonzero twist is currently unsupported by the OCCT angle/length path.',
    signatures: [
      'radial_extrude(profile, axis: z, angle: a, length: h, twist: degrees)',
    ],
    parameters: [
      { name: 'twist', description: 'Twist angle in degrees; defaults to 0.' },
    ],
    behavior: [
      'The parser and IR retain this angle, but an angle/length sweep with a nonzero value fails geometry compilation.',
    ],
    examples: [radialExample('twist: 0deg')],
    related: ['taper', 'radial_extrude'],
  },
  taper: {
    summary:
      'Declares radial section taper; nonzero taper is currently unsupported by the OCCT angle/length path.',
    signatures: [
      'radial_extrude(profile, axis: z, angle: a, length: h, taper: degrees)',
    ],
    parameters: [
      {
        name: 'taper',
        description:
          'Angle in degrees, strictly between -89 and 89; defaults to 0.',
      },
    ],
    behavior: [
      'The evaluator validates the range, but an angle/length sweep with nonzero taper fails geometry compilation.',
    ],
    examples: [radialExample('taper: 0deg')],
    related: ['twist', 'draft'],
  },
  between: {
    summary:
      'Selects a radial extent defined by two references instead of explicit angle and length.',
    signatures: [
      'radial_extrude(profile, axis: z, between: (startReference, endReference))',
    ],
    parameters: [
      {
        name: 'startReference, endReference',
        description: 'Two spatial references supplied as a parenthesized pair.',
      },
    ],
    behavior: [
      'Recognized by parser and evaluator, but currently rejected by the OCCT bridge. Use angle:+length: or from:+to: instead.',
      'Do not combine between: with another extent mode.',
    ],
    examples: [
      'obj base = cube([40, 30, 20]);\nsketch section = rect(2, 2);\nobj rib = radial_extrude(section, axis: z, between: (base.front.center, base.right.center));',
    ],
    related: ['radial_extrude', 'radial_cut'],
  },
  direction: {
    summary: 'Sets radial winding direction in the owning operation.',
    signatures: [
      'radial_extrude(profile, axis: z, angle: a, length: h, direction: cw)',
    ],
    parameters: [
      {
        name: 'ccw / cw',
        description: 'Counterclockwise/clockwise radial rotation; default ccw.',
      },
    ],
    examples: [radialExample('direction: cw')],
    related: ['radial_extrude', 'radial_cut'],
  },
  guide: {
    summary:
      'Supplies an open sketch that controls the path of a loft transition.',
    signatures: ['loft(first, second, height: h, guide: openSketch in XZ)'],
    parameters: [
      {
        name: 'guide',
        description:
          'Open sketch input; optionally select XY, XZ, or YZ as its guide workplane.',
      },
    ],
    behavior: [
      'Closed guides are rejected. A loft guide is a sketch input; a sweep uses a 3D path after along.',
    ],
    examples: [
      'sketch foot = rect(20, 10);\nsketch tip = circle(8);\nsketch rail = path(line((0,0), (5,20)));\nobj body = loft(foot, tip, height: 20, guide: rail in XZ);',
    ],
    related: ['loft', 'along', 'path'],
  },
  along: {
    summary:
      'Connects a sweep section to its 3D path, or supplies a guide path for a radial placement bridge.',
    signatures: [
      'sweep(profile along path)',
      'radial_extrude(profile, from: a, to: b, along: path)',
    ],
    parameters: [
      {
        name: 'path',
        description: 'Named 3D path; sweep also accepts inline path input.',
      },
    ],
    examples: [
      'path rail = polyline([(0,0,0), (0,0,20)]);\nobj rod = sweep(circle(4) along rail);',
    ],
    related: ['sweep', 'path', 'radial_extrude'],
  },
  binormal: {
    summary:
      'Selects the sweep frame mode using a fixed world-Z binormal direction.',
    signatures: ['sweep(profile along path, orientation: binormal)'],
    behavior: [
      'Use orientation: binormal inside sweep. It is an orientation value, not a standalone geometry operation.',
    ],
    examples: [
      'path rail = polyline([(0,0,0), (0,0,20)]);\nobj rod = sweep(circle(4) along rail, orientation: binormal);',
    ],
    related: ['sweep', 'fixed'],
  },
};
