/**
 * @author Aidan Boissonneault
 * @file sketchSnippets.ts
 * @purpose Provides sketch snippets behavior for the snippets in language server package.
 * @last-edited October 6, 2026
 */

export const BUSHSCAD_SKETCH_SNIPPETS = [
  {
    label: 'sketch',
    insertText: 'sketch ${1:name} = ${2:rect(${3:60}, ${4:40})};',
    detail: 'Declare a sketch',
  },
  {
    label: 'sketch compact dimensioned rectangle',
    insertText:
      'sketch ${1:plate} = rect(_, ${2:40});\n@${1:plate}.${3:bottom} = ${4:60};',
    detail: 'Declare a compact rectangle with a persistent driving dimension',
  },
  {
    label: 'sketch compact dimensioned circle',
    insertText: 'sketch ${1:hole} = circle(_);\n@${1:hole}.diameter = ${2:10};',
    detail: 'Declare a compact circle with a persistent diameter dimension',
  },
  {
    label: 'sketch compact radius dimensioned circle',
    insertText:
      'sketch ${1:hole} = circle(2 * (${2:5}));\n@${1:hole}.radius = ${2:5};',
    detail: 'Declare a compact circle with a persistent radius dimension',
  },
  {
    label: 'sketch compact dimensioned ellipse',
    insertText:
      'sketch ${1:seal} = ellipse(_, _);\n@${1:seal}.width = ${2:40};\n@${1:seal}.height = ${3:20};',
    detail: 'Declare an exact ellipse with persistent width and height',
  },
  {
    label: 'profile',
    insertText:
      'sketch ${1:profile} = path(\n\t${2:bottom} = line((0, 0), (${3:60}, 0)),\n\t${4:right} = line((${3:60}, 0), (${3:60}, ${5:40})),\n\t${6:top} = line((${3:60}, ${5:40}), (0, ${5:40})),\n\t${7:left} = close(),\n\tconstraint(${2:bottom}, horizontal),\n\tconstraint(${4:right}, vertical),\n\tconstraint(${2:bottom}, length, ${3:60}),\n\tconstraint(${4:right}, length, ${5:40})\n);',
    detail: 'Declare a constrained line profile with path(...)',
  },
  {
    label: 'sketch path bodies',
    insertText:
      'sketch ${1:plate} = path(\n\t${2:outer_bottom} = line((0, 0), (${3:40}, 0)),\n\t${4:outer_right} = line((${3:40}, ${5:30})),\n\t${6:outer_top} = line((0, ${5:30})),\n\t${7:outer_left} = close(),\n\t${8:hole_bottom} = line((${9:10}, ${10:10}), (${11:30}, ${10:10})),\n\t${12:hole_right} = line((${11:30}, ${13:20})),\n\t${14:hole_top} = line((${9:10}, ${13:20})),\n\t${15:hole_left} = close(),\n\t${16:shell} = ${2:outer_bottom} - ${8:hole_bottom}\n);',
    detail: 'Declare feature-based named bodies in a path sketch',
  },
  {
    label: 'constraint horizontal',
    insertText: 'constraint(${1:segment}, horizontal);',
    detail: 'Constrain segment to be horizontal',
  },
  {
    label: 'constraint vertical',
    insertText: 'constraint(${1:segment}, vertical);',
    detail: 'Constrain segment to be vertical',
  },
  {
    label: 'constraint horizontal points',
    insertText: 'constraint(${1:point}, horizontal, ${2:other_point});',
    detail: 'Keep two sketch points at the same Y coordinate',
  },
  {
    label: 'constraint vertical points',
    insertText: 'constraint(${1:point}, vertical, ${2:other_point});',
    detail: 'Keep two sketch points at the same X coordinate',
  },
  {
    label: 'constraint perpendicular',
    insertText: 'constraint(${1:segment}, perpendicular, ${2:other});',
    detail: 'Constrain two segments perpendicular',
  },
  {
    label: 'constraint parallel',
    insertText: 'constraint(${1:segment}, parallel, ${2:other});',
    detail: 'Constrain two segments parallel',
  },
  {
    label: 'constraint length',
    insertText: 'constraint(${1:segment}, length, ${2:30});',
    detail: 'Fix segment length',
  },
  {
    label: 'constraint angle',
    insertText: 'constraint(${1:segment}, angle, ${2:45});',
    detail: 'Fix segment angle in degrees',
  },
  {
    label: 'constraint relative angle',
    insertText: 'constraint(${1:target}, angle, ${2:reference}, ${3:45deg});',
    detail: 'Constrain the smaller angle between two sketch segments',
  },
  {
    label: 'constraint fixed',
    insertText: 'constraint(${1:point}, fixed);',
    detail: 'Fix a point at its initial coordinates',
  },
  {
    label: 'point decl',
    insertText: 'point ${1:a} = (${2:0}, ${3:0});',
    detail: 'Declare a construction point',
  },
];
