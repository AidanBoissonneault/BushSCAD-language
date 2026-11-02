/**
 * @author Aidan Boissonneault
 * @file sketch-component-selection.ts
 * @purpose Provides sketch component selection behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { FaceRef } from '@bushscad/ir';
import type { State } from '../core/types.js';

/**
 * Resolved sketch component member, including owner, component path, member, and member path.
 */
export type ResolvedSketchComponentMember = {
  owner: string;
  componentPath: readonly string[];
  member: string;
  memberPath: string;
};

/** Matches a reference suffix against component members registered by `as`. */
export function resolvedSketchComponentMember(
  ref: FaceRef,
  state: State,
): ResolvedSketchComponentMember | null {
  const names = referenceNames(ref);
  if (!names || names.length < 3) return null;
  const owner = names[0]!;
  const memberPath = names.slice(1).join('.');
  if (!state.objectProfileSegments.get(owner)?.has(memberPath)) return null;
  return {
    owner,
    componentPath: names.slice(1, -1),
    member: names.at(-1)!,
    memberPath,
  };
}

/** Detects a known component followed by an invalid member path. */
export function unresolvedSketchComponentPath(
  ref: FaceRef,
  state: State,
): { owner: string; component: string; member: string } | null {
  const names = referenceNames(ref);
  if (!names || names.length < 3) return null;
  const owner = names[0]!;
  const component = names[1]!;
  const members = state.objectProfileSegments.get(owner);
  if (![...(members ?? [])].some((name) => name.startsWith(`${component}.`))) {
    return null;
  }
  return { owner, component, member: names.slice(2).join('.') };
}

/**
 * Resolves the reference against its owning declaration.
 */
function referenceNames(ref: FaceRef): string[] | null {
  const names: string[] = [];
  for (const segment of ref.chain) {
    if (segment.kind !== 'name') return null;
    names.push(segment.value);
  }
  return names;
}
