/**
 * @author Aidan Boissonneault
 * @file sketch-constraint-help.ts
 * @purpose Provides sketch constraint help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

import { constraintExample } from './sketch-constraint-examples.js';
import { sketchGeometricConstraintHelp } from './sketch-geometric-constraint-help.js';

export const sketchConstraintHelp: Record<string, LanguageHelpEntry> = {
  constraint: {
    summary:
      'Adds a geometric relation or a driving dimension that the sketch solver uses to update geometry.',
    signatures: [
      'constraint(target, relation[, reference])',
      'constraint(segment, length|angle|radius|diameter, value[, (label_x, label_y)])',
      'constraint(point, distance, reference, value, axis: x|y, at: (label_x, label_y))',
    ],
    parameters: [
      {
        name: 'target',
        description:
          'A named point, segment, or segment endpoint (.start or .end).',
      },
      {
        name: 'relation',
        description:
          'horizontal, vertical, parallel, perpendicular, tangent, equal, symmetric, fixed, coincident, midpoint, length, distance, angle, radius, or diameter.',
      },
      {
        name: 'reference',
        description:
          'A second segment/point, origin, origin.x_axis, or origin.y_axis where the relation permits it.',
      },
      {
        name: 'value',
        description:
          'Driving numeric expression for a dimensional constraint; supports variables, units, arithmetic, and named sketch measurements.',
      },
      {
        name: 'label',
        description:
          'Optional display position as a final tuple; the older at: (x, y) form is also accepted.',
      },
    ],
    behavior: [
      'Unary horizontal/vertical orient a line; binary forms align two points. Distance constraints accept axis: x or axis: y for component measurements.',
      'Append as name to a dimensional constraint to expose a sketch-local live measurement. Names are unique, cannot shadow visible values, and may refer to other named dimensions independent of declaration order.',
      'Cycles, unsupported local-dimension expressions, and division by zero report diagnostics.',
      'Use dimension for a display-only reference measurement that never enters the solver.',
    ],
    examples: [
      constraintExample(
        'constraint(bottom.start, fixed)',
        'constraint(bottom, horizontal)',
        'constraint(right, length, 20, (48, 10)) as wall_height',
      ),
    ],
    related: ['dimension', 'distance', 'angle', 'horizontal', 'fixed'],
  },
  dimension: {
    summary:
      'Adds a display-only reference measurement to a sketch without directly constraining geometry.',
    signatures: [
      'dimension segment.length at (x, y)',
      'dimension point.distance to reference axis: x|y at (x, y)',
      'dimension segment.angle to reference at (x, y)',
      'dimension segment.radius at (x, y) as name',
    ],
    parameters: [
      {
        name: 'property',
        description:
          'length, distance, angle, radius, or diameter, according to the target geometry.',
      },
      {
        name: 'to reference',
        description:
          'Second endpoint/point, segment, origin, or a global origin axis for relative measurements.',
      },
      {
        name: 'axis',
        description:
          'Optional x or y component for point distances; omit it for aligned Euclidean distance.',
      },
      {
        name: 'at (x, y)',
        description:
          'Required reference-dimension label position in sketch coordinates.',
      },
    ],
    behavior: [
      'Reference dimensions never enter the constraint solver on their own.',
      'A trailing as name exposes the live measurement for other driving expressions. Names are sketch-local, unique, and may not shadow visible value bindings.',
      'Origin axes are fixed global axes, independent of a path origin(...) placement anchor.',
    ],
    examples: [
      constraintExample(
        'dimension top.length at (20, 28) as measured_top',
        'dimension bottom.start.distance to right.end axis: x at (20, -8)',
      ),
    ],
    related: ['constraint', 'distance', 'angle', 'radius', 'diameter'],
  },
  _: {
    summary:
      'Defers a compact primitive size until a following driving dimension assignment supplies it.',
    signatures: [
      'sketch name = rect(_, height); @name.bottom = width;',
      'sketch name = circle(_); @name.diameter = value;',
      'sketch name = ellipse(_, height); @name.width = value;',
    ],
    behavior: [
      '_ is valid only in a primitive scalar argument slot; it is not a general expression, variable, path coordinate, or assignment value.',
      'Every placeholder needs exactly one matching assignment. Rectangle bottom/top drive width and left/right drive height; renamed sides use their alias.',
      'A circle diameter placeholder needs a diameter assignment. To retain a radius driver, write an explicit circle(2 * radius) expression and assign @sketch.radius.',
      'Assignment values are ordinary expressions and may use variables, units, and arithmetic.',
    ],
    examples: [
      'var plate_width = 60;\nsketch plate = rect(_, 40, bottom: mount_edge);\n@plate.mount_edge = plate_width;',
    ],
    related: ['rect', 'circle', 'ellipse', 'constraint'],
  },
  ...sketchGeometricConstraintHelp,
  distance: {
    summary:
      'Drives or measures the separation between sketch points, or the orthogonal distance from a point to a global axis.',
    signatures: [
      'constraint(point, distance, reference, value)',
      'constraint(point, distance, other_point, value, axis: x|y)',
      'dimension point.distance to reference at (x, y)',
    ],
    parameters: [
      {
        name: 'reference',
        description:
          'A second point/endpoint, fixed origin, origin.x_axis, or origin.y_axis.',
      },
      {
        name: 'axis',
        description:
          'For two-point distances, x measures abs(dx), y measures abs(dy), and omission measures Euclidean distance.',
      },
    ],
    behavior: [
      "Driving component distances preserve the points' authored side of each other.",
      'origin.x_axis measures signed orthogonal distance to y = 0; origin.y_axis measures it to x = 0. Displayed values remain positive.',
      'The global origin is (0, 0), independent of path origin(...) placement metadata.',
    ],
    examples: [
      constraintExample(
        'constraint(bottom.start, distance, right.end, 40, axis: x, at: (20, -8))',
      ),
    ],
    related: ['constraint', 'dimension', 'origin', 'angle'],
  },
  angle: {
    summary:
      'Drives or measures line orientation, either absolutely or relative to another line or fixed origin axis.',
    signatures: [
      'constraint(segment, angle, value)',
      'constraint(segment, angle, reference_segment, value)',
      'constraint(segment, angle, origin.x_axis, value)',
      'dimension segment.angle to reference at (x, y)',
    ],
    parameters: [
      {
        name: 'value',
        description:
          'An angle expression; use deg or rad explicitly to communicate units.',
      },
      {
        name: 'reference',
        description:
          'A named line, origin.x_axis, or origin.y_axis for a relative angle.',
      },
    ],
    behavior: [
      'A trailing label tuple positions a driving dimension annotation; dimension declarations use a required at (x, y) label.',
      'The angle: keyword also occurs in placement and operation calls; those calls document their own angle meaning.',
    ],
    examples: [
      constraintExample('constraint(right, angle, origin.x_axis, 90deg)'),
    ],
    related: ['constraint', 'dimension', 'perpendicular', 'origin'],
  },
  radius: {
    summary:
      'Sizes a sketch arc by its circle radius, or retains a compact circle radius dimension.',
    signatures: [
      'constraint(arc_segment, radius, value)',
      'dimension arc_segment.radius at (x, y)',
      '@sketch.radius = value;',
    ],
    parameters: [
      {
        name: 'value',
        description: 'Radius as a length, half the corresponding diameter.',
      },
    ],
    behavior: [
      'For a compact circle radius driver, retain an explicit circle(2 * value) diameter expression. A radius assignment does not fill circle(_).',
      'radius: also supplies the radius of path-local arc(...) calls; primitive-specific radius keywords follow their own signatures.',
    ],
    examples: [
      'var pin_radius = 4;\nsketch pin = circle(2 * pin_radius);\n@pin.radius = pin_radius;',
    ],
    related: ['diameter', 'arc', 'circle', 'constraint'],
  },
  diameter: {
    summary:
      'Sizes a circular sketch or arc by its full diameter and supports compact circle driving assignments.',
    signatures: [
      'constraint(arc_segment, diameter, value)',
      'dimension arc_segment.diameter at (x, y)',
      '@sketch.diameter = value;',
    ],
    parameters: [
      {
        name: 'value',
        description:
          'Full diameter as a length, twice the corresponding radius.',
      },
    ],
    behavior: [
      'A following @sketch.diameter assignment supplies a deferred circle(_) argument and preserves its displayed driving dimension.',
    ],
    examples: ['sketch hole = circle(_);\n@hole.diameter = 12;'],
    related: ['circle', 'radius', '_', 'constraint'],
  },
};
