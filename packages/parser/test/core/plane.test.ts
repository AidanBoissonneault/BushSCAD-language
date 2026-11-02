/**
 * @author Aidan Boissonneault
 * @file plane.test.ts
 * @purpose Tests plane behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { FaceRef, PlaneDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — plane', () => {
  it('parses named plane , @faceRef', () => {
    const ast = parseOk(
      'part plate { sketch b = rect(1,1); obj b = extrude(b,1); plane work = offset(10 , @b.top); }',
    );
    const c = component(ast, 'plate');
    const p = bodyStmt<PlaneDecl>(c, 'plane');
    expect(p.kind).toBe('plane');
    expect(p.name).toBe('work');
    expect(typeof p.from).toBe('object'); // FaceRef
  });

  it('parses named plane chained , @another plane', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); plane lvl1 = offset(5 , @b.top); plane lvl2 = offset(10 , @lvl1); }',
    );
    const c = component(ast, 'p');
    const planes = c.body.statements.filter(
      (s) => s.kind === 'plane',
    ) as PlaneDecl[];
    expect(planes).toHaveLength(2);
    expect(typeof planes[1].from).toBe('object'); // named plane ref as FaceRef
    expect(faceChain(planes[1].from as FaceRef)).toBe('lvl1');
  });
});
/**
 * Builds the body data required by the current operation.
 */
function bodyStmt<T>(
  decl: { name: string; body: { statements: { kind: string }[] } },
  kind: string,
  index?: number,
): T {
  const matches = decl.body.statements.filter((stmt) => stmt.kind === kind);
  const i = index ?? 0;
  if (!matches[i]) throw new Error(`No ${kind}[${i}] in '${decl.name}'`);
  return matches[i] as T;
}
