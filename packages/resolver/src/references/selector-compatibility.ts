/**
 * @author Aidan Boissonneault
 * @file selector-compatibility.ts
 * @purpose Provides selector compatibility behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { ResolvedSelectorKind } from '@bushscad/ir';

/**
 * Type used for selector kind.
 */
export type SelectorKind = ResolvedSelectorKind;

export const SELECTOR_KINDS = [
  'bare-object',
  'sketch-boundary',
  'face',
  'face-point',
  'face-perimeter',
  'face-edges',
  'named-edge',
  'edge-intersection',
  'named-corner',
  'object-perimeter',
  'object-edges',
  'expanded-selection',
] as const satisfies readonly SelectorKind[];

export const SELECTOR_CONSUMERS = [
  'fill',
  'placement',
  'sketch-on-surface',
  'fillet',
  'chamfer',
  'draft',
  'revolve-axis',
  'measurement',
  'selection-highlight',
] as const;

/**
 * Derives `SelectorConsumer` from `(typeof SELECTOR_CONSUMERS)[number]` to preserve its type
 * relationship in the references layer.
 */
export type SelectorConsumer = (typeof SELECTOR_CONSUMERS)[number];

/**
 * Accepted values for selector consumption are 'preserve-face-wires', 'bind-to-face-surface',
 * 'use-outer-loop', 'rebuild-classified-loops', 'require-closed-loop', 'derive-face-anchor',
 * 'use-point-anchor', 'derive-edge-anchor', 'use-vertex-anchor', 'derive-boundary-edges',
 * 'infer-object-edges', 'use-selected-edges', 'use-incident-edges', 'use-selected-faces',
 * 'derive-face-axis', 'use-edge-axis', 'measure-by-query', 'preserve-selection',
 * 'validate-one-expanded-member', 'repeat-expanded-members', and
 * 'validate-query-expanded-members'.
 */
export type SelectorConsumption =
  | 'preserve-face-wires'
  | 'bind-to-face-surface'
  | 'use-outer-loop'
  | 'rebuild-classified-loops'
  | 'require-closed-loop'
  | 'derive-face-anchor'
  | 'use-point-anchor'
  | 'derive-edge-anchor'
  | 'use-vertex-anchor'
  | 'derive-boundary-edges'
  | 'infer-object-edges'
  | 'use-selected-edges'
  | 'use-incident-edges'
  | 'use-selected-faces'
  | 'derive-face-axis'
  | 'use-edge-axis'
  | 'measure-by-query'
  | 'preserve-selection'
  | 'validate-one-expanded-member'
  | 'repeat-expanded-members'
  | 'validate-query-expanded-members';

/**
 * Lookup from SelectorKind keys to Record<SelectorConsumer, SelectorConsumption | null> values.
 */
export type SelectorConsumerCompatibilityTable = Record<
  SelectorKind,
  Record<SelectorConsumer, SelectorConsumption | null>
>;

/**
 * Optional fields from Record<SelectorKind, SelectorConsumption> used for consumer policy.
 */
type ConsumerPolicy = Partial<Record<SelectorKind, SelectorConsumption>>;

const EDGE_MODIFIER_POLICY = {
  'bare-object': 'infer-object-edges',
  face: 'derive-boundary-edges',
  'face-perimeter': 'use-selected-edges',
  'face-edges': 'use-selected-edges',
  'named-edge': 'use-selected-edges',
  'edge-intersection': 'use-selected-edges',
  'object-perimeter': 'use-selected-edges',
  'object-edges': 'use-selected-edges',
  'expanded-selection': 'repeat-expanded-members',
} satisfies ConsumerPolicy;

