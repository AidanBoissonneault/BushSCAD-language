/**
 * @author Aidan Boissonneault
 * @file jointSnippets.ts
 * @purpose Provides joint snippets behavior for the snippets in language server package.
 * @last-edited October 6, 2026
 */

const JOINT_KINDS = [
  { kind: 'fixed', range: null },
  { kind: 'revolute', range: ['0deg', '120deg'] },
  { kind: 'slider', range: ['0mm', '80mm'] },
  { kind: 'planar', range: ['0mm', '80mm'] },
  { kind: 'ball', range: ['0deg', '120deg'] },
] as const;

/** Provides one compact type-led declaration completion for every joint kind. */
export const BUSHSCAD_JOINT_SNIPPETS = JOINT_KINDS.map(({ kind, range }) => ({
  label: `${kind} joint`,
  insertText: range
    ? `${kind} \${1:name}(@\${2:moving.reference}, @\${3:support.reference}) {\n\trange = \${4:${range[0]}}..\${5:${range[1]}};\n\tdefault = \${6:${range[0]}};\n}`
    : `${kind} \${1:name}(@\${2:moving.reference}, @\${3:support.reference}) {}`,
  detail: `Declare a ${kind} relationship between two parts`,
}));
