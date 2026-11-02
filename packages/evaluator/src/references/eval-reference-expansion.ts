/**
 * @author Aidan Boissonneault
 * @file eval-reference-expansion.ts
 * @purpose Evaluates reference expansion for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  FaceRef,
  FaceRefSegment,
  RepeatableFaceRef,
  RepeatableSpatialRef,
  SpatialRef,
} from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { isFaceRefValue } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import {
  knownReferenceExists,
  knownReferenceLabels,
} from './eval-reference-catalog.js';

/**
 * Selector option, including display value and span.
 */
interface SelectorOption {
  value: string;
  span: FaceRefSegment['span'];
}

/**
 * Expands a face reference using both syntax groups and selector variables.
 * `var sides = [top, bottom]; @body.sides.edges` must repeat exactly like
 * `@body.[top, bottom].edges`, but only the evaluator has variable values.
 */
export function expandFaceRefForEval(ref: FaceRef, ctx: EvalCtx): FaceRef[] {
  const chains = expandSegmentsForEval(ref.chain, ctx);
  return chains.map((chain) => ({ ...ref, chain }));
}

/**
 * Expands repeatable face ref for eval into its concrete entries.
 */
export function expandRepeatableFaceRefForEval(
  ref: RepeatableFaceRef,
  ctx: EvalCtx,
): FaceRef[] {
  if (ref.kind === 'faceRef') return expandFaceRefForEval(ref, ctx);
  return ref.items.flatMap((item) =>
    expandFaceRefForEval(
      { ...item, chain: [...item.chain, ...ref.suffix] },
      ctx,
    ),
  );
}

/**
 * Expands repeatable spatial ref for eval into its concrete entries.
 */
export function expandRepeatableSpatialRefForEval(
  ref: RepeatableSpatialRef,
  ctx: EvalCtx,
): SpatialRef[] {
  if (ref.kind === 'faceRef' || ref.kind === 'faceRefList') {
    return expandRepeatableFaceRefForEval(ref, ctx);
  }
  if (Array.isArray(ref.anchor)) return [ref];
  return expandFaceRefForEval(ref.anchor, ctx).map((anchor) => ({
    ...ref,
    anchor,
  }));
}

/**
 * Expands segments for eval into its concrete entries.
 */
function expandSegmentsForEval(
  segments: FaceRefSegment[],
  ctx: EvalCtx,
): FaceRefSegment[][] {
  let chains: FaceRefSegment[][] = [[]];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    const next = segments[i + 1];
    const indexed = next?.kind === 'index' ? next : null;
    if (segment.kind === 'wildcard') {
      const remaining = segments.slice(i + 1);
      chains = chains.flatMap((chain) => {
        const options = wildcardOptionsForChain(
          chain,
          remaining,
          ctx,
          segment.span,
        );
        if (options.length === 0) {
          addError(
            ctx,
            `Wildcard selector did not match any valid references`,
            segment.span,
          );
        }
        return options.map((value): FaceRefSegment[] => [
          ...chain,
          {
            kind: 'name',
            value,
            span: segment.span,
            expandedFrom: segment.span,
          },
        ]);
      });
      continue;
    }
    const options = segmentOptionsForEval(segment, ctx, indexed);
    if (indexed) i++;
    if (options) {
      chains = chains.flatMap((chain) =>
        options.map((option): FaceRefSegment[] => [
          ...chain,
          ...segmentsFromOption(option.value, option.span),
        ]),
      );
    } else {
      chains = chains.map((chain) => [...chain, segment]);
    }
  }
  return chains;
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentOptionsForEval(
  segment: FaceRefSegment,
  ctx: EvalCtx,
  index: Extract<FaceRefSegment, { kind: 'index' }> | null,
): SelectorOption[] | null {
  if (segment.kind === 'group')
    return pickIndexedOptions(
      segment.options.map((value, optionIndex) => ({
        value,
        span: segment.memberSpans[optionIndex] ?? segment.span,
      })),
      index,
      ctx,
    );
  if (segment.kind !== 'name') return null;
  return pickIndexedOptions(
    selectorOptionsFromValue(ctx.values.get(segment.value), segment.span),
    index,
    ctx,
  );
}

/**
 * Handles selector options from value in the references flow.
 */
