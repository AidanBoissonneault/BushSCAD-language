/**
 * @author Aidan Boissonneault
 * @file topLevelSnippets.ts
 * @purpose Provides top level snippets behavior for the snippets in language server package.
 * @last-edited October 6, 2026
 */

import { BUSHSCAD_SKETCH_SNIPPETS } from './sketchSnippets.js';
import { BUSHSCAD_VALIDATION_SNIPPETS } from './validationSnippets.js';
import { BUSHSCAD_JOINT_SNIPPETS } from './jointSnippets.js';

export const BUSHSCAD_TOP_LEVEL_SNIPPETS = [
  {
    label: 'base_unit',
    insertText: 'base_unit = ${1:mm};',
    detail: 'Set the file base unit',
  },
  {
    label: 'workplane',
    insertText: 'workplane = ${1|XY,XZ,YZ|};',
    detail: 'Set the default starting sketch plane',
  },
  {
    label: 'var',
    insertText: 'var ${1:name} = ${2:value};',
    detail: 'Declare a local variable',
  },
  {
    label: 'env',
    insertText: 'env ${1:name} fallback ${2:value};',
    detail: 'Declare an environment parameter',
  },
  {
    label: 'font',
    insertText: "font ${1:name} = import '${2:./fonts/Font-Regular.ttf}';",
    detail: 'Import a font asset',
  },
  ...BUSHSCAD_SKETCH_SNIPPETS,
  {
    label: 'obj',
    insertText: 'obj ${1:name} = ${2:extrude(${3:sketch}, ${4:10})};',
    detail: 'Declare geometry from a sketch',
  },
  {
    label: 'obj cube',
    insertText: 'obj ${1:block} = cube([${2:40}, ${3:20}, ${4:8}]);',
    detail: 'Declare a direct cuboid primitive',
  },
  {
    label: 'obj cylinder',
    insertText: 'obj ${1:pin} = cylinder(${2:12}, d: ${3:6});',
    detail: 'Declare a direct cylinder primitive',
  },
  {
    label: 'part',
    insertText: 'part ${1:name} {\n\t${2}\n}',
    detail: 'Declare a named part',
  },
  ...BUSHSCAD_JOINT_SNIPPETS,
  {
    label: 'fn',
    insertText:
      'fn ${1:name}(${2}) {\n\t${3:sketch profile = circle(3);}\n\treturn {\n\t\t${4:obj profile = cut(profile, 1),}\n\t}\n}',
    detail: 'Declare a reusable function',
  },
  {
    label: 'for',
    insertText: 'for ${1:i} in ${2:range(${3:4})} {\n\t${4}\n}',
    detail: 'Loop over generated values',
  },
  {
    label: 'for within',
    insertText:
      'for ${1:i} in ${2:range(${3:4})} within ${4:base.top.width} {\n\t${5}\n}',
    detail: 'Loop that auto-distributes iterations across a dimension',
  },
  { label: 'auto', insertText: 'auto', detail: 'Auto-distributed value' },
  {
    label: 'if',
    insertText: 'if ${1:condition} {\n\t${2}\n}',
    detail: 'Conditional block',
  },
  {
    label: 'import',
    insertText: "import '${1:./file.bscd}';",
    detail: 'Import another BushSCAD file',
  },
  {
    label: 'import shape',
    insertText: "import shape ${1:name} = '${2:./vendor/part.step}';",
    detail: 'Import a STEP/STP shape',
  },
  {
    label: 'heal',
    insertText: 'heal ${1:shape} tolerance: ${2:0.01};',
    detail: 'Repair imported shape tolerances',
  },
  {
    label: 'defeature',
    insertText:
      'defeature ${1:shape} ${2|holes,pockets|} smaller_than: ${3:2};',
    detail: 'Remove small imported-shape features',
  },
  {
    label: 'ref extends',
    insertText:
      'ref ${1:name} extends ${2:base} {\n\theal tolerance: ${3:0.01};\n\t@${4:top} = @${5:largest_planar};\n};',
    detail: 'Create a ref that inherits geometry from a base shape',
  },
  {
    label: 'export',
    insertText: 'export part ${1:name} {\n\t${2}\n}',
    detail: 'Export a component or declaration',
  },
  {
    label: 'place',
    insertText: 'place(${1:component}, @${2:target}) rotate(${3:0deg});',
    detail: 'Place a component or function result',
  },
  {
    label: 'place origin',
    insertText: 'place(${1:component});',
    detail: 'Place a component or function result at world origin',
  },
  {
    label: 'rotate',
    insertText: 'rotate ${1:target} ${2:90deg} around ${3:z};',
    detail: 'Rotate an existing object',
  },
  {
    label: 'pattern linear',
    insertText: 'pattern(${1:target}, linear, ${2:4}, ${3:10});',
    detail: 'Linear array of an object',
  },
  {
    label: 'pattern radial',
    insertText: 'pattern(${1:target}, radial, ${2:6}, ${3:base.top.center});',
    detail: 'Radial array of an object',
  },
  {
    label: 'mirror',
    insertText: 'mirror(${1:target}, ${2:plane(center)});',
    detail: 'Mirror an object across a plane',
  },
  {
    label: 'transform',
    insertText: 'transform(${1:target}, translate(${2:10}, y: ${3:0}));',
    detail: 'Transform an existing object',
  },
  {
    label: 'return',
    insertText: 'return {\n\t${1:obj profile = cut(profile, 1),}\n}',
    detail: 'Return geometry from a function',
  },
  {
    label: 'anchor',
    insertText: '@${1:name} = @${2:target};',
    detail: 'Declare a spatial anchor alias',
  },
  {
    label: 'plane',
    insertText: 'plane ${1:name} = offset(${2:10}, @${3:target});',
    detail: 'Declare an offset construction plane',
  },
  {
    label: 'part.color',
    insertText: 'part.color = ${1:#2563EB};',
    detail: 'Set part/ref color metadata',
  },
  {
    label: 'part.material',
    insertText: "part.material = '${1:PLA}';",
    detail: 'Set part/ref material metadata',
  },
  {
    label: 'object.color',
    insertText: '${1:object}.color = ${2:#2563EB};',
    detail: 'Override object color metadata',
  },
  {
    label: 'object.material',
    insertText: "${1:object}.material = '${2:PLA}';",
    detail: 'Override object material metadata',
  },
  {
    label: 'use std.hardware.metric',
    insertText: 'use std.hardware.metric;',
    detail: 'Import metric hardware library',
  },
  {
    label: 'hole clearance',
    insertText:
      'obj ${1:hole} = hole(${2|M3,M4,M5,M6|}.clearance, through ${3:base}, @${4:base.top}(${5:10}, ${6:10}));',
    detail: 'Clearance hole for a metric bolt',
  },
  {
    label: 'hole counterbore',
    insertText:
      'obj ${1:hole} = hole(${2|M3,M4,M5,M6|}.counterbore, through ${3:base}, @${4:base.top}(${5:10}, ${6:10}));',
    detail: 'Counterbored clearance hole',
  },
  {
    label: 'hole tap',
    insertText:
      'obj ${1:hole} = hole(${2|M3,M4,M5,M6|}.tap, depth: ${3:10}, @${4:base.top}(${5:10}, ${6:10}));',
    detail: 'Tapped hole',
  },
  {
    label: 'heatset_insert',
    insertText:
      'obj ${1:insert} = heatset_insert(${2|M3,M4,M5|}, depth: ${3:5}, @${4:base.top}(${5:10}, ${6:10}));',
    detail: 'Heat-set insert pocket',
  },
  {
    label: 'path polyline',
    insertText: 'path ${1:name} = polyline([(0, 0, 0), (${2:80}, 0, 0)]);',
    detail: 'Declare a sweep path',
  },
  {
    label: 'path spline',
    insertText:
      'path ${1:name} = spline([(0, 0, 0), (${2:30}, 0, ${3:20}), (${4:60}, 0, 0)]);',
    detail: 'Declare a smooth sweep path',
  },
  {
    label: 'sweep',
    insertText: 'obj ${1:name} = sweep(${2:sketch} along ${3:path});',
    detail: 'Sweep a sketch along a path',
  },
  {
    label: 'sweep fixed',
    insertText:
      'obj ${1:name} = sweep(${2:sketch} along ${3:path}, orientation: fixed);',
    detail: 'Sweep with fixed orientation',
  },
  {
    label: 'sheet',
    insertText:
      "sheet ${1:bracket} thickness: ${2:2} material: '${3:aluminum}' bend_radius: ${4:1} {\n\tsketch base = rect(${5:80}, ${6:40});\n\tobj base = sheet_base(base);\n\tflange base.edge(front) length: ${7:20} angle: ${8:90deg} radius: ${4:1};\n\texport flat_pattern dxf './${9:exports/bracket-flat.dxf}';\n}",
    detail: 'Sheet-metal block',
  },
  {
    label: 'flange',
    insertText:
      'flange ${1:base}.edge(${2|front,back,left,right|}) length: ${3:20} angle: ${4:90deg} radius: ${5:1};',
    detail: 'Fold a flange from an edge',
  },
  ...BUSHSCAD_VALIDATION_SNIPPETS,
  {
    label: 'use std.printing.fdm',
    insertText: 'use std.printing.fdm;',
    detail: 'Activate FDM tolerance profile',
  },
  {
    label: 'use std.printing.resin',
    insertText: 'use std.printing.resin;',
    detail: 'Activate resin tolerance profile',
  },
  {
    label: 'use std.machining.cnc',
    insertText: 'use std.machining.cnc;',
    detail: 'Activate CNC tolerance profile',
  },
  {
    label: 'use std.cutting.laser',
    insertText: 'use std.cutting.laser;',
    detail: 'Activate laser tolerance profile',
  },
  {
    label: 'fit clearance',
    insertText:
      'fit(clearance, ${1:bolt_name}, through, ${2:hole_name}, ${3|normal,tight,loose|});',
    detail: 'Clearance fit',
  },
  {
    label: 'fit slip',
    insertText:
      'fit(slip, ${1:part_name}, into, ${2:slot_name}, ${3|normal,tight,loose|});',
    detail: 'Slip fit',
  },
  {
    label: 'fit press',
    insertText:
      'fit(press, ${1:insert_name}, into, ${2:boss_name}, ${3|normal,tight,loose|});',
    detail: 'Press fit',
  },
  {
    label: 'fit interference',
    insertText:
      'fit(interference, ${1:part_name}, into, ${2:bore_name}, ${3|normal,tight,loose|});',
    detail: 'Interference fit',
  },
];
