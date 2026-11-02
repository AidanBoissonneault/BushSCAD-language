/**
 * @author Aidan Boissonneault
 * @file eval-path-names.ts
 * @purpose Evaluates path names for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { PathSegmentItem } from '@bushscad/ir';
import { uniqueNameWithSuffix } from '@bushscad/ir';

/**
 * State for path name, including generated count and used names.
 */
type PathNameState = {
  generatedCount: number;
  usedNames: Set<string>;
};

/**
 * Returns the unique IR segment name for a path item.
 * Editor-generated sketches can contain multiple closed shapes whose default
 * edge labels repeat. The evaluator should preserve the first name and suffix
 * later duplicates instead of rejecting otherwise valid geometry.
 */
export function nextPathSegmentName(
  item: PathSegmentItem,
  state: PathNameState,
): string {
  const base = item.name ?? nextGeneratedName(state);
  const name = uniqueNameWithSuffix(base, state.usedNames);
  state.usedNames.add(name);
  return name;
}

/**
 * Handles next generated name in the sketch flow.
 */
function nextGeneratedName(state: PathNameState): string {
  state.generatedCount += 1;
  return `segment_${state.generatedCount}`;
}
