/**
 * @author Aidan Boissonneault
 * @file sketch-path-help.ts
 * @purpose Provides sketch path help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Provides a complete two-loop sketch so body-selection examples are directly usable. */
function bodyExample(entry: string): string {
  return `sketch plate = path(
  outer_bottom = line((0, 0), (80, 0)),
  outer_right = line(80, 40), outer_top = line(0, 40), outer_left = close(),
  hole_bottom = line((25, 10), (55, 10)),
  hole_right = line(55, 30), hole_top = line(25, 30), hole_left = close(),
  ${entry}
);`;
}

export const sketchPathHelp: Record<string, LanguageHelpEntry> = {
  path: {
    summary:
      'Builds a custom 2D sketch from named curves and constraints, or declares a separate 3D guide for sweep operations.',
    signatures: [
      'sketch name = path(entries...)',
      'path name = polyline([(x, y, z), ...]);',
      'path name = spline([(x, y, z), ...]);',
    ],
    parameters: [
      {
        name: 'entries',
        description:
          '2D line/arc/close segments, compact rect/circle/ellipse members, construction geometry, origin metadata, body expressions, constraints, and reference dimensions.',
      },
    ],
    behavior: [
      'The first segment of a 2D path establishes start and end points; later segments may infer their start from the cursor.',
      'Named segments survive supported solid operations as @object.segment.edges or @object.segment.center. plant requires a named element.',
      'Multiple closed loops are supported. Whole-sketch operations use every detected body not excluded with ignore or ignoreClosed.',
      'Explicitly close an open 2D outline before extrude, cut, revolve, or loft. Construction geometry does not form solid boundaries.',
      'The separate path declaration accepts polyline and spline with 3D tuples. It does not accept the 2D path-local arc(...) constructor.',
    ],
    examples: [
      'sketch plate = path(\n  plant bottom = line((0, 0), (20, 0)),\n  right = line(20, 10), top = line(0, 10), left = close()\n);\nobj body = extrude(plate, 4);',
    ],
    related: [
      'line',
      'arc',
      'close',
      'loop',
      'constraint',
      'polyline',
      'spline',
    ],
  },
  line: {
    summary:
      'Adds one or more straight segments to a 2D path, with explicit endpoints or a cursor-inferred start.',
    signatures: [
      'name = line((x1, y1), (x2, y2))',
      'name = line(x, y)',
      'name = line((x, y))',
      'line([(x, y), ...])',
    ],
    parameters: [
      {
        name: 'points',
        description:
          'Two displayed endpoints must both use tuple syntax. A single endpoint may be a tuple or two scalar coordinates.',
      },
    ],
    behavior: [
      'The first segment needs explicit start and end points. Later one-endpoint calls continue from the previous segment.',
      'A list repeats cursor-inferred line segments in order. A named list uses the name for its first segment and suffixes _1, _2, etc. for later segments.',
      'Name a segment to reference its .start and .end in constraints or its generated topology after solid construction.',
    ],
    examples: [
      'sketch outline = path(\n  base = line((0, 0), (20, 0)),\n  line([(20, 10), (0, 10)]), close()\n);',
    ],
    related: ['path', 'arc', 'close', 'construction'],
  },
  arc: {
    summary:
      'Adds a circular radius arc to a 2D path, choosing clockwise or counterclockwise travel between endpoints.',
    signatures: [
      'name = arc((x, y), radius, cw|ccw)',
      'name = arc(x, y, radius: value, ccw)',
      'name = arc((x1, y1), (x2, y2), radius, cw|ccw)',
    ],
    parameters: [
      {
        name: 'endpoint(s)',
        description:
          'One endpoint continues from the path cursor; two endpoint tuples establish an explicit start and end.',
      },
      {
        name: 'radius',
        description:
          'Circle radius as a length, supplied positionally or with radius:.',
      },
      {
        name: 'cw / ccw',
        description:
          'Required travel direction. The aliases clockwise and counterclockwise are accepted.',
      },
    ],
    behavior: [
      'A named arc exposes endpoints and radius/diameter constraints. Close the complete outline before using it for solid operations.',
      'The separate 3D path declaration currently accepts polyline or spline, not arc(from: ..., to: ..., radius: ...).',
    ],
    examples: [
      'sketch cap = path(\n  base = line((0, 0), (20, 0)),\n  rim = arc((0, 0), 10, ccw)\n);',
    ],
    related: ['line', 'path', 'radius', 'tangent', 'cw', 'ccw'],
  },
  close: {
    summary:
      'Adds the closing edge from the current 2D path cursor back to the loop start.',
    signatures: ['close()', 'name = close()'],
    behavior: [
      'Takes no arguments. Naming the closing edge makes it available to constraints and body selection.',
      'Closing the outline is necessary for operations requiring a filled profile; an open path cannot silently become a solid.',
    ],
    examples: [
      'sketch triangle_outline = path(\n  base = line((0, 0), (20, 0)), side = line(10, 15), return_edge = close()\n);',
    ],
    related: ['path', 'line', 'loop'],
  },
  loop: {
    summary:
      'Selects regions of the closed path loop containing a named path feature, for stable body algebra and selected-body extrusion or cutting.',
    signatures: ['body = loop(feature)', 'body = outer_feature - hole_feature'],
    parameters: [
      {
        name: 'feature',
        description: 'A named line, arc, or closing edge in the same path.',
      },
    ],
    behavior: [
      'A feature name used directly selects the same regions as loop(feature). Earlier body aliases can be reused.',
      'Body algebra: `+` unions, `-` subtracts, and `&` intersects regions. & binds more tightly; equal-precedence operators associate left to right.',
      'Selected bodies work with normal extrude and cut. Wrapped, revolve, loft, sweep, and radial operations report diagnostics for selected bodies.',
      'Same-sketch body lists are set unions, so overlapping or repeated selected regions contribute only once.',
    ],
    examples: [
      bodyExample(
        'outer = loop(outer_bottom), hole = loop(hole_bottom), shell = outer - hole',
      ) + '\nobj wall = extrude(plate.shell, 5);',
    ],
    related: ['path', 'ignore', 'closed', 'extrude', 'cut'],
  },
  ignore: {
    summary:
      'Excludes selected path regions from whole-sketch operations while retaining their authored edges for editing and constraints.',
    signatures: ['ignore(body_expression)', 'ignore(loop(feature))'],
    parameters: [
      {
        name: 'body_expression',
        description:
          'Feature names, loop(feature), earlier body aliases, or expressions using +, -, and &.',
      },
    ],
    behavior: [
      'Body aliases must be declared before an ignore expression uses them.',
      'This changes which regions whole-sketch operations consume; it does not delete the source curves.',
    ],
    examples: [bodyExample('hole = loop(hole_bottom), ignore(hole)')],
    related: ['loop', 'ignoreClosed', 'path'],
  },
  closed: {
    summary:
      'Names the closed path body containing a 2D sample point; a positional fallback when useful feature names are unavailable.',
    signatures: ['body = closed(x, y)', 'body = closed((x, y))'],
    parameters: [
      {
        name: 'x, y',
        description: 'Coordinates of a point inside the body to select.',
      },
    ],
    behavior: [
      'Use loop(feature) or a direct named feature for selections that should survive changes in coordinates.',
    ],
    examples: [bodyExample('hole = closed(40, 20)')],
    related: ['loop', 'ignoreClosed'],
  },
  ignoreClosed: {
    summary:
      'Excludes the closed body containing a sample point from whole-sketch operations.',
    signatures: ['ignoreClosed(x, y)', 'ignoreClosed((x, y))'],
    parameters: [
      { name: 'x, y', description: 'A point inside the region to exclude.' },
    ],
    behavior: [
      'This is the legacy positional fallback; ignore(named_body) or ignore(loop(feature)) expresses selection through stable authored features.',
    ],
    examples: [bodyExample('ignoreClosed(40, 20)')],
    related: ['ignore', 'closed', 'loop'],
  },
  construction: {
    summary:
      'Marks sketch curves as guides that participate in preview and constraints but are excluded from the solid profile wire.',
    signatures: [
      'construction name = line((x1, y1), (x2, y2))',
      'construction ellipse(width, height)',
      'construction(sketch_profile)',
    ],
    behavior: [
      'Inside path(...), the qualifier supports line/arc segments and compact rect/circle/ellipse members.',
      'Use construction curves for centerlines, radius scaffolds, and constrained references without adding material boundaries.',
    ],
    examples: [
      'sketch plate = path(\n  rect(80, 40),\n  construction centerline = line((-40, 0), (40, 0))\n);',
    ],
    related: ['path', 'constraint', 'dimension'],
  },
  polyline: {
    summary:
      'Declares a 3D guide from an ordered list of points for sweep operations.',
    signatures: ['path name = polyline([(x, y, z), ...]);'],
    parameters: [
      {
        name: 'points',
        description:
          'An inline list of three-coordinate tuples; use at least two points.',
      },
    ],
    behavior: [
      'This is a 3D path primitive, distinct from the 2D line(...) sketch constructor.',
      'The OCCT sweep implementation uses a straight edge for two points and interpolates a B-spline through longer guides; sharp authored polyline corners are not preserved by that sweep implementation.',
    ],
    examples: [
      'path rail = polyline([(0, 0, 0), (0, 0, 30)]);\nsketch section = circle(3);\nobj rod = sweep(section along rail);',
    ],
    related: ['path', 'spline', 'sweep'],
  },
  spline: {
    summary:
      'Creates a 3D interpolated sweep guide, or a limited exact 2D sketch segment depending on declaration context.',
    signatures: [
      'path name = spline([(x, y, z), ...]);',
      'sketch name = spline([(x1, y1), (x2, y2)]);',
    ],
    parameters: [
      {
        name: 'points',
        description:
          '3D tuples in a path declaration; 2D tuples in a sketch expression.',
      },
    ],
    behavior: [
      '3D guides are interpolated through the supplied points by the OCCT sweep implementation.',
      'Exact sketch support currently requires exactly two points and lowers to a straight line profile. Multi-point 2D splines report a diagnostic.',
      'The two-point sketch is open and cannot be used directly as a filled solid profile.',
    ],
    examples: [
      'path handle_path = spline([(0, 0, 0), (20, 0, 10), (40, 0, 0)]);',
      'sketch guide_line = spline([(0, 0), (20, 0)]);',
    ],
    related: ['polyline', 'path', 'sweep', 'line'],
  },
};
