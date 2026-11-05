/**
 * @author Aidan Boissonneault
 * @file placement-help.ts
 * @purpose Provides placement help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Spatial placement separates local sketch coordinates from solid face frames. */
export const placementHelp: Record<string, LanguageHelpEntry> = {
  origin: {
    summary:
      'Selects a side of the active XY, XZ, or YZ workplane at the world origin.',
    signatures: [
      '@origin.direction',
      '@origin.direction(x: dx, y: dy)',
      '@origin.direction(radius: r, angle: a)',
      '@origin.direction(r, angle_deg)',
    ],
    parameters: [
      {
        name: 'direction',
        description: 'One of top, bottom, front, back, left, or right.',
      },
      {
        name: 'offset',
        description:
          'Optional Cartesian x/y or polar radius/angle offset measured in the workplane frame.',
      },
    ],
    behavior: [
      'The file-level workplane setting selects the coordinate frame. Work-origin placement is useful when a solid face is not the intended reference.',
    ],
    examples: [
      'workplane = XZ;\nplace(bracket, @origin.top(x: 12, y: -4));\nplace(bracket, @origin.front(20, 45deg));',
    ],
    related: ['place', 'pos', 'workplane'],
  },
  place: {
    summary:
      'Evaluates a component, function, or ref and aligns its source anchor with a target placement.',
    signatures: [
      'place(component);',
      'place(component, @target);',
      'place(component, @target, @source_anchor) rotate(angle);',
    ],
    parameters: [
      {
        name: 'component',
        description:
          'Reusable component/ref, function call, or supported source geometry.',
      },
      {
        name: 'target',
        description:
          'Destination face, point, or named plane. Omit it to place at world origin.',
      },
      {
        name: 'source_anchor',
        description: 'Optional named anchor on the placed component.',
      },
    ],
    behavior: [
      'Generated refs default to their planted side or bottom.center. Appended rotations occur before anchor snapping. Add as instance to retain a name for the placed result.',
    ],
    examples: [
      'ref peg { obj shaft = cylinder(12, d: 4); }\nobj base = cube([30, 20, 4]);\nplace(peg, @base.top.center);',
    ],
    related: ['ref', 'fn', 'rotate', 'anchor', 'as'],
  },
  at: {
    summary: 'Offsets a profile within its two-dimensional sketch plane.',
    signatures: ['profile at (x, y)', 'constraint(...) at offset'],
    parameters: [
      {
        name: 'x, y',
        description:
          'Local sketch offsets in length units, independent of 3D face placement.',
      },
    ],
    behavior: [
      'The suffix applies to the preceding sketch term before composition. Dimension annotations also use at for their display offset. Use @target for three-dimensional operation placement.',
    ],
    examples: ['sketch plate = rect(40, 30) - circle(6) at (10, 0);'],
    related: ['pos', 'as', 'dimension'],
  },
  using: {
    summary:
      'A reserved legacy token; the current parser has no using placement form.',
    signatures: ['place(component, @target, @source_anchor);'],
    behavior: [
      'Specify a named source anchor as the third argument of place. Do not insert using into current placement syntax.',
    ],
    examples: [
      'ref peg { obj body = cylinder(10, d: 4); @mount = @body.bottom.center; }\nplace(peg, @base.top.center, @mount);',
    ],
    related: ['place', 'anchor'],
  },
  anchor: {
    summary:
      "Names a spatial reference or chooses a component's default source anchor.",
    signatures: ['@name = @target;'],
    behavior: [
      'The old anchor: declaration has been removed; use @name = @target. Define @component_name inside that component to select its default placement anchor. Named aliases do not mutate solid geometry.',
    ],
    examples: [
      'ref clip {\n  obj body = cube([20, 8, 3]);\n  @clip = @body.bottom.front_left;\n  @mount = @body.top.center;\n}',
    ],
    related: ['place', 'pos'],
  },
  plane: {
    summary:
      'Declares a named construction plane offset along a reference normal without emitting solid geometry.',
    signatures: [
      'plane name = offset(distance, @reference);',
      '@plane(reference, offset: distance)',
    ],
    parameters: [
      {
        name: 'distance',
        description: 'Signed length measured from the reference plane.',
      },
      { name: 'reference', description: 'A face or an existing named plane.' },
    ],
    behavior: [
      'Named plane declarations are body-local and use comma + @ reference syntax. Named planes can be chained and supplied as operation placements.',
    ],
    examples: [
      'part tiers {\n  obj base = cube([40, 30, 5]);\n  plane above = offset(10, @base.top);\n  obj lid = extrude(rect(40, 30), 3, @above);\n}',
    ],
    related: ['offset', 'workplane', 'pos'],
  },
  pos: {
    summary:
      "Builds a placement offset in a selected face or anchor's coordinate frame.",
    signatures: [
      '@target(x, y)',
      '@target.ref(x, y)',
      '@target(x: dx, y: dy)',
      '@target.center(radius: r, angle: a)',
      '@target(20, 45deg)',
      '@target.edge(offset: d)',
    ],
    parameters: [
      {
        name: 'x, y',
        description:
          'Signed local length offsets. A rectangular top/bottom face starts at back_left; x points right and y points front.',
      },
      {
        name: 'radius, angle',
        description:
          'Polar offset from the chosen origin; angle is in degrees. You can omit the labels when the angle has a deg unit, for example @target(20, 45deg).',
      },
    ],
    behavior: [
      'Select .center explicitly for a center-relative offset. The surface anchor and plane orientation determine the frame; coordinates are not arbitrary world XYZ values.',
    ],
    examples: [
      'obj base = cube([40, 30, 6]);\nobj hole = cut(circle(4), through, @base.top.center(radius: 10, angle: 45deg));',
    ],
    related: ['center', 'plane', 'at'],
  },
  from: {
    summary:
      'Identifies the source module of a named import; some legacy geometry examples used from placement syntax.',
    signatures: [
      "import { name } from './library.bscd';",
      'obj name = extrude(profile, depth, @target);',
    ],
    behavior: [
      'For current extrude/cut and named plane declarations, use their documented comma-separated @ placement rather than depth from target.',
    ],
    examples: [
      "import { bracket } from './library.bscd';\nplace(bracket);",
    ],
    related: ['import', 'extrude', 'cut', 'plane'],
  },
  through: {
    summary:
      'Requests a cut through its target body instead of a fixed blind depth; also describes a fit relation.',
    signatures: [
      'cut(profile, through body, @placement)',
      'cut(profile, through, @body.face)',
      'fit(clearance, name, through, target);',
    ],
    behavior: [
      'Bare through infers the body from the final placement. When no placement context determines a target, supply the body and its face explicitly.',
    ],
    examples: [
      'obj base = cube([40, 30, 6]);\nobj hole = cut(circle(4), through, @base.top.center);',
    ],
    related: ['cut', 'fit'],
  },
  symmetric: {
    summary:
      'Extrudes equally to both sides of the selected sketch plane; in constraints it specifies symmetry about an axis.',
    signatures: [
      'extrude(profile, depth symmetric, @placement?)',
      'constraint(symmetric, first, second, about: axis)',
    ],
    behavior: [
      'The extrusion depth is the total extent, centered on the starting plane. Sketch symmetry is a separate relation between two entities and a symmetry axis.',
    ],
    examples: [
      'sketch plate = rect(20, 10);\nobj plate = extrude(plate, 6 symmetric);',
    ],
    related: ['extrude', 'constraint', 'about'],
  },
  plant: {
    summary:
      'Selects the sketch side used as the default planted edge when placing generated geometry.',
    signatures: [
      'rect(width, height) plant bottom',
      'rect(width, height) at (x, y) plant side',
    ],
    parameters: [
      {
        name: 'side',
        description:
          'One of bottom, right, top, left for a compact rectangle, or a supported named path line.',
      },
    ],
    behavior: [
      'Write the suffix after any at placement. A component can override the default with a source anchor. This marks a placement preference rather than rotating the authored sketch.',
    ],
    examples: [
      'ref tab {\n  sketch body = rect(20, 8) plant bottom;\n  obj body = extrude(body, 3);\n}\nplace(tab);',
    ],
    related: ['rect', 'place', 'anchor'],
  },
};
