/**
 * @author Aidan Boissonneault
 * @file control-help.ts
 * @purpose Provides control help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Compile-time branching and iteration, including index-versus-position semantics. */
export const controlHelp: Record<string, LanguageHelpEntry> = {
  for: {
    summary:
      'Repeats statements at compile time for each value produced by an iterator or list.',
    signatures: [
      'for item in iterator { statements }',
      'for (first, second) in iterator where condition { statements }',
    ],
    parameters: [
      {
        name: 'binding',
        description:
          'One local name or a tuple of names to bind for each iteration.',
      },
      {
        name: 'iterator',
        description: 'range, grid, radial, enumerate, or a list expression.',
      },
    ],
    behavior: [
      'Loops belong inside part, ref, or function bodies; they are not top-level statements. The compiler unrolls the body into geometry operations. where skips iterations; within establishes a dimension for auto distribution.',
    ],
    examples: [
      'part sample {\n  for i in range(3) {\n    var diameter = 2 + i;\n    sketch hole = circle(diameter);\n  }\n}',
    ],
    related: ['range', 'grid', 'radial', 'enumerate', 'where', 'within'],
  },
  in: {
    summary:
      'Connects a for-loop binding to its iterator. As a numeric suffix, in denotes inches.',
    signatures: ['for item in iterator { statements }', 'length = number in'],
    behavior: [
      'Iterator values are bound inside the loop body. Numeric 1in equals 25.4mm; it is a length unit, not a loop expression.',
    ],
    examples: [
      'part sample {\n  for diameter in [2, 3, 4] {\n    sketch hole = circle(diameter);\n  }\n  var inch = 1in;\n}',
    ],
    related: ['for', 'mm'],
  },
  range: {
    summary:
      'Produces an ascending sequence with an inclusive start and exclusive end.',
    signatures: ['range(end)', 'range(start, end)', 'range(start, end, step)'],
    parameters: [
      { name: 'start', description: 'First value; defaults to 0.' },
      { name: 'end', description: 'Exclusive upper bound.' },
      {
        name: 'step',
        description:
          'Positive finite increment; defaults to 1. Use ascending bounds.',
      },
    ],
    behavior: [
      'range(4) yields 0, 1, 2, 3. The current evaluator advances while value < end; descending iteration is not implemented. Do not pass a zero or negative step.',
    ],
    examples: [
      'part sample {\n  for i in range(1, 8, 2) {\n    var x = i * 10;\n  }\n}',
    ],
    related: ['for', 'where'],
  },
  grid: {
    summary:
      'Produces column/row pairs for a rectangular pattern, optionally scaled into positions.',
    signatures: [
      'grid(cols, rows, spacing?)',
      'grid(cols: n, rows: m, spacingX: dx, spacingY: dy)',
    ],
    parameters: [
      {
        name: 'cols, rows',
        description: 'Column and row counts, rounded by the evaluator.',
      },
      {
        name: 'spacing',
        description:
          'Shared length spacing; axis-specific spacing overrides it.',
      },
    ],
    behavior: [
      'Without spacing, values are zero-based indices. Nonzero spacing scales each axis in the body. A where filter still sees column/row indices, so grid spacing does not change index-based filtering.',
    ],
    examples: [
      'part sample {\n  for (col, row) in grid(4, 3, 10) where col != 2 {\n    var x = col;\n    var y = row;\n  }\n}',
    ],
    related: ['for', 'where', 'radial'],
  },
  radial: {
    summary:
      'Produces evenly spaced angles around a full circle or a partial sweep.',
    signatures: [
      'radial(count, start?, sweep?)',
      'radial(count: n, start: angle, sweep: angle)',
    ],
    parameters: [
      { name: 'count', description: 'Number of angle samples.' },
      { name: 'start', description: 'First angle in degrees; defaults to 0.' },
      { name: 'sweep', description: 'Total span in degrees; defaults to 360.' },
    ],
    behavior: [
      'Angle k is start + k * sweep / count. The terminal angle is excluded, avoiding a duplicate at 360 degrees.',
    ],
    examples: [
      'part sample {\n  for a in radial(4, start: 0deg, sweep: 180deg) {\n    var angle_value = a;\n  }\n}',
    ],
    related: ['for', 'pos', 'pattern'],
  },
  enumerate: {
    summary: 'Pairs each list value with its zero-based index.',
    signatures: ['for (index, value) in enumerate(items) { statements }'],
    parameters: [
      {
        name: 'items',
        description: 'List expression to iterate in source order.',
      },
    ],
    behavior: [
      'The first binding receives the index and the second receives the value. With a single binding, the current evaluator binds the value only.',
    ],
    examples: [
      'part sample {\n  var sizes = [2, 4, 6];\n  for (i, d) in enumerate(sizes) {\n    sketch hole = circle(d);\n  }\n}',
    ],
    related: ['for', 'range'],
  },
  where: {
    summary: 'Filters a for loop before its body emits geometry.',
    signatures: ['for item in iterator where condition { statements }'],
    behavior: [
      'Only truthy iterations execute. For a spaced grid, the filter sees grid indices while the body receives scaled coordinates.',
    ],
    examples: [
      'part sample {\n  for i in range(8) where i % 2 == 0 {\n    var x = i * 10;\n  }\n}',
    ],
    related: ['for', 'grid', 'if'],
  },
  within: {
    summary:
      'Provides the available dimension used by auto placement inside a loop.',
    signatures: ['for i in range(count) within dimension { statements }'],
    parameters: [
      {
        name: 'dimension',
        description: 'A supported dimension reference such as base.top.width.',
      },
    ],
    behavior: [
      'Use auto in placement coordinates inside the loop rather than calculating each position manually. Feature extents and margins participate in distribution.',
    ],
    examples: [
      'part sample {\n  obj base = cube([60, 30, 5]);\n  for i in range(3) within base.top.width {\n    obj hole = cut(circle(3), through, @base.top(x: auto, y: 10));\n  }\n}',
    ],
    related: ['auto', 'for', 'width'],
  },
  auto: {
    summary:
      "Requests the current loop's automatically distributed coordinate.",
    signatures: ['@target(x: auto, y: expression)'],
    behavior: [
      'Use with a for ... within span loop. It is context-dependent placement input, not a general replacement for an unknown number.',
    ],
    examples: [
      'part sample {\n  obj base = cube([60, 30, 5]);\n  for i in range(3) within base.top.width {\n    obj hole = cut(circle(3), through, @base.top(x: auto, y: 10));\n  }\n}',
    ],
    related: ['within', 'pos'],
  },
  if: {
    summary:
      'Emits a statement block only when its compile-time condition is true.',
    signatures: ['if condition { statements } else { statements }'],
    parameters: [
      {
        name: 'condition',
        description:
          'Boolean or supported comparison/logical expression evaluated from the current scope.',
      },
    ],
    behavior: [
      'Use env parameters to select model variants. Geometry measurement assertions belong in assert when the result is only available after building.',
    ],
    examples: [
      'part sample {\n  env enabled fallback true;\n  if enabled {\n    obj pin = cylinder(12, d: 4);\n  } else {\n    obj block = cube(4);\n  }\n}',
    ],
    related: ['else', 'env', 'assert'],
  },
  else: {
    summary:
      'Provides the alternative branch when the preceding if condition is false.',
    signatures: ['if condition { statements } else { statements }'],
    behavior: [
      'Only the selected branch emits operations; an else block cannot stand alone.',
    ],
    examples: [
      'part sample {\n  if true { var size = 10; } else { var size = 20; }\n}',
    ],
    related: ['if'],
  },
};
