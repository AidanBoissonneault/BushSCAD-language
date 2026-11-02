/**
 * @author Aidan Boissonneault
 * @file surface-operation-help.ts
 * @purpose Provides surface operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

export const surfaceOperationHelp: Record<string, LanguageHelpEntry> = {
  fill: {
    summary:
      'Creates one open surface from exactly one closed sketch or topology selector.',
    signatures: [
      'surface name = fill(sketch);',
      'surface name = fill(object.face);',
      'surface name = fill(@object.face.perimeter);',
    ],
    parameters: [
      {
        name: 'boundary',
        description:
          'A closed sketch, single face, outer perimeter, or classified closed edge loops.',
      },
    ],
    behavior: [
      'Bare faces preserve inner wires; .perimeter uses only the outer loop; .edges rebuilds classified outer and inner loops.',
      'Open, disconnected, ambiguous, or multi-target selections are errors. A corner or .center point cannot supply a closed boundary.',
      'An open surface has no solid thickness. Use thicken to turn it into a solid.',
    ],
    examples: [
      'sketch profile = rect(30, 20);\nsurface cap = fill(profile);\nobj lid = thicken(cap, 2);',
    ],
    related: ['surface', 'perimeter', 'edges', 'thicken'],
  },
  offset_surface: {
    summary:
      'Copies an open surface translated along its remembered surface normal by a signed distance.',
    signatures: [
      'surface name = offset_surface(source, distance);',
      'surface name = offset_surface(fill(boundary), distance);',
    ],
    parameters: [
      {
        name: 'source',
        description:
          'Named surface or an inline fill/offset_surface operation.',
      },
      {
        name: 'distance',
        description:
          'Signed length; positive follows the source normal, negative goes the opposite way.',
      },
    ],
    behavior: [
      'This operation translates the whole surface along one normal. It is not a general variable-normal offset of a curved surface.',
      'Side-face fills retain their own orientation; their offsets do not use world Z.',
    ],
    examples: [
      'sketch profile = rect(30, 20);\nsurface cap = fill(profile);\nsurface raised = offset_surface(cap, 2);',
    ],
    related: ['fill', 'thicken', 'offset'],
  },
  thicken: {
    summary:
      'Converts an open surface into a solid by extruding it along its remembered surface normal.',
    signatures: [
      'obj name = thicken(surface, thickness);',
      'obj name = thicken(fill(boundary), thickness);',
    ],
    parameters: [
      {
        name: 'surface',
        description: 'Named surface or inline fill/offset_surface operation.',
      },
      {
        name: 'thickness',
        description: 'Signed extrusion length along the surface normal.',
      },
    ],
    behavior: [
      'Thickness is one-sided from the source surface. This is a prism operation, not general curved-surface shell thickening.',
      'The result is a solid-producing obj and can be an inline solid tool for cut.',
    ],
    examples: [
      'sketch profile = rect(30, 20);\nobj lid = thicken(fill(profile), 2);',
    ],
    related: ['fill', 'offset_surface', 'shell'],
  },
  project: {
    summary:
      'Reserved sketch projection call; currently recognized by the parser and rejected with an exact-geometry diagnostic.',
    signatures: ['sketch name = project(...);'],
    behavior: [
      'No supported argument contract or projection geometry is implemented. Parsing a call does not make it usable for modeling.',
    ],
    examples: [
      '// Expected diagnostic: exact sketch projection is not implemented.\nsketch projected = project(@body.top.edges);',
    ],
    related: ['sketch', 'path'],
  },
  trim: {
    summary:
      'Reserved sketch trimming call; currently recognized by the parser and rejected with an exact-geometry diagnostic.',
    signatures: ['sketch name = trim(...);'],
    behavior: [
      'No supported argument contract or trimming geometry is implemented. Author the intended closed path or sketch body subtraction explicitly.',
    ],
    examples: [
      '// Expected diagnostic: exact sketch trimming is not implemented.\nsketch trimmed = trim();',
    ],
    related: ['path', 'loop'],
  },
  extend: {
    summary:
      'Reserved sketch extension call; currently recognized by the parser and rejected with an exact-geometry diagnostic.',
    signatures: ['sketch name = extend(...);'],
    behavior: [
      'No supported argument contract or extension geometry is implemented. Specify the intended line endpoints in a path instead.',
    ],
    examples: [
      '// Expected diagnostic: exact sketch extension is not implemented.\nsketch extended = extend();',
    ],
    related: ['path', 'line'],
  },
};
