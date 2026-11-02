/**
 * @author Aidan Boissonneault
 * @file sheet-operation-help.ts
 * @purpose Provides sheet operation help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const sheetExample = `sheet bracket thickness: 2 bend_radius: 1 k_factor: 0.44 {
  sketch blank = rect(80, 40);
  obj panel = sheet_base(blank);
  flange panel.edge(front) length: 15 angle: 90deg;
  export flat_pattern dxf './exports/bracket-flat.dxf';
}`;

export const sheetOperationHelp: Record<string, LanguageHelpEntry> = {
  sheet: {
    summary:
      'Declares a sheet-metal part with uniform thickness, base panels, bends, and optional flat-pattern DXF output.',
    signatures: [
      'sheet name thickness: value bend_radius: value k_factor: value { ... }',
    ],
    parameters: [
      { name: 'thickness', description: 'Required positive sheet thickness.' },
      {
        name: 'bend_radius',
        description: 'Default bend radius for flanges; default 1.',
      },
      {
        name: 'k_factor',
        description:
          'Neutral-axis thickness fraction used in bend allowance; default 0.44.',
      },
      {
        name: 'material',
        description: 'Optional quoted material-catalog name.',
      },
    ],
    behavior: [
      'Sheet blocks accept sketch, var, sheet_base objects, flange statements, and flat-pattern exports.',
      'Flanges consume strips of the original rectangle; the remaining base panel shrinks. The flat outline remains the original blank rectangle.',
      'Current sheet numeric lengths pass directly into millimeter geometry fields; use base_unit = mm.',
    ],
    examples: [sheetExample],
    related: ['sheet_base', 'flange', 'flat_pattern'],
  },
  sheet_base: {
    summary:
      'Creates a sheet panel by extruding a named sketch to the enclosing sheet thickness.',
    signatures: ['obj panel = sheet_base(sketchName);'],
    parameters: [
      {
        name: 'sketchName',
        description: 'Named sketch defined inside the sheet block.',
      },
    ],
    behavior: [
      'Only valid inside sheet. Flanges require a rectangular base; a non-rectangular panel can be extruded without flanges.',
      'The enclosing sheet declaration supplies thickness and material.',
    ],
    examples: [
      'sheet plate thickness: 2 {\n  sketch blank = rect(60, 40);\n  obj panel = sheet_base(blank);\n}',
    ],
    related: ['sheet', 'flange', 'extrude'],
  },
  flange: {
    summary:
      'Folds a strip of a rectangular sheet panel into a bent wall along one named edge.',
    signatures: [
      'flange panel.edge(front) length: distance angle: degrees radius: distance direction: up;',
    ],
    parameters: [
      {
        name: 'edge',
        description:
          'front, back, left, or right on a rectangular sheet_base panel.',
      },
      {
        name: 'length',
        description:
          'Required positive flat strip length, including bend allowance.',
      },
      {
        name: 'angle',
        description:
          'Required bend angle in degrees, greater than 0 and at most 180.',
      },
      {
        name: 'radius',
        description: 'Positive bend radius; defaults to the sheet bend_radius.',
      },
      { name: 'direction', description: 'up or down; defaults to up.' },
    ],
    behavior: [
      'Bend allowance = angle in radians * (radius + k_factor * thickness). The strip must be longer than its bend allowance.',
      'One flange per edge. Opposing strips must leave a positive remaining base panel.',
    ],
    examples: [sheetExample],
    related: ['sheet', 'sheet_base', 'direction', 'flat_pattern'],
  },
  flat_pattern: {
    summary:
      'Requests a developed sheet-metal DXF with the blank outline and bend lines.',
    signatures: ["export flat_pattern dxf './exports/name.dxf';"],
    parameters: [
      { name: 'dxf', description: 'The supported flat-pattern export format.' },
      {
        name: 'path',
        description:
          'Quoted output path recorded by the sheet export declaration.',
      },
    ],
    behavior: [
      'Only valid inside a sheet block. The current developed pattern retains the original rectangle and adds bend-allowance lines.',
      'This models the supported rectangular-panel flange workflow; it is not a general solid-unfolding operation.',
    ],
    examples: [sheetExample],
    related: ['sheet', 'flange', 'export'],
  },
};
