/**
 * @author Aidan Boissonneault
 * @file blend-diagnostics.ts
 * @purpose Provides blend diagnostics behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  BlendModifierKind,
  EdgeSelection,
} from '../bridge/bridge-types.js';
import { safeCall } from '../core/occt-errors.js';
import { sameModifierValue } from './modifier-classification.js';

/**
 * Handles describe blend phase failure in the operations flow.
 */
export function describeBlendPhaseFailure(
  kind: BlendModifierKind,
  owner: string,
  selections: EdgeSelection[],
  detail: string,
): string {
  const label = kind === 'fillet' ? 'Fillet' : 'Chamfer';
  return `${label} phase failed for body '${owner}': ${selections.length} selected edge(s); targets: ${formatModifierTargets(selections)}. ${detail}`;
}

/**
 * Handles describe fillet failure in the operations flow.
 */
export function describeFilletFailure(
  filler: {
    NbFaultyContours?: () => number;
    NbFaultyVertices?: () => number;
    HasResult?: () => boolean;
  },
  selections: EdgeSelection[],
): string {
  const faultyContours = safeCall(() => filler.NbFaultyContours?.()) ?? 0;
  const faultyVertices = safeCall(() => filler.NbFaultyVertices?.()) ?? 0;
  const hasResult = safeCall(() => filler.HasResult?.()) ?? false;

  if (faultyContours > 0 || faultyVertices > 0 || !hasResult) {
    return describeBlendRejection('fillet', selections);
  }

  return `${modifierValueSummary('fillet', selections)} could not be applied to the selected edges; use a radius smaller than nearby wall thickness or edge spacing`;
}

/**
 * Handles describe blend exception in the operations flow.
 */
export function describeBlendException(
  kind: BlendModifierKind,
  selections: EdgeSelection[],
  err: unknown,
): string {
  const raw = err instanceof Error ? err.message : String(err);
  return `${describeBlendRejection(kind, selections)} (OCCT: ${raw})`;
}

/**
 * Handles describe blend rejection in the operations flow.
 */
export function describeBlendRejection(
  kind: BlendModifierKind,
  selections: EdgeSelection[],
): string {
  const noun = kind === 'fillet' ? 'fillets' : 'chamfers';
  const guidance =
    kind === 'fillet'
      ? '; use a radius smaller than nearby wall thickness or edge spacing'
      : '; use an offset smaller than nearby wall thickness or edge spacing';
  return `${modifierValueSummary(kind, selections)} creates overlapping or invalid ${noun} on the selected edges${guidance}`;
}

/**
 * Converts the supplied value into readable conflicting blend text.
 */
export function conflictingBlendMessage(
  kind: BlendModifierKind,
  owner: string,
  existing: EdgeSelection,
  target: string,
  value: number,
): string {
  const valueName = kind === 'fillet' ? 'radii' : 'offsets';
  return `Conflicting ${kind} ${valueName} for the same edge on body '${owner}': '${existing.target}' uses ${existing.value}, '${target}' uses ${value}`;
}

/**
 * Handles modifier value summary in the operations flow.
 */
function modifierValueSummary(
  kind: BlendModifierKind,
  selections: EdgeSelection[],
): string {
  const values = uniqueNumbers(
    selections.map((selection) => selection.value),
  ).join(', ');
  if (kind === 'fillet') {
    return selections.length === 1 || !values.includes(',')
      ? `Fillet failed: radius ${values}`
      : `Fillet failed: radii ${values}`;
  }
  return selections.length === 1 || !values.includes(',')
    ? `Chamfer failed: offset ${values}`
    : `Chamfer failed: offsets ${values}`;
}

/**
 * Removes duplicate numbers values while preserving their first occurrence.
 */
function uniqueNumbers(values: number[]): number[] {
  const unique: number[] = [];
  for (const value of values) {
    if (!unique.some((existing) => sameModifierValue(existing, value))) {
      unique.push(value);
    }
  }
  return unique;
}

/**
 * Formats modifier targets for display or serialization.
 */
function formatModifierTargets(selections: EdgeSelection[]): string {
  const seen = new Set<string>();
  const formatted: string[] = [];
  for (const selection of selections) {
    const key = `${selection.target}:${selection.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    formatted.push(`'${selection.target}'=${selection.value}`);
  }
  return formatted.join(', ');
}
