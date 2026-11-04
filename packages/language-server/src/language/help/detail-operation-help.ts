/**
 * @author Aidan Boissonneault
 * @file detail-operation-help.ts
 * @purpose Provides detail operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const selectedEdges =
  'Face, perimeter, edge, array, wildcard, and selector-variable targets expand in stable source order and are de-duplicated.';

export const detailOperationHelp: Record<string, LanguageHelpEntry> = {
  fillet: {
    summary:
      'Rounds selected 3D edges with a radius, or rounds a supported 2D sketch primitive in sketch-expression context.',
    signatures: [
      'fillet(@target, radius);',
      'fillet(target: @target, radius: value);',
      'sketch name = fillet(profile, radius);',
    ],
    parameters: [
      {
        name: '@target',
        description:
          'An object, face, edge, perimeter, or repeatable selector; bare @body infers @body.edges.',
      },
      {
        name: 'radius',
        description:
          'Rounding radius in length units; it must fit the adjacent geometry.',
      },
    ],
    behavior: [
      selectedEdges,
      '@body.(edge1, edge2) selects generated crossings; append [n] to select one.',
      'Modifier targets cannot contain placement offsets. .perimeter excludes inner loops, while .edges includes them.',
      'The old fillet: statement form is removed; use the call form.',
    ],
    examples: [
      'obj base = cube([40, 30, 8]);\nfillet(@base.top.edges, 1);',
      'sketch rounded = fillet(rect(40, 20), 3);\nobj plate = extrude(rounded, 4);',
    ],
    related: ['chamfer', 'edges', 'perimeter', 'roundrect'],
  },
  chamfer: {
    summary: 'Bevels selected edges with an equal-distance, 45-degree chamfer.',
    signatures: [
      'chamfer(@target, offset);',
      'chamfer(target: @target, offset: value);',
    ],
    parameters: [
      {
        name: '@target',
        description:
          'Object, face, edge, perimeter, or selector collection; bare @body infers @body.edges.',
      },
      {
        name: 'offset',
        description: 'Chamfer distance along adjacent faces, in length units.',
      },
    ],
    behavior: [
      selectedEdges,
      '@body.(edge1, edge2)[n] selects one generated crossing. Object-wide .perimeter selects outer-face loops.',
      'Large offsets can exceed available face widths. Targets cannot carry placement offsets.',
    ],
    examples: [
      'part sample {\nobj plate = cube([40, 30, 8]);\nchamfer(@plate.bottom.edges, 1);\n}',
    ],
    related: ['fillet', 'draft', 'edges'],
  },
  shell: {
    summary:
      'Hollows an existing solid with a uniform wall thickness and optional removed opening faces.',
    signatures: [
      'shell(object, thickness);',
      'shell(object, thickness, faces);',
      'shell(target: object, thickness: value, open: faces);',
    ],
    parameters: [
      { name: 'object', description: 'Existing solid object name.' },
      {
        name: 'thickness',
        description:
          'Wall thickness in length units. Positive thickness offsets inward from the original outside faces.',
      },
      {
        name: 'open',
        description:
          'Optional face name or list to remove, such as top or [top, front].',
      },
    ],
    behavior: [
      'Labels are optional; positional values follow object, thickness, and open-face order.',
      'Shelling uses the current body after previous operations; thickness must fit its geometry.',
      'Available at file scope and inside parts, functions, loops, and branches wherever statements are accepted.',
    ],
    examples: [
      'part sample {\nobj box = cube([60, 40, 20]);\nshell(box, 2, open: top);\n}',
    ],
    related: ['open', 'thicken', 'cut'],
  },
  draft: {
    summary:
      'Tilts selected solid faces around a neutral base plane to add a mold-release draft angle.',
    signatures: ['draft(@object.face, angle);'],
    parameters: [
      {
        name: 'object.face',
        description:
          'Face-only selector, such as base.front or base.sides; points and edges are not valid targets.',
      },
      {
        name: 'angle',
        description:
          'Draft angle in degrees; use deg to make the unit explicit.',
      },
    ],
    behavior: [
      'Draft changes whole faces. It is not an edge bevel.',
      'Pass a face reference with @. Labels are optional and can select slots.',
      'Available at file scope and inside parts, functions, loops, and branches wherever statements are accepted.',
    ],
    examples: [
      'part sample {\nobj base = cube([40, 30, 20]);\ndraft(@base.sides, 2deg);\n}',
    ],
    related: ['chamfer', 'fillet'],
  },
  open: {
    summary:
      'Selects faces removed by a shell operation to create an opening in the hollow body.',
    signatures: [
      'shell(object, thickness, top);',
      'shell(object, thickness, [top, front]);',
    ],
    parameters: [
      {
        name: 'faces',
        description:
          'One face label or a bracketed list of labels belonging to the shell target.',
      },
    ],
    examples: [
      'part sample {\nobj box = cube([40, 30, 20]);\nshell(box, 1.5, open: top);\n}',
    ],
    related: ['shell'],
  },
};
