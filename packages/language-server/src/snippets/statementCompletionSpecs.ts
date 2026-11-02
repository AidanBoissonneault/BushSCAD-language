/**
 * @author Aidan Boissonneault
 * @file statementCompletionSpecs.ts
 * @purpose Provides statement completion specs behavior for the snippets in language server package.
 * @last-edited October 6, 2026
 */

export const BUSHSCAD_STATEMENT_COMPLETION_SPECS = [
  {
    label: 'extrude',
    insertText: 'extrude(${1:rect(60, 40)}, ${2:10})',
    detail: 'Extrude a named or inline sketch',
  },
  {
    label: 'cut',
    insertText:
      'cut(${1:circle(4)}, through ${2:base}, @${3:base.top}(10, 10))',
    detail: 'Cut with named or inline sketch input',
  },
  {
    label: 'revolve',
    insertText: 'revolve(${1:profile}, ${2:360deg} around ${3:y})',
    detail: 'Revolve a closed profile sketch',
  },
  {
    label: 'radial_extrude',
    insertText:
      'radial_extrude(${1:profile}, from: ${2:base.top.center}, angle: ${3:90}, length: ${4:20})',
    detail: 'Sweep a sketch around an inferred or explicit axis',
  },
  {
    label: 'radial_cut',
    insertText:
      'radial_cut(${1:profile}, from: ${2:base.top.center}, to: ${3:base.front}, along: ${4:bend_path})',
    detail: 'Subtract a swept profile from a host body',
  },
  {
    label: 'cubic-bezier',
    insertText: 'cubic-bezier(${1:0.4}, ${2:0}, ${3:0.2}, ${4:1})',
    detail: 'Custom CSS-style easing for radial curve',
  },
  {
    label: 'loft',
    insertText: 'loft(${1:base}, ${2:top}, height: ${3:40}, guide: ${4:rail})',
    detail: 'Loft through named or inline closed profile sketches',
  },
  {
    label: 'wrap',
    insertText: 'wrap: ${1|true,false|}',
    detail: 'Wrap cut/extrude on a cylindrical .curved target',
  },
  {
    label: 'fillet',
    insertText: 'fillet(@${1:target.top.edges}, ${2:1});',
    detail: 'Round selected edges',
  },
  {
    label: 'chamfer',
    insertText: 'chamfer(@${1:target.bottom.edges}, ${2:0.5});',
    detail: 'Bevel selected edges',
  },
  {
    label: 'shell',
    insertText: 'shell: ${1:body} ${2:2} open: ${3:top};',
    detail: 'Hollow a body',
  },
  {
    label: 'draft',
    insertText: 'draft: ${1:target} ${2:2deg};',
    detail: 'Apply draft angle',
  },
  {
    label: 'rotate',
    insertText: 'rotate ${1:target} ${2:90deg} around ${3:z};',
    detail: 'Rotate an existing object',
  },
];
