/**
 * @author Aidan Boissonneault
 * @file reference-help.ts
 * @purpose Provides reference help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const faceDescriptions: Record<string, string> = {
  top: "The positive-extrusion cap in the object's local frame.",
  bottom: "The starting/negative-extrusion cap in the object's local frame.",
  front: "The front-facing lateral face in the object's semantic frame.",
  back: "The back-facing lateral face in the object's semantic frame.",
  left: "The left-facing lateral face in the object's semantic frame.",
  right: "The right-facing lateral face in the object's semantic frame.",
  sides: 'The collection of lateral faces, excluding top and bottom caps.',
  inner: 'The inner topology qualifier, such as a cavity or hole wall.',
  outer: 'The exterior topology qualifier, excluding inner cavity walls.',
  curved:
    'The curved side surface where the generating operation provides this label.',
  base: 'The base face label supplied by the generating primitive or imported-shape adapter.',
  largest_planar:
    'The largest planar face label used when adapting imported geometry.',
  smallest_planar:
    'The smallest planar face label used when adapting imported geometry.',
  cylindrical: 'Cylindrical faces identified in imported-shape topology.',
};

const faceHelp = Object.fromEntries(
  Object.entries(faceDescriptions).map(([name, meaning]) => [
    name,
    {
      summary: `${meaning} Use it to select topology without relying on mesh triangle indices.`,
      signatures: [`@body.${name}`],
      behavior: [
        'Labels depend on the source operation and surviving topology; not every shape has every label. Names are local to the geometry, so rotating or changing the workplane does not turn them into world-axis tests.',
        'A selector may resolve to multiple faces. Placement, cut, and detail consumers have different allowed cardinalities.',
      ],
      examples: [
        `obj body = extrude(rect(40, 30), 8);\n// Select the available label in an operation, for example:\nfillet(@body.top.edges, 1);`,
      ],
      related: ['edges', 'perimeter', 'center'],
    } satisfies LanguageHelpEntry,
  ]),
);

const pointNames = [
  'front_left',
  'front_right',
  'back_left',
  'back_right',
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
];
const edgeNames = [
  'front_edge',
  'back_edge',
  'left_edge',
  'right_edge',
  'top_edge',
  'bottom_edge',
];

/** Semantic face, boundary, and anchor documentation is shared across all editors. */
export const referenceHelp: Record<string, LanguageHelpEntry> = {
  ...faceHelp,
  ...Object.fromEntries(
    pointNames.map((name) => [
      name,
      {
        summary: `Selects the ${name.replace('_', '-')} named corner of a compatible face.`,
        signatures: [`@body.face.${name}(x: dx, y: dy)`],
        behavior: [
          'A corner is a point/placement reference, not an entire face. Availability depends on face geometry and orientation; select the parent face explicitly.',
        ],
        examples: [
          'obj base = cube([40, 30, 6]);\nobj hole = cut(circle(4), through, @base.top.front_left(x: 5, y: 5));',
        ],
        related: ['pos', 'center', 'cut'],
      },
    ]),
  ),
  ...Object.fromEntries(
    edgeNames.map((name) => [
      name,
      {
        summary: `Selects the ${name.replace('_edge', '')} named boundary edge of a compatible parent face.`,
        signatures: [`@body.face.${name}`, `@body.face.${name}.center`],
        behavior: [
          'Use an edge for a supported edge consumer, or its .center as a point placement. Named edges depend on the parent face and its semantic frame.',
        ],
        examples: [
          'obj base = cube([40, 30, 6]);\nfillet(@base.top.front_edge, 1);',
        ],
        related: ['edges', 'fillet', 'center'],
      },
    ]),
  ),
  edges: {
    summary:
      'Selects matching boundary edges, including both outer boundaries and inner holes.',
    signatures: ['@body.edges', '@body.face.edges'],
    behavior: [
      'Repeatable consumers expand selectors in stable source order and remove duplicates. Fill preserves loop grouping so inner loops remain holes. Use .perimeter when only an outer boundary is intended.',
    ],
    examples: [
      'obj body = extrude(rect(40, 30), 8);\nfillet(@body.top.edges, 1);',
    ],
    related: ['perimeter', 'fillet', 'fill'],
  },
  perimeter: {
    summary:
      'Selects the outer boundary of a face, or the outer-face loops of an object.',
    signatures: ['@body.face.perimeter', '@body.perimeter'],
    behavior: [
      'A face perimeter excludes its inner hole wires. Object-wide perimeter excludes interior topology. This differs from .edges, which includes matching inner boundaries.',
    ],
    examples: [
      'obj body = extrude(rect(40, 30), 8);\nsurface cap = fill(@body.top.perimeter);',
    ],
    related: ['edges', 'fill'],
  },
  center: {
    summary:
      'Selects a face-derived center point for placement and axis operations.',
    signatures: ['@body.face.center', '@body.face.center(x: dx, y: dy)'],
    behavior: [
      'A center is a point, not a boundary or surface: it is valid for placement and axis consumers, but not for fill or face-only draft consumers.',
    ],
    examples: [
      'obj base = cube([40, 30, 6]);\nobj hole = cut(circle(4), through, @base.top.center);',
    ],
    related: ['pos', 'cut', 'around'],
  },
  '*': {
    summary:
      'Expands a topology selector to every matching member at that level.',
    signatures: ['@body.*', '@parts[*].top'],
    behavior: [
      'Use only in consumers that accept multiple selections. Ordered expansion is de-duplicated; a singular surface operation cannot silently choose one match.',
    ],
    examples: [
      'obj body = extrude(rect(40, 30), 8);\nfillet(@body.*.edges, 1);',
    ],
    related: ['edges', 'sides'],
  },
  surface: {
    summary:
      'Declares open surface geometry from a closed boundary or another offset surface.',
    signatures: [
      'surface name = fill(boundary);',
      'surface name = offset_surface(surface, distance);',
    ],
    behavior: [
      "A surface is not a closed solid. Use thicken to create material thickness. The boundary must satisfy the selected surface operation's topology requirements.",
    ],
    examples: [
      'sketch outline = rect(20, 10);\nsurface skin = fill(outline);\nobj plate = thicken(skin, 2);',
    ],
    related: ['fill', 'offset_surface', 'thicken'],
  },
  corner: {
    summary:
      'Anchors a compact sketch primitive at the corner of its bounds instead of its center.',
    signatures: ['rect(width, height, origin: corner)'],
    behavior: [
      "This changes the profile's origin, not its dimensions. For a point on solid topology, use a named corner such as @body.top.front_left.",
    ],
    examples: ['sketch plate = rect(40, 30, origin: corner);'],
    related: ['rect', 'at', 'front_left'],
  },
  edge: {
    summary:
      'Selects a named edge in consumers that support the edge(name) selector, such as a sheet flange.',
    signatures: ['body.edge(front)', '@body.top.front_edge'],
    behavior: [
      'Use .edges for all matching boundary edges. A single named edge is needed for operations such as flange that depend on a particular boundary.',
    ],
    examples: [
      'obj body = extrude(rect(40, 30), 8);\nfillet(@body.top.front_edge, 1);',
    ],
    related: ['edges', 'flange'],
  },
  face: {
    summary:
      'A topology-selection concept identifying a surface of an existing object.',
    signatures: ['@body.top', '@body.front', '@body.sides'],
    behavior: [
      'Use the actual semantic label produced by the operation. A face selection carries a local frame; it is distinct from its edges, perimeter, and center.',
    ],
    examples: [
      'obj body = extrude(rect(40, 30), 8);\nsurface cap = fill(@body.top);',
    ],
    related: ['top', 'edges', 'center'],
  },
  side: {
    summary:
      'A lateral-face selection concept; concrete side names depend on the object or sketch.',
    signatures: ['@body.front', '@body.left', '@body.sides'],
    behavior: [
      'Use a specific label to choose one available side, or .sides for the lateral-face collection. For compact rectangles, plant selects one canonical sketch side.',
    ],
    examples: ['sketch tab = rect(20, 8) plant bottom;'],
    related: ['sides', 'plant'],
  },
};
