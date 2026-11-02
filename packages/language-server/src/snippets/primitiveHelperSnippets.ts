/**
 * @author Aidan Boissonneault
 * @file primitiveHelperSnippets.ts
 * @purpose Provides primitive helper snippets behavior for the snippets in language server package.
 * @last-edited October 6, 2026
 */

export const BUSHSCAD_PRIMITIVE_SNIPPETS = [
  {
    label: 'rect',
    insertText: 'rect(${1:60}, ${2:40})',
    detail:
      'Rectangle sketch; optional bottom/right/top/left side names and origin: corner',
  },
  {
    label: 'rect named side',
    insertText:
      'rect(${1:60}, ${2:40}, ${3|bottom,right,top,left|}: ${4:side_name})',
    detail: 'Rectangle sketch with a named bottom/right/top/left side',
  },
  {
    label: 'rect planted side',
    insertText: 'rect(${1:60}, ${2:40}) plant ${3|bottom,right,top,left|}',
    detail: 'Rectangle sketch with a default planted side',
  },
  {
    label: 'circle',
    insertText: 'circle(${1:10})',
    detail: 'Circle sketch; optional origin: corner',
  },
  {
    label: 'ellipse',
    insertText: 'ellipse(${1:40}, ${2:20})',
    detail: 'Exact axis-aligned ellipse sketch',
  },
  {
    label: 'roundrect',
    insertText: 'roundrect(${1:60}, ${2:40}, ${3:4})',
    detail: 'Rounded rectangle sketch; optional origin: corner',
  },
  {
    label: 'triangle',
    insertText: 'triangle(${1:30}, ${2:20})',
    detail: 'Triangle sketch; optional origin: corner',
  },
  {
    label: 'polygon',
    insertText:
      'polygon([(${1:0}, ${2:0}), (${3:10}, ${4:0}), (${5:5}, ${6:10})])',
    detail: 'Polygon sketch from point tuples; optional origin: corner',
  },
  {
    label: 'word',
    insertText:
      "word(${1:'TEXT'}, size: ${2:8}, font: '${3:Noto Sans}', align: ${4|center,left,right|})",
    detail: 'Text outline sketch; optional origin: corner',
  },
  {
    label: 'cube',
    insertText: 'cube([${1:40}, ${2:20}, ${3:8}])',
    detail: 'Direct 3D cube/cuboid object primitive',
  },
  {
    label: 'cylinder',
    insertText: 'cylinder(${1:12}, d: ${2:6})',
    detail: 'Direct 3D cylinder object primitive',
  },
  {
    label: 'torus',
    insertText: 'torus(majorRadius: ${1:20}, minorRadius: ${2:3})',
    detail: 'Direct 3D torus object primitive',
  },
  {
    label: 'path',
    insertText:
      'path(\n  ${1:base} = line((${2:0}, ${3:0}), (${4:20}, ${5:0})),\n  ${6:side} = line((${7:20}, ${8:10})),\n  ${9:return_edge} = close()\n)',
    detail: 'Named cursor-based sketch profile',
  },
  {
    label: 'wrap',
    insertText:
      'wrap([(${1:-20}, ${2:-10}), (${3:20}, ${4:-10}), (${5:20}, ${6:10}), (${7:-20}, ${8:10})])',
    detail: 'Closed sketch from point tuples',
  },
  {
    label: 'inset',
    insertText: 'rect inset(${1:2})',
    detail: 'Inset from the current rectangle',
  },
  {
    label: 'line',
    insertText: '${1:name} = line((${2:0}, ${3:0}), (${4:10}, ${5:0}))',
    detail: 'Named path line segment',
  },
  {
    label: 'arc',
    insertText: '${1:name} = arc((${2:10}, ${3:10}), ${4:8}, ${5|ccw,cw|})',
    detail: 'Named path arc segment',
  },
  {
    label: 'close',
    insertText: '${1:return_edge} = close()',
    detail: 'Named path close segment',
  },
  {
    label: 'loop',
    insertText: 'loop(${1:feature})',
    detail: 'Closed path loop containing a named feature',
  },
  {
    label: 'ignore',
    insertText: 'ignore(${1:body_expression})',
    detail: 'Exclude a path body expression from whole-sketch operations',
  },
];

export const BUSHSCAD_HELPER_SNIPPETS = [
  {
    label: 'pos',
    insertText: '@${1:target}(${2:0}, ${3:0})',
    detail: 'Position relative to a face reference',
  },
  {
    label: 'rotate',
    insertText: 'rotate(x: ${1:0deg}, y: ${2:0deg}, z: ${3:90deg})',
    detail: 'Placement rotation around local axes',
  },
  {
    label: 'rotateX',
    insertText: 'rotateX(${1:90deg})',
    detail: 'Placement rotation around local x',
  },
  {
    label: 'rotateY',
    insertText: 'rotateY(${1:90deg})',
    detail: 'Placement rotation around local y',
  },
  {
    label: 'rotateZ',
    insertText: 'rotateZ(${1:90deg})',
    detail: 'Placement rotation around local z',
  },
  {
    label: 'offset',
    insertText: 'offset(${1:10}, @${2:target})',
    detail: 'Offset a plane',
  },
  {
    label: 'angle',
    insertText: 'angle(${1:45deg})',
    detail: 'Cylindrical surface angle placement',
  },
  {
    label: 'range',
    insertText: 'range(${1:4})',
    detail: 'Loop over integer range',
  },
  {
    label: 'grid',
    insertText: 'grid(${1:2}, ${2:2}, ${3:10})',
    detail: 'Loop over grid positions',
  },
  {
    label: 'radial',
    insertText: 'radial(${1:4}, ${2:0deg}, ${3:360deg})',
    detail: 'Loop over radial angles',
  },
  {
    label: 'enumerate',
    insertText: 'enumerate(${1:items})',
    detail: 'Loop with index and value',
  },
];