function selectorOptionsFromValue(
  value: EvalValue | undefined,
  span: FaceRefSegment['span'],
): SelectorOption[] | null {
  if (typeof value === 'string') return [{ value, span }];
  if (isFaceRefValue(value)) return [{ value: value.label, span }];
  if (!Array.isArray(value)) return null;
  const options: SelectorOption[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      options.push({ value: item, span });
    } else if (isFaceRefValue(item)) {
      options.push({ value: item.label, span });
    } else {
      return null;
    }
  }
  return options.length > 0 ? options : null;
}

/**
 * Handles pick indexed options in the references flow.
 */
function pickIndexedOptions(
  options: SelectorOption[] | null,
  index: Extract<FaceRefSegment, { kind: 'index' }> | null,
  ctx: EvalCtx,
): SelectorOption[] | null {
  if (!index) return options;
  if (!options) {
    addError(ctx, `Cannot index a non-array reference`, index.span);
    return null;
  }
  if (index.value < 0 || index.value >= options.length) {
    addError(
      ctx,
      `Reference index ${index.value} is out of range for array of length ${options.length}`,
      index.span,
    );
    return [];
  }
  const option = options[index.value];
  return option ? [option] : [];
}

/**
 * Finds valid one-segment continuations for a wildcard at the current prefix.
 * Wildcards are source-level sugar over existing labels. Matching candidates
 * against the remaining suffix here ensures `@body.*.top.edges` only keeps
 * entries where the complete reference is known to be valid.
 */
function wildcardOptionsForChain(
  chain: FaceRefSegment[],
  remaining: FaceRefSegment[],
  ctx: EvalCtx,
  wildcardSpan: FaceRefSegment['span'],
): string[] {
  const prefix = concreteParts(chain, ctx);
  const options = new Set<string>();
  for (const label of knownReferenceLabels(ctx)) {
    const parts = label.split('.').filter(Boolean);
    if (!isPrefix(prefix, parts) || parts.length <= prefix.length) continue;
    const option = parts[prefix.length];
    if (!option) continue;
    const candidate = [
      ...chain,
      {
        kind: 'name' as const,
        value: option,
        span: wildcardSpan,
        expandedFrom: wildcardSpan,
      },
    ];
    if (referenceTailCanMatch(candidate, remaining, ctx)) options.add(option);
  }
  return [...options];
}

/**
 * Resolves the reference against its owning declaration.
 */
function referenceTailCanMatch(
  prefix: FaceRefSegment[],
  remaining: FaceRefSegment[],
  ctx: EvalCtx,
): boolean {
  if (remaining.length === 0)
    return knownReferenceExists(concreteParts(prefix, ctx), ctx);
  const [segment, next, ...restAfterNext] = remaining;
  if (!segment) return knownReferenceExists(concreteParts(prefix, ctx), ctx);

  if (segment.kind === 'wildcard') {
    return (
      wildcardOptionsForChain(prefix, remaining.slice(1), ctx, segment.span)
        .length > 0
    );
  }

  const indexed = next?.kind === 'index' ? next : null;
  const options = segmentOptionsForEval(segment, ctx, indexed);
  const rest = indexed ? restAfterNext : remaining.slice(1);
  if (options) {
    return options.some((option) =>
      referenceTailCanMatch(
        [...prefix, ...segmentsFromOption(option.value, option.span)],
        rest,
        ctx,
      ),
    );
  }
  if (segment.kind === 'index') return referenceTailCanMatch(prefix, rest, ctx);
  return referenceTailCanMatch([...prefix, segment], rest, ctx);
}

/**
 * Handles concrete parts in the references flow.
 */
function concreteParts(chain: FaceRefSegment[], ctx: EvalCtx): string[] {
  return chain.flatMap((segment, index) => {
    if (segment.kind === 'name') {
      return [
        index === 0
          ? (ctx.names.get(segment.value) ?? segment.value)
          : segment.value,
      ];
    }
    if (segment.kind === 'call') return [segment.name, segment.arg];
    if (segment.kind === 'edgeIntersection') return [];
    if (segment.kind === 'wildcard' || segment.kind === 'index') return [];
    return segment.options;
  });
}

/**
 * Returns whether the input meets the `prefix` condition.
 */
function isPrefix(prefix: string[], parts: string[]): boolean {
  return prefix.every((part, index) => parts[index] === part);
}

/**
 * Handles segments from option in the references flow.
 */
function segmentsFromOption(
  option: string,
  span: FaceRefSegment['span'],
): FaceRefSegment[] {
  return option
    .split('.')
    .filter((part) => part.length > 0)
    .map((value) => ({ kind: 'name', value, span, expandedFrom: span }));
}
