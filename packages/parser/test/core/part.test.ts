/**
 * @author Aidan Boissonneault
 * @file part.test.ts
 * @purpose Tests part behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { PartDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parseOk } from '../fixtures/parse.js';

describe('parser — part', () => {
  it('parses part block', () => {
    const ast = parseOk(
      'part housing { sketch b = rect(80, 60); obj b = extrude(b, 40); }',
    );
    const p = ast.statements[0] as PartDecl;
    expect(p.kind).toBe('part');
    expect(p.name).toBe('housing');
    expect(p.body.statements).toHaveLength(2);
  });
});