const CONSUMER_POLICIES: Record<SelectorConsumer, ConsumerPolicy> = {
  fill: {
    'sketch-boundary': 'require-closed-loop',
    face: 'preserve-face-wires',
    'face-perimeter': 'use-outer-loop',
    'face-edges': 'rebuild-classified-loops',
    'named-edge': 'require-closed-loop',
    'expanded-selection': 'validate-one-expanded-member',
  },
  placement: {
    face: 'derive-face-anchor',
    'face-point': 'use-point-anchor',
    'named-edge': 'derive-edge-anchor',
    'edge-intersection': 'derive-edge-anchor',
    'named-corner': 'use-vertex-anchor',
    'expanded-selection': 'repeat-expanded-members',
  },
  'sketch-on-surface': {
    face: 'bind-to-face-surface',
    'expanded-selection': 'validate-one-expanded-member',
  },
  fillet: EDGE_MODIFIER_POLICY,
  chamfer: {
    ...EDGE_MODIFIER_POLICY,
    'named-corner': 'use-incident-edges',
  },
  draft: {
    face: 'use-selected-faces',
    'expanded-selection': 'repeat-expanded-members',
  },
  'revolve-axis': {
    face: 'derive-face-axis',
    'face-point': 'derive-face-axis',
    'named-edge': 'use-edge-axis',
    'edge-intersection': 'use-edge-axis',
    'expanded-selection': 'validate-one-expanded-member',
  },
  measurement: policyForEverySelector(
    'measure-by-query',
    'validate-query-expanded-members',
  ),
  'selection-highlight': policyForEverySelector(
    'preserve-selection',
    'repeat-expanded-members',
  ),
};

/**
 * Defines how every released selector form is consumed by every selector slot.
 * The parser, resolver, evaluator, and OCCT bridge must not independently guess
 * whether a face, loop, edge, vertex, object, or expanded union is acceptable.
 * The consumer policies remove repeated rules while this generated table keeps
 * every invalid null cell and topology-preserving conversion explicit at use.
 */
export const SELECTOR_CONSUMER_COMPATIBILITY = buildCompatibilityTable();

/** Creates a complete policy while preserving a distinct expansion action. */
function policyForEverySelector(
  action: SelectorConsumption,
  expandedAction: SelectorConsumption,
): ConsumerPolicy {
  return Object.fromEntries(
    SELECTOR_KINDS.map((selector) => [
      selector,
      selector === 'expanded-selection' ? expandedAction : action,
    ]),
  ) as ConsumerPolicy;
}

/** Transposes consumer policies into the selector-first runtime lookup table. */
function buildCompatibilityTable(): SelectorConsumerCompatibilityTable {
  return Object.fromEntries(
    SELECTOR_KINDS.map((selector) => [
      selector,
      Object.fromEntries(
        SELECTOR_CONSUMERS.map((consumer) => [
          consumer,
          CONSUMER_POLICIES[consumer][selector] ?? null,
        ]),
      ),
    ]),
  ) as SelectorConsumerCompatibilityTable;
}

const SELECTOR_LABELS: Record<SelectorKind, string> = {
  'bare-object': 'a bare object',
  'sketch-boundary': 'a closed sketch boundary',
  face: 'a face',
  'face-point': 'a face-derived point',
  'face-perimeter': 'a face perimeter',
  'face-edges': 'a face edge set',
  'named-edge': 'a named edge',
  'edge-intersection': 'an edge intersection',
  'named-corner': 'a named corner',
  'object-perimeter': 'an object perimeter',
  'object-edges': 'an object edge set',
  'expanded-selection': 'an expanded selector',
};

/** Returns the required consumption action, or null for an invalid cell. */
export function selectorConsumerCompatibility(
  selector: SelectorKind,
  consumer: SelectorConsumer,
): SelectorConsumption | null {
  return SELECTOR_CONSUMER_COMPATIBILITY[selector][consumer];
}

/**
 * Builds the resolver diagnostic for an invalid selector/consumer pairing.
 *
 * Compatible cells return null so callers can use this function directly at
 * the selector source span without duplicating acceptance lists or wording.
 */
export function selectorConsumerDiagnostic(
  selector: SelectorKind,
  consumer: SelectorConsumer,
): string | null {
  if (selectorConsumerCompatibility(selector, consumer) !== null) return null;
  const expected = SELECTOR_KINDS.filter(
    (kind) =>
      kind !== 'expanded-selection' &&
      selectorConsumerCompatibility(kind, consumer) !== null,
  ).map((kind) => SELECTOR_LABELS[kind]);
  return `${consumer} does not accept ${SELECTOR_LABELS[selector]}; expected ${formatExpected(expected)}`;
}

/**
 * Formats expected for display or serialization.
 */
function formatExpected(expected: string[]): string {
  if (expected.length === 1) return expected[0] ?? '';
  return `${expected.slice(0, -1).join(', ')}, or ${expected.at(-1)}`;
}
