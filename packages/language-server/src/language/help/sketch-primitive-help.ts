/**
 * @author Aidan Boissonneault
 * @file sketch-primitive-help.ts
 * @purpose Provides sketch primitive help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const sketchPrimitiveHelp: Record<string, LanguageHelpEntry> = {
  rect: {
    summary:
      'Creates a rectangular sketch in 2D, with optional rounded corners, named sides, and a placement origin.',
    signatures: [
      'rect(width, height, radius?)',
      'rect(width: value, height: value, r: value, origin: corner)',
      'rect(width, height, bottom: identifier, left: identifier) plant bottom',
    ],
    parameters: [
      {
        name: 'width, height',
        description:
          'Full horizontal and vertical dimensions; numeric lengths default to millimetres.',
      },
      {
        name: 'radius / r / cornerRadius',
        description:
          'Optional corner radius; omitting it creates sharp corners.',
      },
      {
        name: 'bottom, right, top, left',
        description:
          'Optional side names supplied as bare identifiers. Effective names must be unique.',
      },
      {
        name: 'origin',
        description:
          'center by default; corner anchors from the top-left of evaluated 2D bounds. A final bare corner is also accepted.',
      },
    ],
    behavior: [
      'The 2D bottom/top sides are minimum-Y/maximum-Y boundaries, distinct from the bottom/top cap faces of an extruded object.',
      'Append plant bottom|right|top|left after the rectangle and any at (...) placement. The plant selector stays canonical even when its side is renamed.',
      'Append as name to preserve component sides under @body.name.top, @body.name.bottom, @body.name.left, and @body.name.right.',
      'Deferred width/height arguments use _: a following @sketch.bottom or @sketch.top assignment supplies width; @sketch.left or @sketch.right supplies height. Renamed sides use their alias.',
    ],
    examples: [
      'sketch bracket = rect(60, 40, bottom: mount_edge) plant bottom;\nobj body = extrude(bracket, 5);\nfillet(@body.mount_edge.edges, 1);',
      'var width = 60;\nsketch plate = rect(_, 40);\n@plate.bottom = width;',
    ],
    related: ['sketch', 'roundrect', 'plant', 'as', '_'],
  },
  circle: {
    summary:
      'Creates a circular 2D profile from its full diameter, for holes, bosses, rings, and revolve sections.',
    signatures: [
      'circle(diameter)',
      'circle(d: value, origin: corner)',
      'circle(diameter, @body.top)',
    ],
    parameters: [
      {
        name: 'diameter / d',
        description:
          'Full circle diameter, not radius; use 2 * radius when sizing from a radius.',
      },
      {
        name: 'origin',
        description:
          'center by default; corner or a final bare corner anchors at the top-left of the bounds.',
      },
    ],
    behavior: [
      'circle(_) is supplied by a following @sketch.diameter = value assignment.',
      'Retain a radius driver with @sketch.radius = value and an explicit diameter expression such as circle(2 * value). A radius assignment does not supply a deferred diameter slot.',
      'A circle is a reusable sketch; extrude or cut creates the corresponding solid geometry.',
    ],
    examples: [
      'sketch hole = circle(_);\n@hole.diameter = 12;',
      'var pin_radius = 3;\nsketch pin = circle(2 * pin_radius);\n@pin.radius = pin_radius;',
    ],
    related: ['ellipse', 'diameter', 'radius', 'extrude', 'cut'],
  },
  ellipse: {
    summary:
      'Creates an exact axis-aligned elliptical sketch from its full width and height.',
    signatures: ['ellipse(width, height)', 'ellipse(width, height) at (x, y)'],
    parameters: [
      {
        name: 'width, height',
        description:
          'Positive full dimensions, not semiaxis radii. Arguments are positional.',
      },
    ],
    behavior: [
      'Equal dimensions canonicalize to a circle; unequal dimensions remain exact ellipse curves through preview, Boolean regions, extrusion, and export.',
      'Use _ with following @sketch.width and @sketch.height assignments to drive compact ellipse dimensions.',
      'Can appear inside path(...), including as construction ellipse(...).',
    ],
    examples: ['sketch seal = ellipse(_, 20) at (8, 0);\n@seal.width = 40;'],
    related: ['circle', 'path', 'construction', '_'],
  },
  roundrect: {
    summary:
      'Creates a rounded rectangle from width, height, and a required corner radius; suitable for slots and pads.',
    signatures: [
      'roundrect(width, height, radius)',
      'roundrect(width: value, height: value, r: value, origin: corner)',
    ],
    parameters: [
      {
        name: 'width, height',
        description: 'Full outer dimensions of the rounded rectangle.',
      },
      {
        name: 'radius / r',
        description:
          'Corner radius. A radius equal to half the smaller dimension produces a stadium-like slot.',
      },
      {
        name: 'origin',
        description: 'center by default; corner anchors from top-left bounds.',
      },
    ],
    examples: [
      'sketch slot = roundrect(20, 8, r: 4);\nobj pad = extrude(slot, 3);',
    ],
    related: ['rect', 'offset', 'extrude'],
  },
  triangle: {
    summary:
      'Creates an isosceles triangular 2D profile from base width and height.',
    signatures: [
      'triangle(base, height)',
      'triangle(base: value, height: value, origin: corner)',
    ],
    parameters: [
      { name: 'base', description: 'Full width of the base edge.' },
      {
        name: 'height',
        description: 'Perpendicular distance from the base to the apex.',
      },
      {
        name: 'origin',
        description:
          'center by default; corner or a final bare corner changes the anchor to top-left bounds.',
      },
    ],
    behavior: [
      'Use polygon(...) for triangles with arbitrary vertex positions.',
    ],
    examples: [
      'sketch gusset = triangle(30, 20);\nobj rib = extrude(gusset, 4);',
    ],
    related: ['polygon', 'wrap', 'extrude'],
  },
  polygon: {
    summary:
      'Creates a closed straight-sided sketch from 2D vertex tuples in authored order.',
    signatures: [
      'polygon([(x1, y1), (x2, y2), (x3, y3), ...])',
      'polygon(points, origin: corner)',
    ],
    parameters: [
      {
        name: 'points',
        description:
          'An inline list of (x, y) tuples defining the boundary vertices.',
      },
      {
        name: 'origin',
        description:
          'center by default; corner anchors from the top-left of evaluated bounds.',
      },
    ],
    behavior: [
      'Use path(...) when individual boundary names or constraints matter; use wrap(...) for hull, concavity, and smoothing options.',
    ],
    examples: ['sketch outline = polygon([(0, 0), (30, 0), (15, 26)]);'],
    related: ['triangle', 'path', 'wrap'],
  },
  word: {
    summary:
      'Creates a 2D text outline that can be extruded for embossing or cut for engraving.',
    signatures: [
      'word(text, size?, font?, align?, origin?)',
      "word(text, 8, 'sans', center)",
      "word(text, size: 8, font: 'sans', align: center)",
    ],
    parameters: [
      {
        name: 'text',
        description:
          'A string expression, including a string variable or environment value.',
      },
      { name: 'size', description: 'Text size as a length; defaults to 8.' },
      {
        name: 'font',
        description:
          'CSS-style font-family string. VS Code resolves workspace fonts before installed system fonts; sans, serif, and mono use bundled outlines.',
      },
      {
        name: 'align',
        description:
          'center (default), left, or right relative to the sketch anchor.',
      },
    ],
    behavior: [
      'Comma-separated family stacks are tried in order. Explicit imported font assets remain deterministic across machines.',
      'Argument labels are optional. Positional options follow size, font, alignment, then origin; center, left, right, and corner can be written as contextual words.',
      'The profile follows the normal of its placement face.',
    ],
    examples: [
      "sketch label = word('FRONT', size: 8, font: 'sans', align: center);\nobj badge = extrude(label, 1.2);",
    ],
    related: ['sketch', 'extrude', 'cut'],
  },
  inset: {
    summary:
      'Derives a smaller rectangular sketch from the current parent sketching context.',
    signatures: [
      'rect inset(amount)',
      'rect inset(x, y)',
      'rect inset(top: value, sides: value, bottom: value)',
    ],
    parameters: [
      {
        name: 'amount',
        description:
          'Margin removed from every side; width and height each shrink by twice this amount.',
      },
      {
        name: 'x, y',
        description: 'Separate horizontal and vertical margins.',
      },
      {
        name: 'top, sides, bottom',
        description: 'Explicit upper, left/right, and lower margins.',
      },
    ],
    behavior: [
      'Requires a parent sketching context; using inset without one reports a diagnostic.',
      'The resulting width and height must both remain positive.',
    ],
    examples: [
      'sketch footprint = rect(60, 40);\nobj body = extrude(footprint, 6);\nsketch lid = rect inset(5, @body.top);\nobj raised = extrude(lid, 2);',
    ],
    related: ['rect', 'on', 'this', 'offset'],
  },
  offset: {
    summary:
      'Expands or shrinks a supported 2D primitive by a uniform signed distance.',
    signatures: ['offset(sketch, distance)'],
    parameters: [
      {
        name: 'sketch',
        description:
          'An exact rect, circle, or roundrect primitive (or reference evaluating to one).',
      },
      {
        name: 'distance',
        description:
          'Positive expands; negative shrinks. Full width/height or diameter changes by twice this value.',
      },
    ],
    behavior: [
      'For roundrect, the corner radius also changes by distance.',
      'Other sketch inputs report an exact-support diagnostic; arbitrary path offsets are not implemented.',
      'The offset: keyword on plane(...) or spatial references instead adjusts placement and does not resize a sketch.',
    ],
    examples: [
      'sketch padded = offset(rect(40, 20), 2);\nsketch larger_hole = offset(circle(8), 1);',
    ],
    related: ['inset', 'rect', 'circle', 'roundrect', 'plane'],
  },
};
