/**
 * @author Aidan Boissonneault
 * @file fit-help.ts
 * @purpose Provides fit help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

const kinds: Record<string, string> = {
  slip: 'A light-clearance fit intended for sliding assembly.',
  press: 'An interference fit intended to require insertion force.',
  interference: 'A stronger interference-fit intent than the press preset.',
};
const levels: Record<string, string> = {
  normal: "Uses the active process profile's standard tolerance offset.",
  tight: "Uses the active process profile's tight tolerance offset.",
  loose: "Uses the active process profile's loose tolerance offset.",
};

/** Manufacturing intent remains distinct from measured post-build geometry. */
export const fitHelp: Record<string, LanguageHelpEntry> = {
  fit: {
    summary:
      'Declares a named manufacturing fit relation and resolves its tolerance offset from a process profile.',
    signatures: [
      'fit(kind, name, through | into, target, tolerance?);',
      'fit(kind: kind, name: name, relation: into, target: target, tolerance: tight);',
    ],
    parameters: [
      {
        name: 'kind',
        description: 'clearance, slip, press, interference, loose, or tight.',
      },
      {
        name: 'name, target',
        description: 'Authored identifiers describing the fit and its target.',
      },
      { name: 'tolerance', description: 'normal (default), tight, or loose.' },
    ],
    behavior: [
      'Use a std process profile to choose offsets; the default is FDM. An env override named <fitName>_clearance takes precedence. Fit intent alone is not proof that the resulting geometry satisfies the relation; use fit_ok in an assertion.',
    ],
    examples: [
      'use std.printing.fdm;\nfit(clearance, bolt, through, mounting_hole, normal);',
    ],
    related: ['fit_ok', 'use', 'tolerance', 'clearance'],
  },
  fit_ok: {
    summary:
      'Expands a named fit relation into a post-build geometric assertion.',
    signatures: ['fit_ok(fit_name, target_name)'],
    parameters: [
      {
        name: 'fit_name, target_name',
        description: 'Identifiers matching a previously declared fit.',
      },
    ],
    behavior: [
      'Uses the resolved offset and distance/clearance query selected for the fit kind. It inherits current query limitations, including unsigned clearance; it is not a physical press-fit simulation.',
    ],
    examples: [
      "fit(clearance, bolt, through, bore);\nassert(fit_ok(bolt, bore), warning: 'Check clearance');",
    ],
    related: ['fit', 'distance', 'clearance', 'assert'],
  },
  into: {
    summary:
      'Marks a fit relation in which one item is inserted into its target.',
    signatures: ['fit(press, insert, into, boss, tight);'],
    behavior: [
      'Used for press/interference-style intent. It is a fit argument, not a boolean operation or placement command.',
    ],
    examples: ['fit(press, insert, into, boss, tight);'],
    related: ['fit', 'through'],
  },
  tolerance: {
    summary:
      'Selects a manufacturing fit level or supplies a repair tolerance, depending on the command.',
    signatures: [
      'fit(kind, name, into, target, tolerance: tight);',
      'heal shape tolerance: distance;',
    ],
    behavior: [
      'Fit tolerance is a symbolic level in the active process table. A heal tolerance is a numeric geometric distance. Do not substitute one for the other.',
    ],
    examples: ['fit(press, insert, into, boss, tolerance: tight);'],
    related: ['fit', 'heal', 'normal', 'tight', 'loose'],
  },
  ...Object.fromEntries(
    Object.entries(kinds).map(([kind, summary]) => [
      kind,
      {
        summary,
        signatures: [`fit(${kind}, name, into, target, tolerance?);`],
        behavior: [
          'The active process profile and optional env override determine the actual offset. A fit declaration records intent; use a supported assertion to check the built geometry.',
        ],
        examples: [
          `use std.printing.fdm;\nfit(${kind}, insert, into, boss, normal);`,
        ],
        related: ['fit', 'fit_ok', 'tolerance'],
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(levels).map(([level, summary]) => [
      level,
      {
        summary,
        signatures: [`fit(kind, name, into, target, ${level});`],
        behavior: [
          'Offsets depend on the active manufacturing process and fit kind. tight and loose can also name fit kinds; the argument position determines their meaning.',
          ...(level === 'normal'
            ? [
                'As a face property, body.face.normal is a direction vector; it is unrelated to the fit level.',
              ]
            : []),
        ],
        examples: [`fit(press, insert, into, boss, ${level});`],
        related: ['fit', 'tolerance', 'this'],
      },
    ]),
  ),
};
