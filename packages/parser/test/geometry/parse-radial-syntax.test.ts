/**
 * @author Aidan Boissonneault
 * @file parse-radial-syntax.test.ts
 * @purpose Tests parse radial syntax behavior in the geometry in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/index.js';
import type { ObjDecl, RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';

/**
 * Handles radial op in the geometry flow.
 */
function radialOp(source: string): RadialExtrudeOp | RadialCutOp {
  const parsed = parse(source, 'radial.bscd');
  expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0);
  const part = parsed.ast.statements.find((stmt) => stmt.kind === 'part');
  if (!part || part.kind !== 'part') throw new Error('part not parsed');
  const obj = part.body.statements.find(
    (stmt) => stmt.kind === 'obj',
  ) as ObjDecl;
  return obj.operation as RadialExtrudeOp | RadialCutOp;
}

describe('simplified radial syntax', () => {
  it('accepts inferred-axis radial_extrude , @placement', () => {
    const op = radialOp(`
part p {
  sketch s = rect(1, 1);
  obj o = radial_extrude(s, from: base.top.center, angle: 90, length: 10);
}
`);
    expect(op.kind).toBe('radial_extrude');
    expect(op.axis).toBeNull();
    expect(op.extent.kind).toBe('angle-length');
  });

  it('accepts placement bridge radial_cut', () => {
    const op = radialOp(`
part p {
  sketch s = rect(1, 1);
  obj o = radial_cut(s, from: body.outer, to: body.inner, along: bend_path);
}
`);
    expect(op.kind).toBe('radial_cut');
    expect(op.extent.kind).toBe('placement-bridge');
    if (op.extent.kind === 'placement-bridge') {
      expect(op.extent.along).toBe('bend_path');
    }
  });

  it('accepts placement bridge radial_extrude without along', () => {
    const op = radialOp(`
part p {
  sketch s = rect(1, 1);
  obj o = radial_extrude(s, from: body.left.center, to: body.right.center, curve: ease-in-out);
}
`);
    expect(op.kind).toBe('radial_extrude');
    expect(op.extent.kind).toBe('placement-bridge');
    if (op.extent.kind === 'placement-bridge') {
      expect(op.extent.along).toBeNull();
    }
    expect(op.curve.kind).toBe('ease-in-out');
  });

  it('accepts auto guided surface-to-surface radial_cut without along', () => {
    const op = radialOp(`
part p {
  sketch s = rect(1, 1);
  obj o = radial_cut(s, from: body.top, to: body.front, curve: ease-in-out);
}
`);
    expect(op.kind).toBe('radial_cut');
    expect(op.extent.kind).toBe('placement-bridge');
    if (op.extent.kind === 'placement-bridge') {
      expect(op.extent.along).toBeNull();
    }
    expect(op.curve.kind).toBe('ease-in-out');
  });

  it('still rejects radial ops without axis or inferable placement', () => {
    const parsed = parse(
      'part p { sketch s = rect(1, 1); obj o = radial_extrude(s, angle: 90, length: 10); }',
      'radial.bscd',
    );
    expect(
      parsed.errors.some((error) => /axis.*from/i.test(error.message)),
    ).toBe(true);
  });
});
