import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import type { ComponentBody } from '@bushscad/ir';
import type { BodyNameFacts } from '../../src/core/eval-types.js';
import { analyzeBodyNames } from '../../src/statements/eval-body-name-walk.js';

describe('evaluator body-name analysis', () => {
  it('preserves declaration order and reuses facts for one AST body', () => {
    const parsed = parse(
      `part plate {
        sketch profile = circle(4);
        obj body = extrude(profile, 2);
        for i in range(2) {
          if true {
            obj nested = extrude(profile, 2);
            obj body = extrude(profile, 2);
          }
        }
      }`,
      'body-names.bscd',
    );
    const part = parsed.ast.statements.find((stmt) => stmt.kind === 'part');
    expect(parsed.errors).toEqual([]);
    expect(part?.kind).toBe('part');
    if (part?.kind !== 'part') return;

    const cache = new WeakMap<ComponentBody, BodyNameFacts>();
    const facts = analyzeBodyNames(part.body, cache);

    expect(facts.localNames).toEqual(['profile', 'body', 'nested']);
    expect(facts.objectNames).toEqual(['body', 'nested']);
    expect(analyzeBodyNames(part.body, cache)).toBe(facts);
  });
});
