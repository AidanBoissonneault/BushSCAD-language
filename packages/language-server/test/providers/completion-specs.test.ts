import { describe, expect, it } from 'vitest';
import { contextualCompletionSpecs } from '../../src/providers/completion-specs.js';

describe('contextual completion specs', () => {
  it('offers the loop iterator snippets for loop contexts', () => {
    const labels = contextualCompletionSpecs('', '', 'loopIterator', []).map(
      (spec) => spec.label,
    );

    expect(labels).toEqual(['range', 'grid', 'radial', 'enumerate']);
  });

  it('filters target suggestions by the declaration kinds accepted in context', () => {
    const symbols = [
      {
        name: 'gear',
        kind: 'part' as const,
        detail: 'Part',
        uri: 'file:///main.bscd',
        range: {
          start: { line: 0, col: 0 },
          end: { line: 0, col: 4 },
        },
      },
      {
        name: 'profile',
        kind: 'sketch' as const,
        detail: 'Sketch',
        uri: 'file:///main.bscd',
        range: {
          start: { line: 0, col: 5 },
          end: { line: 0, col: 12 },
        },
      },
    ];

    expect(
      contextualCompletionSpecs('', '', 'fromTarget', symbols).map(
        (spec) => spec.label,
      ),
    ).toContain('gear');
    expect(
      contextualCompletionSpecs('', '', 'fromTarget', symbols).map(
        (spec) => spec.label,
      ),
    ).not.toContain('profile');
  });
});
