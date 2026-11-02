/**
 * @author Aidan Boissonneault
 * @file drawing-help.ts
 * @purpose Provides drawing help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Drawing syntax is separate from sketch dimensions and solid export commands. */
export const drawingHelp: Record<string, LanguageHelpEntry> = {
  drawing: {
    summary:
      'Declares a fabrication drawing with one projected view, optional dimensions, and DXF/SVG output requests.',
    signatures: [
      'drawing name { view object.face scale: number; dimension object.width; }',
    ],
    parameters: [
      {
        name: 'view',
        description:
          'Exactly one view per block, using top, bottom, front, back, left, or right.',
      },
      { name: 'scale', description: 'Optional numeric drawing scale.' },
    ],
    behavior: [
      'Current view syntax is view object.face, not view face of object. Arbitrary plane views are not accepted. Solid STEP/STL export is a separate editor command.',
    ],
    examples: [
      "obj plate = cube([40, 30, 4]);\ndrawing sheet_view {\n  view plate.top scale: 1;\n  dimension plate.width;\n  export svg './plate.svg';\n}",
    ],
    related: ['view', 'dimension', 'dxf', 'svg'],
  },
  view: {
    summary: 'Selects the object and projection direction for a drawing.',
    signatures: ['view object.top scale: 1;'],
    behavior: [
      'A drawing requires exactly one view. Supported directions are top, bottom, front, back, left, and right; the scale value is a numeric literal.',
    ],
    examples: [
      'obj plate = cube([40, 30, 4]);\ndrawing top_sheet { view plate.top scale: 1; }',
    ],
    related: ['drawing', 'dimension'],
  },
  scale: {
    summary: 'Sets the numeric output scale for a drawing view.',
    signatures: ['view object.top scale: 1;'],
    behavior: [
      'Scale is optional, must be a numeric literal, and affects SVG/DXF drawing coordinates without changing model geometry.',
    ],
    examples: [
      'obj plate = cube([40, 30, 4]);\ndrawing detail { view plate.top scale: 2; }',
    ],
    related: ['drawing', 'view'],
  },
  dimension: {
    summary:
      'Annotates an object extent or a distance between references inside a drawing block.',
    signatures: [
      'dimension object.width;',
      'dimension object.height;',
      'dimension object.depth;',
      'dimension first.face to second.face;',
    ],
    behavior: [
      'Single-reference drawing dimensions accept width, height, or depth. A drawing annotation is not a driving sketch constraint; the sketch dimension(...) form has its own syntax.',
    ],
    examples: [
      'obj plate = cube([40, 30, 4]);\ndrawing top_sheet {\n  view plate.top;\n  dimension plate.width;\n  dimension plate.left to plate.right;\n}',
    ],
    related: ['drawing', 'constraint', 'width'],
  },
  ...Object.fromEntries(
    Object.entries({
      dxf: 'CAD exchange and fabrication workflows',
      svg: 'vector illustration and documentation',
    }).map(([format, purpose]) => [
      format,
      {
        summary: `Requests ${format.toUpperCase()} drawing output for ${purpose}.`,
        signatures: [`export ${format} './output.${format}';`],
        behavior: [
          'Use inside a drawing block, then compile/export through the host. The VS Code export command asks for the destination; it does not grant arbitrary webview filesystem access.',
        ],
        examples: [
          `obj plate = cube([40, 30, 4]);\ndrawing top_sheet {\n  view plate.top;\n  export ${format} './plate.${format}';\n}`,
        ],
        related: ['drawing', 'export'],
      },
    ]),
  ),
};
