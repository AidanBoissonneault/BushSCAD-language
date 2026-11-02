/**
 * @author Aidan Boissonneault
 * @file sketch-geometric-constraint-help.ts
 * @purpose Provides sketch geometric constraint help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';
import { constraintExample } from './sketch-constraint-examples.js';

export const sketchGeometricConstraintHelp: Record<string, LanguageHelpEntry> =
  {
    about: {
      summary:
        'Legacy symmetry-axis connective retained in editor vocabulary; current constraint syntax supplies the reference as a call argument.',
      signatures: ['constraint(segment, symmetric, axis_segment)'],
      behavior: [
        'about is not consumed by the current parser. Use the symmetric constraint call instead of an about clause.',
        'The current symmetric equation places the target segment midpoint on the reference axis; it does not enforce mirrored endpoint orientation.',
      ],
      examples: [
        constraintExample(
          'construction centerline = line((20, 0), (20, 20))',
          'constraint(bottom, symmetric, centerline)',
        ),
      ],
      related: ['symmetric', 'constraint', 'construction'],
    },
    horizontal: {
      summary:
        'Constrains a line to run horizontally, or keeps two points at the same Y coordinate.',
      signatures: [
        'constraint(segment, horizontal)',
        'constraint(point, horizontal, other_point)',
      ],
      behavior: [
        'The point form retains an alignment relationship when either point moves; it does not freeze their X coordinates.',
      ],
      examples: [
        constraintExample(
          'constraint(bottom, horizontal)',
          'constraint(bottom.start, horizontal, bottom.end)',
        ),
      ],
      related: ['vertical', 'constraint', 'parallel'],
    },
    vertical: {
      summary:
        'Constrains a line to run vertically, or keeps two points at the same X coordinate.',
      signatures: [
        'constraint(segment, vertical)',
        'constraint(point, vertical, other_point)',
      ],
      behavior: [
        'The point form retains an alignment relationship when either point moves; it does not freeze their Y coordinates.',
      ],
      examples: [
        constraintExample(
          'constraint(right, vertical)',
          'constraint(right.start, vertical, right.end)',
        ),
      ],
      related: ['horizontal', 'constraint', 'perpendicular'],
    },
    parallel: {
      summary:
        'Keeps two line segments parallel as the sketch solver changes their positions or sizes.',
      signatures: ['constraint(segment, parallel, other_segment)'],
      behavior: [
        'Parallelism constrains orientation; it does not by itself enforce equal length or a particular separation.',
      ],
      examples: [constraintExample('constraint(bottom, parallel, top)')],
      related: ['perpendicular', 'horizontal', 'equal', 'constraint'],
    },
    perpendicular: {
      summary: 'Keeps two line segments at a right angle.',
      signatures: ['constraint(segment, perpendicular, other_segment)'],
      behavior: [
        'The lines do not need coincident endpoints to have a perpendicular orientation relation.',
      ],
      examples: [constraintExample('constraint(right, perpendicular, bottom)')],
      related: ['parallel', 'angle', 'constraint'],
    },
    tangent: {
      summary:
        'Constrains a line to be tangent to the circle underlying a named sketch arc.',
      signatures: ['constraint(segment, tangent, arc_or_line)'],
      behavior: [
        'The implemented equation keeps the distance from the arc center to the line equal to the arc radius. Use named line and arc targets in either order.',
        'Tangency takes no numeric driving value and does not enforce endpoint coincidence. General arc-to-arc tangency is not implemented.',
      ],
      examples: [
        'sketch rounded = path(\n  base = line((0, 0), (20, 0)),\n  corner = arc((25, 5), 5, ccw),\n  constraint(base, tangent, corner)\n);',
      ],
      related: ['arc', 'line', 'constraint', 'coincident'],
    },
    equal: {
      summary:
        'Makes two sketch segments have equal endpoint-to-endpoint lengths.',
      signatures: ['constraint(segment, equal, other_segment)'],
      behavior: [
        'For lines this is their length. The current equation compares endpoint vectors, so an arc target contributes its chord length, not its radius or curved length.',
        'Equality does not make segment positions or orientations identical.',
      ],
      examples: [constraintExample('constraint(bottom, equal, top)')],
      related: ['constraint', 'length', 'radius'],
    },
    coincident: {
      summary:
        'Keeps two named sketch points or endpoints at the same position.',
      signatures: ['constraint(segment.end, coincident, other_segment.start)'],
      behavior: [
        'Cursor-continuous path segments already share solver points. Use an explicit relation when separately authored endpoints should stay joined.',
      ],
      examples: [
        'sketch joined = path(\n  first = line((0, 0), (20, 0)),\n  second = line((20, 0), (20, 10)),\n  constraint(first.end, coincident, second.start)\n);',
      ],
      related: ['midpoint', 'horizontal', 'vertical', 'constraint'],
    },
    midpoint: {
      summary:
        'Constrains a named point or segment endpoint to the midpoint of a referenced line segment.',
      signatures: [
        'constraint(point, midpoint, segment)',
        'constraint(segment.end, midpoint, other_segment)',
      ],
      parameters: [
        {
          name: 'target, reference',
          description:
            'The first target is a point or endpoint; the second is the segment whose midpoint it should follow.',
        },
      ],
      behavior: [
        'The relationship follows later resizing and movement of the reference segment.',
      ],
      examples: [
        'sketch plate = path(\n  bottom = line((0, 0), (40, 0)), right = line(40, 20),\n  top = line(0, 20), left = close(),\n  construction centerline = line((20, 0), (20, 20)),\n  constraint(centerline.start, midpoint, bottom),\n  constraint(centerline.end, midpoint, top)\n);',
      ],
      related: ['constraint', 'construction', 'coincident'],
    },
    fixed: {
      summary:
        'Locks a point or curve to its authored geometry during sketch solving.',
      signatures: ['constraint(point, fixed)', 'constraint(segment, fixed)'],
      behavior: [
        'Fixing a point locks its coordinates. Fixing a segment fixes both endpoints and, for an arc, its radius, locking both size and position.',
        'Use a fixed point to establish a sketch reference while allowing other geometry to remain driven by dimensions.',
      ],
      examples: [constraintExample('constraint(bottom.start, fixed)')],
      related: ['constraint', 'point', 'dimension'],
    },
  };
