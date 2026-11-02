/**
 * @author Aidan Boissonneault
 * @file path-segment-names.ts
 * @purpose Provides path segment names behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { PathItem } from '@bushscad/ir';
import { compactPathItemSegmentNames } from '@bushscad/ir';

/**
 * Collects resolver-visible path segment names with duplicate suffixing.
 * The evaluator can suffix duplicate path edge names, so the resolver must use
 * the same name set for constraint and face-reference validation.
 */
export function collectPathSegmentNames(items: PathItem[]): Set<string> {
  return new Set(compactPathItemSegmentNames(items).flat());
}
