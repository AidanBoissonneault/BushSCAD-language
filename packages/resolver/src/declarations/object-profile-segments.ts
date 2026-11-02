/**
 * @author Aidan Boissonneault
 * @file object-profile-segments.ts
 * @purpose Provides object profile segments behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { SketchInput } from '@bushscad/ir';
import type { State } from '../core/types.js';

/** Returns the owning sketch names represented by nested sketch operands. */
export function namedSketchInputs(inputs: SketchInput[]): string[] {
  return inputs.flatMap((input) => {
    if (input.kind === 'namedSketch') return [input.name];
    if (input.kind === 'namedSketchBody' || input.kind === 'sketchBodyList') {
      return [input.sketchName];
    }
    return input.kind === 'sketchList' ? namedSketchInputs(input.items) : [];
  });
}

/** Associates source profile segment names with a derived object. */
export function registerObjectProfileSegments(
  objName: string,
  sketchNames: string[],
  state: State,
): void {
  const names = new Set<string>();
  for (const sketchName of sketchNames) {
    const sketchSegments = state.profileSketchSegments.get(sketchName);
    if (!sketchSegments) continue;
    for (const name of sketchSegments) names.add(name);
  }
  if (names.size > 0) state.objectProfileSegments.set(objName, names);
}
