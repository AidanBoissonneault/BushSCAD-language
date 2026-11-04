import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

describe('argument label overloads', () => {
  it('keeps the first loft height and reports duplicate labels', () => {
    const result = parse(
      'obj body = loft(first, second, height: 10, height: 20);',
      'test.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      "loft() got duplicate argument 'height'",
    );
    expect(result.ast.statements[0]).toMatchObject({
      kind: 'obj',
      operation: { kind: 'loft', height: { kind: 'number', value: 10 } },
    });
  });

  it('keeps the first sweep orientation when positional and labeled forms repeat it', () => {
    const result = parse(
      'obj swept = sweep(rect(4, 2) along polyline([(0, 0, 0), (0, 0, 10)]), fixed, orientation: binormal);',
      'test.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      "sweep() got duplicate argument 'orientation'",
    );
    expect(result.ast.statements[0]).toMatchObject({
      kind: 'obj',
      operation: { kind: 'sweep', orientation: 'fixed' },
    });
  });
});
