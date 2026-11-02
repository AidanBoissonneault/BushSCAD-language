/**
 * @author Aidan Boissonneault
 * @file drawing-blocks.test.ts
 * @purpose Tests drawing blocks behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { parseOk } from '../fixtures/parse.js';

describe('drawing blocks', () => {
  it('parses a full drawing block', () => {
    const ast = parseOk(`
      sketch s = rect(60, 40);
      obj base = extrude(s, 10);
      drawing plate {
        view base.top scale: 1;
        dimension base.width;
        export dxf './out/plate.dxf';
        export svg './out/plate.svg';
      }
    `);
    const drawing = ast.statements.find(
      (s) => s.kind === 'drawing',
    ) as import('@bushscad/ir').DrawingDecl;
    expect(drawing).toBeDefined();
    expect(drawing.name).toBe('plate');
    expect(drawing.view.objName).toBe('base');
    expect(drawing.view.face).toBe('top');
    expect(drawing.view.scale).toBe(1);
    expect(drawing.dimensions).toHaveLength(1);
    expect(drawing.dimensions[0].ref.kind).toBe('obj_extent');
    expect(drawing.exportDxfPath).toBe('./out/plate.dxf');
    expect(drawing.exportSvgPath).toBe('./out/plate.svg');
  });

  it('parses drawing view without scale (defaults to null)', () => {
    const ast = parseOk(`
      sketch s = rect(60, 40);
      obj base = extrude(s, 10);
      drawing d { view base.top; }
    `);
    const drawing = ast.statements.find(
      (s) => s.kind === 'drawing',
    ) as import('@bushscad/ir').DrawingDecl;
    expect(drawing.view.scale).toBeNull();
  });

  it('parses point_to_face dimension', () => {
    const ast = parseOk(`
      sketch s = rect(60, 40);
      obj base = extrude(s, 10);
      sketch h = circle(d: 8);
      obj hole = cut(h, through base , @base.top);
      drawing d {
        view base.top;
        dimension hole.center to base.left;
      }
    `);
    const drawing = ast.statements.find(
      (s) => s.kind === 'drawing',
    ) as import('@bushscad/ir').DrawingDecl;
    const dim = drawing.dimensions[0];
    expect(dim.ref.kind).toBe('point_to_face');
    if (dim.ref.kind === 'point_to_face') {
      expect(dim.ref.fromObjName).toBe('hole');
      expect(dim.ref.fromFace).toBe('center');
      expect(dim.ref.toObjName).toBe('base');
      expect(dim.ref.toFace).toBe('left');
    }
  });

  it('errors on invalid view face', () => {
    const result = parse(
      `sketch s = rect(10, 10); obj b = extrude(s, 5); drawing d { view b.diagonal; }`,
      'test.bscd',
    );
    expect(result.errors.some((e) => e.message.includes('diagonal'))).toBe(
      true,
    );
  });

  it('errors when view is missing', () => {
    const result = parse(
      `sketch s = rect(10, 10); obj b = extrude(s, 5); drawing d { dimension b.width; }`,
      'test.bscd',
    );
    expect(
      result.errors.some((e) => e.message.includes('missing a view')),
    ).toBe(true);
  });
});
