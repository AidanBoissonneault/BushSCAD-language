/**
 * @author Aidan Boissonneault
 * @file surface-declarations.test.ts
 * @purpose Tests surface declarations behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ObjDecl, SurfaceDecl, ThickenOp } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('surface declarations', () => {
  it('parses fill and offset_surface declarations', () => {
    const ast = parseOk(`
sketch profile = rect(20, 10);
surface cap = fill(profile);
surface offset_cap = offset_surface(cap, 2);
`);
    const fill = ast.statements[1] as SurfaceDecl;
    const offset = ast.statements[2] as SurfaceDecl;
    expect(fill.kind).toBe('surface');
    expect(fill.operation.kind).toBe('fill');
    if (fill.operation.kind === 'fill') {
      expect(faceChain(fill.operation.boundary)).toBe('profile');
    }
    expect(offset.operation.kind).toBe('offset_surface');
    if (offset.operation.kind === 'offset_surface') {
      expect(offset.operation.surface).toMatchObject({
        kind: 'namedSurface',
        name: 'cap',
      });
    }
  });

  it('parses thicken as an object operation', () => {
    const ast = parseOk(`
sketch profile = rect(20, 10);
surface cap = fill(profile);
obj solid_cap = thicken(cap, 1.5);
`);
    const obj = ast.statements[2] as ObjDecl;
    const op = obj.operation as ThickenOp;
    expect(op.kind).toBe('thicken');
    expect(op.surface).toMatchObject({ kind: 'namedSurface', name: 'cap' });
  });

  it('parses expanded fill selectors for singular validation', () => {
    const ast = parseOk('surface invalid = fill(@body.[top, bottom].edges);');
    const surface = ast.statements[0] as SurfaceDecl;

    expect(surface.operation).toMatchObject({
      kind: 'fill',
      boundary: { kind: 'faceRef' },
    });
    if (surface.operation.kind !== 'fill') return;
    expect(faceChain(surface.operation.boundary)).toBe(
      'body.[top,bottom].edges',
    );
  });
});
