/**
 * @author Aidan Boissonneault
 * @file validation-help.ts
 * @purpose Provides validation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const queryHelp: Record<
  string,
  { summary: string; signature: string; behavior: string; condition: string }
> = {
  distance: {
    summary:
      'Queries the minimum separation between two built shapes for an assertion.',
    signature: 'distance(first, second)',
    behavior:
      'Current OCCT evaluation looks up whole shape names and returns a nonnegative distance in millimetres. This name also denotes a sketch constraint; see constraint for driving dimensions.',
    condition: 'distance(first, second) >= 0.3',
  },
  clearance: {
    summary:
      'Queries separation between built shapes, or names a clearance-fit kind.',
    signature: 'clearance(first, second)',
    behavior:
      'The current bridge uses the same unsigned minimum-distance query as distance. It does not yet return negative penetration depth for overlapping solids.',
    condition: 'clearance(first, second) >= 0.3',
  },
  bounding_box: {
    summary: "Queries the volume of a built shape's axis-aligned bounding box.",
    signature: 'bounding_box(body)',
    behavior:
      'Current assertions receive width × height × depth in mm³, not an object with width/height/depth fields. This differs from older reference descriptions.',
    condition: 'bounding_box(body) >= 1000',
  },
  volume: {
    summary: 'Queries the volume of a built solid for post-build validation.',
    signature: 'volume(body)',
    behavior:
      'The OCCT query reports volume in mm³. Use a closed solid; this is a geometry property rather than a render-mesh bounding-box estimate.',
    condition: 'volume(body) >= 1000',
  },
  face_area: {
    summary: 'Queries area using the built-shape surface-property evaluator.',
    signature: 'face_area(body)',
    behavior:
      'The current bridge resolves a face-qualified argument back to its root shape, so this query may measure total shape surface area rather than only the named face. Values are in mm².',
    condition: 'face_area(body) >= 100',
  },
  wall_thickness: {
    summary: 'Estimates minimum wall thickness from separated face pairs.',
    signature: 'wall_thickness(body)',
    behavior:
      'The current bridge uses the minimum positive face-to-face separation above its tolerance. This is an approximation in millimetres, not a complete local thickness analysis.',
    condition: 'wall_thickness(body) >= 1.6',
  },
  draft_angle: {
    summary:
      'A recognized validation-query name whose OCCT measurement is not implemented.',
    signature: 'draft_angle(face)',
    behavior:
      'Do not rely on this query to validate draft angles; the current OCCT handler has no measurement implementation. Use explicit design parameters until implemented.',
    condition: '2deg >= 1deg',
  },
  fillet_radius: {
    summary:
      'A recognized validation-query name whose OCCT measurement is not implemented.',
    signature: 'fillet_radius(edges)',
    behavior:
      'Do not treat this as a measured blend radius. Assert the authored radius parameter until a geometry measurement handler is available.',
    condition: '1 <= 2',
  },
};

/** Validation help reports current measurement limits rather than promising unavailable checks. */
export const validationHelp: Record<string, LanguageHelpEntry> = {
  ...Object.fromEntries(
    Object.entries(queryHelp).map(([name, query]) => [
      name,
      {
        summary: query.summary,
        signatures: [query.signature],
        behavior: [
          query.behavior,
          'Geometry queries are intended for post-build assertions, not arbitrary pre-build variable expressions.',
        ],
        examples: [
          `obj body = cube([20, 10, 8]);\n// first and second below denote existing built shape names when required.\nassert(${query.condition});`,
        ],
        related: ['assert', 'warning', 'fit_ok'],
      },
    ]),
  ),
  assert: {
    summary:
      'Checks design intent and reports an error or warning when the condition fails.',
    signatures: [
      'assert(condition);',
      "assert(condition, warning: 'message');",
      "assert(condition, severity: error, message: 'message');",
    ],
    parameters: [
      {
        name: 'condition',
        description:
          'Boolean/comparison expression; supported geometry queries are evaluated after the build.',
      },
      {
        name: 'severity',
        description:
          'Defaults to error; warning reports a problem while allowing the build to succeed.',
      },
      {
        name: 'message',
        description: 'Optional explanation shown with the source span.',
      },
    ],
    behavior: [
      'An error-level failure causes the build to report failure; the editor can retain its last good preview. Queries have implementation-specific measurement limits documented separately.',
    ],
    examples: [
      "var wall = 2;\nassert(wall >= 1.6, warning: 'Wall is below the design target');",
    ],
    related: ['warning', 'volume', 'wall_thickness'],
  },
  warning: {
    summary:
      'Changes an assertion failure into a diagnostic that permits the build to succeed.',
    signatures: ["assert(condition, warning: 'message');"],
    behavior: [
      'The warning message explains the design concern and is attributed to the assertion source. Without a warning severity, a failed assertion is an error.',
    ],
    examples: [
      "var gap = 0.2;\nassert(gap >= 0.3, warning: 'Increase the assembly gap');",
    ],
    related: ['assert'],
  },
};
