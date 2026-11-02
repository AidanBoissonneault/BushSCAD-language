/**
 * @author Aidan Boissonneault
 * @file expression-semantics.test.ts
 * @purpose Tests expression semantics behavior in the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { evalBinaryValue } from '../../src/expressions/eval-binary.js';
import { evalErrorMessages } from '../core/test-support.js';

describe('expression equality and truthiness', () => {
  it('uses strict equality without empty-value coercion', () => {
    expect(evalBinaryValue('==', [], '', 0)).toBe(false);
    expect(evalBinaryValue('!=', [], '', 0)).toBe(true);
    expect(evalBinaryValue('==', 0, false, 0)).toBe(false);
    expect(evalBinaryValue('==', '1', 1, 0)).toBe(false);
    expect(evalBinaryValue('==', '', false, 0)).toBe(false);
    expect(evalBinaryValue('==', Number.NaN, Number.NaN, 0)).toBe(false);
  });

  it('compares lists by identity instead of structure', () => {
    const values = [1];

    expect(evalBinaryValue('==', [], [], 0)).toBe(false);
    expect(evalBinaryValue('==', [1], [1], 0)).toBe(false);
    expect(evalBinaryValue('==', values, values, 0)).toBe(true);
  });

  it('treats every list as truthy and returns booleans from logical operators', () => {
    expect(evalBinaryValue('&&', [], true, 0)).toBe(true);
    expect(evalBinaryValue('||', [], false, 0)).toBe(true);
    expect(evalBinaryValue('&&', '', true, 0)).toBe(false);
    expect(evalBinaryValue('||', 0, false, 0)).toBe(false);
    expect(evalBinaryValue('&&', Number.NaN, true, 0)).toBe(false);
  });

  it('rejects non-numeric operands for arithmetic, ordering, and negation', () => {
    expect(evalErrorMessages("var sum = '2' + 3;")).toContain(
      "Operator '+' requires numeric operands",
    );
    expect(evalErrorMessages("var ordered = '12' < '3';")).toContain(
      "Operator '<' requires numeric operands",
    );
    expect(evalErrorMessages("var negative = -'5';")).toContain(
      "Unary '-' requires a numeric operand",
    );
  });

  it('rejects non-finite numeric results in geometry dimensions', () => {
    expect(
      evalErrorMessages(
        'base_unit = mm; part p { sketch hole = circle(1 % 0); obj hole = extrude(hole, 1); }',
      ),
    ).toContain('Expected a finite number, got number');
  });
});
