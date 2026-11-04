import { describe, expect, it } from 'vitest';
import type { CompileError } from '@bushscad/ir';
import { stringifyCliResult } from '../../src/dto/json.js';

describe('stringifyCliResult', () => {
  it('serializes Error-backed compile error messages', () => {
    const error = new Error('Unknown object for rotate') as Error &
      CompileError;
    error.span = { file: 'model.bscd', line: 40, col: 5 };

    expect(
      JSON.parse(
        stringifyCliResult({
          ok: false,
          errors: [error],
        }),
      ),
    ).toMatchObject({
      ok: false,
      errors: [
        {
          message: 'Unknown object for rotate',
          span: { file: 'model.bscd', line: 40, col: 5 },
        },
      ],
    });
  });
});
