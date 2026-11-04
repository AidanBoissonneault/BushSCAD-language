/**
 * @author Aidan Boissonneault
 * @file sketch-primitives.test.ts
 * @purpose Tests sketch primitives behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ExportDecl, FontImportDecl, SketchDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parseOk } from '../fixtures/parse.js';

describe('parser — sketch primitives', () => {
  it('parses rect', () => {
    const ast = parseOk('sketch base = rect(60, 40);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.kind).toBe('sketch');
    expect(s.name).toBe('base');
    expect(s.primitive.kind).toBe('rect');
  });

  it('parses rect with corner radius', () => {
    const ast = parseOk('sketch cap = rect(60, 40, r: 4);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('rect');
    if (s.primitive.kind === 'rect')
      expect(s.primitive.cornerRadius).toBeDefined();
  });

  it('parses rect inset single arg', () => {
    const ast = parseOk('sketch lid = rect inset(5);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('inset');
    if (s.primitive.kind === 'inset') expect(s.primitive.all).toBeDefined();
  });

  it('parses rect inset named args', () => {
    const ast = parseOk(
      'sketch lid = rect inset(top: 3, sides: 8, bottom: 3);',
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('inset');
    if (s.primitive.kind === 'inset') {
      expect(s.primitive.top).toBeDefined();
      expect(s.primitive.sides).toBeDefined();
      expect(s.primitive.bottom).toBeDefined();
    }
  });

  it('parses circle', () => {
    const ast = parseOk('sketch boss = circle(10);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('circle');
  });

  it('parses sketch subtraction', () => {
    const ast = parseOk('sketch ring = circle(10) - circle(8);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive).toMatchObject({
      kind: 'sketchBoolean',
      op: 'subtract',
    });
  });

  it('parses sketch-local at placement', () => {
    const ast = parseOk('sketch placed = circle(10) - circle(2) at (3, 0);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('sketchBoolean');
    if (s.primitive.kind === 'sketchBoolean') {
      expect(s.primitive.right.kind).toBe('sketchAt');
    }
  });

  it('parses grouped sketch boolean expressions', () => {
    const ast = parseOk(
      'sketch tabbed = (circle(10) - circle(8)) + rect(2, 2) at (8, 0);',
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive).toMatchObject({ kind: 'sketchBoolean', op: 'add' });
  });

  it('parses named sketch operands in sketch booleans', () => {
    const ast = parseOk(
      'sketch outer = circle(10); sketch ring = outer - inner at (3, 0);',
    );
    const s = ast.statements[1] as SketchDecl;
    expect(s.primitive.kind).toBe('sketchBoolean');
    if (s.primitive.kind === 'sketchBoolean') {
      expect(s.primitive.left).toMatchObject({
        kind: 'sketchRef',
        name: 'outer',
      });
      expect(s.primitive.right).toMatchObject({ kind: 'sketchAt' });
    }
  });

  it('parses sketch dimension expressions', () => {
    const ast = parseOk('sketch copy = rect(base.width, base.length);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('rect');
    if (s.primitive.kind === 'rect') {
      expect(s.primitive.width.kind).toBe('faceRef');
      expect(s.primitive.height.kind).toBe('faceRef');
    }
  });

  it('parses roundrect', () => {
    const ast = parseOk('sketch slot = roundrect(20, 8, r: 4);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('roundrect');
  });

  it('parses triangle', () => {
    const ast = parseOk('sketch face = triangle(30, 20);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('triangle');
  });

  it('parses polygon', () => {
    const ast = parseOk('sketch outline = polygon([(0,0),(30,0),(15,26)]);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('polygon');
    if (s.primitive.kind === 'polygon')
      expect(s.primitive.points).toHaveLength(3);
  });

  it('parses polygon plant suffix for revolve placement', () => {
    const ast = parseOk(
      'sketch outline = polygon([(0,0),(30,0),(15,26)]) plant;',
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('polygon');
    if (s.primitive.kind === 'polygon') expect(s.primitive.plant).toBe(true);
  });

  it('parses word static string', () => {
    const ast = parseOk(
      "sketch label = word('FRONT', size: 8, font: 'sans', align: center);",
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('word');
    if (s.primitive.kind === 'word') {
      expect(s.primitive.font).toMatchObject({ kind: 'string', value: 'sans' });
      expect(s.primitive.align).toBe('center');
    }
  });

  it('accepts positional word options without labels', () => {
    const ast = parseOk(
      "sketch label = word('FRONT', 7, 'sans', left, corner);",
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('word');
    if (s.primitive.kind === 'word') {
      expect(s.primitive.size).toMatchObject({ kind: 'number', value: 7 });
      expect(s.primitive.font).toMatchObject({ kind: 'string', value: 'sans' });
      expect(s.primitive.align).toBe('left');
      expect(s.primitive.origin).toBe('corner');
    }
  });

  it('parses word , @variable', () => {
    const ast = parseOk(
      "sketch serial = word(part_id, size: 5, font: 'mono', align: left);",
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('word');
    if (s.primitive.kind === 'word') {
      expect(s.primitive.text.kind).toBe('identifier');
      expect(s.primitive.font).toMatchObject({ kind: 'string', value: 'mono' });
      expect(s.primitive.align).toBe('left');
    }
  });

  it('preserves arbitrary word font strings', () => {
    const ast = parseOk(
      "sketch label = word('Front', size: 8, font: 'Times New Roman', align: center);",
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('word');
    if (s.primitive.kind === 'word') {
      expect(s.primitive.font).toMatchObject({
        kind: 'string',
        value: 'Times New Roman',
      });
    }
  });

  it('parses word font , @a variable expression', () => {
    const ast = parseOk(
      'sketch label = word(part_id, size: 5, font: label_font, align: right);',
    );
    const s = ast.statements[0] as SketchDecl;
    expect(s.primitive.kind).toBe('word');
    if (s.primitive.kind === 'word') {
      expect(s.primitive.font).toMatchObject({
        kind: 'identifier',
        name: 'label_font',
      });
      expect(s.primitive.align).toBe('right');
    }
  });

  it('parses imported font declarations without making font a keyword', () => {
    const ast = parseOk(`
font brand = import './fonts/Brand-Regular.ttf';
sketch label = word('ACME', size: 8, font: brand, align: center);
`);
    const font = ast.statements[0] as FontImportDecl;
    const sketch = ast.statements[1] as SketchDecl;
    expect(font).toMatchObject({
      kind: 'fontImport',
      name: 'brand',
      path: './fonts/Brand-Regular.ttf',
    });
    expect(sketch.primitive.kind).toBe('word');
    if (sketch.primitive.kind === 'word') {
      expect(sketch.primitive.font).toMatchObject({
        kind: 'identifier',
        name: 'brand',
      });
    }
  });

  it('parses exported imported font declarations', () => {
    const ast = parseOk("export font logo = import './fonts/Logo.otf';");
    const exp = ast.statements[0] as ExportDecl;
    expect(exp.statement.kind).toBe('fontImport');
    if (exp.statement.kind === 'fontImport') {
      expect(exp.statement.name).toBe('logo');
      expect(exp.statement.path).toBe('./fonts/Logo.otf');
    }
  });

  it('parses sketch with @ placement argument', () => {
    const ast = parseOk('sketch lid = rect(60, 40, @work);');
    const s = ast.statements[0] as SketchDecl;
    expect(s.placement).toBeDefined();
    expect(s.placement!.face).toBeDefined();
  });
});
