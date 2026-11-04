/**
 * @author Aidan Boissonneault
 * @file module-help.ts
 * @purpose Provides module help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Cross-file reuse and author-assigned metadata share declaration scope. */
export const moduleHelp: Record<string, LanguageHelpEntry> = {
  import: {
    summary:
      "Loads another file's exports, a font asset, or reusable imported shape geometry.",
    signatures: [
      "import './library.bscd';",
      "import { name as alias } from './library.bscd';",
      "import * as library from './library.bscd';",
      "import shape name = './part.step';",
    ],
    parameters: [
      {
        name: 'path',
        description:
          'Path resolved by the workspace compiler from the importing file.',
      },
    ],
    behavior: [
      'Named imports expose only requested exports. Namespace imports qualify access through an alias. Circular source imports are rejected. Use import shape for STEP/STP/STL assets rather than source imports.',
    ],
    examples: [
      "import { bracket as mount } from './hardware.bscd';\nplace(mount);",
    ],
    related: ['export', 'font', 'shape'],
  },
  export: {
    summary:
      'Makes declarations available to source imports. Drawing exports are declared inside drawing blocks.',
    signatures: [
      'export var name = expression;',
      'export fn name(parameters) { statements }',
      'export part name { statements }',
    ],
    behavior: [
      'Unexported declarations stay private to the file. Current exports wrap supported declarations; the older export { names } from syntax is not implemented. Language exports are separate from the editor commands that save compiled STEP/STL geometry.',
    ],
    examples: [
      'export var wall = 2;\nexport part bracket {\n  obj body = cube([30, 20, 4]);\n}',
    ],
    related: ['import', 'drawing'],
  },
  as: {
    summary:
      'Assigns an alias to an import, a placed instance, or an individual sketch component.',
    signatures: [
      'profile as name',
      'place(component, @target) as instance;',
      "import { original as alias } from './library.bscd';",
    ],
    behavior: [
      'Sketch component aliases retain exact members such as @body.outer.top: use rect(...) as outer + rect(...) as inner to keep identities through profile algebra. Placement aliases name instances for later references.',
    ],
    examples: [
      'sketch plate = rect(40, 30) as outer - rect(20, 10) as inner;\nobj plate = extrude(plate, 3);',
    ],
    related: ['rect', 'place', 'import'],
  },
  extends: {
    summary:
      'Creates a reusable ref based on another imported or generated source shape.',
    signatures: ['ref name extends source { statements };'],
    behavior: [
      'The adapter can declare semantic anchors and supported healing/defeaturing steps without rewriting the imported model. Place the new ref to emit a visible instance.',
    ],
    examples: [
      "import shape vendor = './vendor.step';\nref adapted extends vendor {\n  @mount = @largest_planar;\n};\nplace(adapted);",
    ],
    related: ['ref', 'shape', 'heal', 'defeature'],
  },
  color: {
    summary: 'Sets display color metadata on a part, ref, or named object.',
    signatures: [
      'part.color = #RRGGBB;',
      'part.color = color_variable;',
      'object.color = color_variable;',
    ],
    behavior: [
      'An object override can differ from its part color. Color affects presentation metadata, not solid dimensions or boolean behavior.',
      'The value may be a #RRGGBB literal or a string-valued expression containing that format.',
    ],
    examples: [
      'var housing_color = #2563EB;\npart housing {\n  part.color = housing_color;\n  obj body = cube([40, 30, 10]);\n  body.color = #F97316;\n}',
    ],
    related: ['material', 'part'],
  },
  material: {
    summary: 'Assigns a material name used by rendering and part metadata.',
    signatures: [
      "part.material = 'PLA';",
      'part.material = material_variable;',
      'object.material = material_variable;',
    ],
    parameters: [
      {
        name: 'name',
        description:
          'Built-in material or a workspace material defined in assets/materials.json.',
      },
    ],
    behavior: [
      'An object can override its containing part. Material selection is not a mechanical simulation or a manufacturing certification.',
      'Variables may contain built-in names or custom material names from assets/materials.json.',
    ],
    examples: [
      "var finish = 'Galaxy Black PLA';\npart panel {\n  part.material = finish;\n  obj body = cube([40, 30, 3]);\n}",
    ],
    related: ['part', 'color'],
  },
  use: {
    summary:
      'Selects a bundled standard hardware library or manufacturing tolerance profile.',
    signatures: [
      'use std.hardware.metric;',
      'use std.printing.fdm;',
      'use std.printing.resin;',
      'use std.machining.cnc;',
      'use std.cutting.laser;',
    ],
    behavior: [
      'Hardware imports supply symbolic sizes such as M3.clearance. Process profiles supply offsets for following fit declarations; they do not download external executable code.',
    ],
    examples: [
      'use std.hardware.metric;\nuse std.printing.fdm;\nfit(clearance, bolt, through, bore);',
    ],
    related: ['std', 'hole', 'fit'],
  },
};
