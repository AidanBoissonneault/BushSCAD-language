/**
 * @author Aidan Boissonneault
 * @file profile-operation-help.ts
 * @purpose Provides profile operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const profileOperationHelp: Record<string, LanguageHelpEntry> = {
  extrude: {
    summary:
      'Pushes a closed sketch profile along its placement normal to add solid geometry.',
    signatures: [
      'obj name = extrude(profile, depth);',
      'obj name = extrude(profile, depth symmetric, @placement);',
      'obj name = extrude(profile, depth: value, @placement);',
    ],
    parameters: [
      {
        name: 'profile',
        description:
          'Named sketch or inline sketch expression. The profile must enclose a region.',
      },
      {
        name: 'depth',
        description:
          'Extrusion length in the active base unit; explicit length suffixes are accepted.',
      },
      {
        name: 'symmetric',
        description:
          'Splits the total depth equally across both sides of the starting plane.',
      },
      {
        name: '@placement',
        description:
          'Optional face/point placement and offsets; defaults to the sketch starting plane.',
      },
    ],
    behavior: [
      'Extrude adds material. Use cut to subtract a profile.',
      'Bind topology with obj: later @name.top and detail operations refer to the object, not its source sketch.',
      'Use comma followed by @placement in current call syntax.',
    ],
    examples: [
      'sketch plate = rect(60, 40);\nobj base = extrude(plate, 6);\nobj boss = extrude(circle(8), 10, @base.top.center);',
      'sketch rib = rect(30, 4);\nobj brace = extrude(rib, 8 symmetric);',
    ],
    related: ['sketch', 'obj', 'cut', 'symmetric', 'wrap'],
  },
  cut: {
    summary:
      'Subtracts a sketch profile or an oriented solid-tool copy from an existing body and names the resulting feature.',
    signatures: [
      'obj name = cut(profile, depth, @placement);',
      'obj name = cut(profile, through target, @placement);',
      'obj name = cut(profile, through, @placement);',
      'obj name = cut(tool, @placement);',
    ],
    parameters: [
      {
        name: 'profile / tool',
        description:
          'A closed sketch for depth/through cuts, or an existing solid/hidden ref/inline extrude, revolve, loft, sweep, or thicken for solid-tool cuts.',
      },
      {
        name: 'depth / through',
        description:
          'Blind depth in length units, or complete penetration of the named/inferred target.',
      },
      {
        name: '@placement',
        description:
          'Determines cut position and direction. For solid tools it is required and identifies the target through its owning face.',
      },
    ],
    behavior: [
      'Bare through infers the body from placement. Placement arguments accept @ arrays, wildcards, and selector variables.',
      'An identifier is interpreted as a solid tool only in cut(name, @placement). Inline solid tools are temporary; declared tools remain visible unless declared with ref.',
      'Cut faces belong to the new obj name; through cuts have no bottom face. Features placed on cut faces follow the inward-facing cut normal.',
    ],
    examples: [
      'obj base = cube([40, 30, 8]);\nsketch bore = circle(5);\nobj hole = cut(bore, through, @base.top.center);',
      'obj base = cube([40, 30, 8]);\nref tool = extrude(rect(12, 6), 4);\nobj pocket = cut(tool, @base.top.center);',
    ],
    related: ['through', 'extrude', 'ref', 'radial_cut'],
  },
  revolve: {
    summary:
      'Spins a closed sketch about a world or referenced axis to create a solid of revolution.',
    signatures: [
      'obj name = revolve(profile, angle around axis);',
      'obj name = revolve(profile, angle around axis, radius: offset);',
    ],
    parameters: [
      { name: 'profile', description: 'Closed named or inline sketch.' },
      {
        name: 'angle',
        description: 'Sweep angle in degrees; 360deg makes a complete turn.',
      },
      {
        name: 'axis',
        description:
          'x, y, z, or a spatial reference that resolves to one axis.',
      },
      {
        name: 'radius',
        description:
          'Offsets the profile from the axis before revolving, useful for rings. Expressions may use variables but not this.',
      },
    ],
    behavior: [
      'The profile must be closed; keep its section clear of self-intersection about the axis.',
      'An axis selector must resolve to one placement.',
    ],
    examples: [
      'sketch section = circle(6);\nobj ring = revolve(section, 360deg around z, radius: 20);',
    ],
    related: ['around', 'torus', 'radial_extrude'],
  },
  loft: {
    summary:
      'Builds a transition solid through two or more ordered closed sketch sections over a required height.',
    signatures: [
      'obj name = loft(first, second, height: distance);',
      'obj name = loft(first, second, ..., height: distance, guide: openSketch in XZ);',
    ],
    parameters: [
      {
        name: 'profiles',
        description:
          'Ordered named or inline closed sections; at least two are needed to form the transition.',
      },
      {
        name: 'height',
        description: 'Required separation along the loft direction.',
      },
      {
        name: 'guide',
        description:
          'Optional open sketch profile guiding the transition; in XY/XZ/YZ can set its guide workplane.',
      },
    ],
    behavior: [
      'Only the first profile may have explicit placement. Later profiles must remain unplaced so the loft controls their section positions.',
      'Guide input is an open sketch, distinct from a 3D path used by sweep.',
    ],
    examples: [
      'sketch foot = rect(40, 30);\nsketch neck = circle(16);\nobj transition = loft(foot, neck, height: 35);',
    ],
    related: ['guide', 'sweep', 'extrude'],
  },
  sweep: {
    summary:
      'Carries a closed section along a named or inline 3D path to form a tube, rail, or other path-shaped solid.',
    signatures: [
      'obj name = sweep(profile along path);',
      'obj name = sweep(profile along path, orientation: default|fixed|binormal);',
    ],
    parameters: [
      { name: 'profile', description: 'Closed sketch section.' },
      {
        name: 'path',
        description:
          '3D path declared with polyline or spline, or an inline path input. The arc(from: ...) form is not implemented.',
      },
      {
        name: 'orientation',
        description:
          'Frame mode: default, fixed, or binormal. Supply it positionally or with orientation:.',
      },
    ],
    behavior: [
      'The section must be closed. Tight bends or sharp corners can make a section intersect itself.',
      'up: is not an accepted sweep argument in the current parser.',
      'For a groove, use an inline sweep as the tool in cut(sweep(...), @target).',
    ],
    examples: [
      'sketch section = circle(4);\npath rail = polyline([(0,0,0), (0,0,30)]);\nobj rod = sweep(section along rail, orientation: default);',
    ],
    related: ['path', 'along', 'binormal', 'cut'],
  },
};
