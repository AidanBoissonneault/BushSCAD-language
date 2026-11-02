/**
 * @author Aidan Boissonneault
 * @file declaration-help.ts
 * @purpose Provides declaration help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** File and geometry declarations, with scope and emission rules for authors. */
export const declarationHelp: Record<string, LanguageHelpEntry> = {
  base_unit: {
    summary: 'Sets the length unit for unsuffixed dimensions in this file.',
    signatures: ['base_unit = mm | cm | m | in | ft;'],
    parameters: [
      {
        name: 'unit',
        description:
          'Default is mm. An explicit suffix such as 0.5in overrides this setting for that value.',
      },
    ],
    behavior: [
      'Geometry is normalized to millimetres internally. Angular parameters use degrees, not the length base unit.',
    ],
    examples: ['base_unit = mm;\nsketch plate = rect(0.5in, 20);'],
    related: ['workplane', 'mm', 'deg'],
  },
  workplane: {
    summary:
      'Chooses the default starting sketch plane when no explicit placement supplies one.',
    signatures: ['workplane = XY | XZ | YZ;'],
    parameters: [
      {
        name: 'plane',
        description:
          'XY is the default (+Z normal); XZ has a -Y normal; YZ has a +X normal.',
      },
    ],
    behavior: [
      'Explicit face, plane, or component placement controls subsequent geometry. Face names remain local to the resulting solid.',
    ],
    examples: [
      'workplane = XZ;\nsketch plate = rect(20, 10);\nobj plate = extrude(plate, 3);',
    ],
    related: ['plane', 'base_unit'],
  },
  var: {
    summary:
      'Binds a name to a value for reuse in expressions and model dimensions.',
    signatures: ['var name = expression;'],
    parameters: [
      {
        name: 'expression',
        description:
          'A number, string, boolean, list, tuple, reference property, or supported expression.',
      },
    ],
    behavior: [
      'Local declarations shadow outer names. Values are evaluated during compilation; they are not animated editor state.',
    ],
    examples: [
      'var wall = 2;\nvar width = 60;\nsketch inside = rect(width - 2 * wall, 30);',
    ],
    related: ['env', 'for'],
  },
  env: {
    summary:
      'Declares a build parameter whose external override takes precedence over its fallback.',
    signatures: ['env name fallback expression;'],
    parameters: [
      {
        name: 'name',
        description: 'Override key supplied by the host or CLI.',
      },
      {
        name: 'expression',
        description:
          'Default value and type used when no override is provided.',
      },
    ],
    behavior: [
      'After declaration, use the name like a normal variable in sizes, conditionals, and iterators. Changing an override requires a new compile.',
    ],
    examples: [
      'env hole_count fallback 4;\npart mounting {\n  for i in range(hole_count) {\n    var x = i * 12;\n  }\n}',
    ],
    related: ['fallback', 'var'],
  },
  fallback: {
    summary:
      'Supplies the default value and inferred type of an environment parameter.',
    signatures: ['env name fallback expression;'],
    behavior: [
      'The fallback is used only when the build does not supply that override. It is part of an env declaration, not a general null-coalescing operator.',
    ],
    examples: ["env label fallback 'FRONT';\nenv holes_enabled fallback true;"],
    related: ['env'],
  },
  sketch: {
    summary:
      'Names a reusable two-dimensional profile for solid, surface, or sketch operations.',
    signatures: ['sketch name = profile;'],
    parameters: [
      {
        name: 'profile',
        description:
          'A compact primitive, path/wrap profile, or supported profile expression.',
      },
    ],
    behavior: [
      'Sketches default to center origin; origin: corner selects the primitive bounds corner. A sketch alone does not emit a solid.',
    ],
    examples: ['sketch plate = rect(60, 40);\nobj plate = extrude(plate, 4);'],
    related: ['rect', 'path', 'obj', 'extrude'],
  },
  obj: {
    summary:
      'Names the geometry produced by an operation so it can be selected, modified, placed, or exported.',
    signatures: ['obj name = operation;'],
    parameters: [
      {
        name: 'operation',
        description:
          'An extrusion, cut, direct solid primitive, sweep, or another supported object operation.',
      },
    ],
    behavior: [
      'An obj result exposes semantic references such as @body.top. A sketch and the object built from it may use the same name.',
    ],
    examples: [
      'sketch body = rect(40, 20);\nobj body = extrude(body, 8);\nfillet(@body.top.edges, 1);',
    ],
    related: ['sketch', 'part', 'ref'],
  },
  part: {
    summary:
      'Groups emitted geometry into a named part with its own material, color, and export identity.',
    signatures: ['part name { statements }'],
    behavior: [
      'Part boundaries are retained by preview/export rather than treating all model geometry as one anonymous mesh. Cross-part references can use qualified names.',
    ],
    examples: [
      "part bracket {\n  part.material = 'PLA';\n  sketch base = rect(40, 20);\n  obj base = extrude(base, 4);\n}",
    ],
    related: ['obj', 'ref', 'color', 'material'],
  },
  ref: {
    summary:
      'Declares reusable hidden source geometry that is built for use but is not displayed until consumed or placed.',
    signatures: [
      'ref name { statements }',
      'ref name extends source { statements };',
    ],
    behavior: [
      'Useful for tools, reusable library shapes, and imported geometry adapters. A generated ref uses its planted side or bottom.center as its default placement anchor.',
    ],
    examples: ['ref pin {\n  obj shaft = cylinder(12, d: 4);\n}\nplace(pin);'],
    related: ['place', 'extends', 'plant'],
  },
  fn: {
    summary:
      'Defines parameterized geometry with a local scope and an optional explicit result block.',
    signatures: ['fn name(parameter, optional: default) { statements }'],
    parameters: [
      {
        name: 'parameters',
        description:
          'Required positional names followed by supported named/default arguments.',
      },
    ],
    behavior: [
      'Statements before return prepare sketches and values. A final return block emits the result entries. Place the call to supply a target for returned operations that omit one.',
    ],
    examples: [
      'fn plate(w, h: 20) {\n  sketch profile = rect(w, h);\n  return { obj body = extrude(profile, 3), }\n}\nplace(plate(40));',
    ],
    related: ['return', 'place'],
  },
  return: {
    summary:
      'Emits the result geometry of a function after its local setup statements.',
    signatures: ['return { entry, entry, }'],
    behavior: [
      'Must be the final statement in the function. Separate returned entries with commas; a trailing comma is allowed. Returned cuts may inherit the place(...) target.',
    ],
    examples: [
      'fn washer(d) {\n  sketch profile = circle(d);\n  return { obj body = extrude(profile, 2), }\n}',
    ],
    related: ['fn', 'place', 'cut'],
  },
  font: {
    summary:
      'Imports a font asset under a name for generating text outline sketches.',
    signatures: ["font name = import './fonts/Font.ttf';"],
    parameters: [
      {
        name: 'path',
        description:
          'Workspace font asset path, resolved relative to the declaring file.',
      },
    ],
    behavior: [
      'Use the font name in word(..., font: name). Font outlines become sketch geometry; missing assets produce diagnostics rather than silently supplying arbitrary glyphs.',
    ],
    examples: [
      "font label_font = import './fonts/Label.ttf';\nsketch text = word('TOP', size: 8, font: label_font);",
    ],
    related: ['word', 'import'],
  },
};
