/**
 * @author Aidan Boissonneault
 * @file validationSnippets.ts
 * @purpose Provides validation snippets behavior for the snippets in language server package.
 * @last-edited October 6, 2026
 */

export const BUSHSCAD_VALIDATION_SNIPPETS = [
  {
    label: 'assert',
    insertText: 'assert(${1:condition});',
    detail: 'Design assertion',
  },
  {
    label: 'assert warning',
    insertText: "assert(${1:condition}, warning: '${2:message}');",
    detail: 'Warning assertion',
  },
  {
    label: 'assert face_area',
    insertText: 'assert(face_area(${1:obj.top}) >= ${2:100});',
    detail: 'Assert face area',
  },
  {
    label: 'assert volume',
    insertText: 'assert(volume(${1:obj}) >= ${2:1000});',
    detail: 'Assert volume',
  },
  {
    label: 'assert wall_thickness',
    insertText: 'assert(wall_thickness(${1:obj}) >= ${2:2.0});',
    detail: 'Assert wall thickness',
  },
  {
    label: 'assert clearance',
    insertText:
      "assert(clearance(${1:a}, ${2:b}) >= ${3:0.3}, warning: '${4:Parts may interfere}');",
    detail: 'Assert clearance',
  },
  {
    label: 'assert fit_ok',
    insertText:
      "assert(fit_ok(${1:fit_name}, ${2:target_name}), warning: '${3:Fit not satisfied}');",
    detail: 'Assert a fit declaration',
  },
];
