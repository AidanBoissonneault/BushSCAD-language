/**
 * @author Aidan Boissonneault
 * @file m19-advanced-geometry.test.ts
 * @purpose Tests m19 advanced geometry behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  ExtrudeOp,
  FaceRef,
  FilletDetail,
  LoftOp,
  ObjDecl,
  RevolveOp,
  SketchDecl,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — M19 advanced geometry', () => {
  it('parses path sketches, revolve, loft, wrap, angle placement, and obj.name', () => {
    const ast = parseOk(`
part m19 {
    sketch profile = path(
        plant a = line((0,0), (30,0)),
        lip = arc((30,0), (30,10), 10, cw),
        back = line((30,10), (0,10)),
        close = line((0,10), (0,0))
    );
    sketch mid = path(
        a = line((0,0), (20,0)),
        b = line((20,0), (20,8)),
        c = line((20,8), (0,8)),
        d = line((0,8), (0,0))
    );
    sketch rail = path(
        path = line((0,0), (0,40)),
        hook = arc((0,40), (10,50), 12, ccw)
    );
    obj vase = revolve(profile, 360deg around y);
    obj body = loft(profile, mid, height: 40, guide: rail);
    sketch label = rect(4,1);
    obj label = cut(label, 0.8 , @vase.curved(surfaceAngle: 0deg)) wrap true;
    sketch rib = rect(2,10);
    obj rib = extrude(rib, 1 , @vase.curved(surfaceAngle: 45deg)) wrap: false;
    fillet(@vase.lip.edges, 0.5);
}
`);
    const c = component(ast, 'm19');
    const profile = bodyStmt<SketchDecl>(c, 'sketch');
    expect(profile.primitive.kind).toBe('pathSketch');
    if (profile.primitive.kind === 'pathSketch') {
      expect(
        profile.primitive.items.map((item) =>
          item.kind === 'segment' ? item.name : '',
        ),
      ).toEqual(['a', 'lip', 'back', 'close']);
      expect(profile.primitive.items[1]).toMatchObject({
        kind: 'segment',
        segment: { kind: 'arc', direction: 'cw' },
      });
      expect(profile.primitive.items[0]).toMatchObject({
        kind: 'segment',
        segment: { kind: 'line' },
        plant: true,
      });
    }

    const revolve = bodyStmt<ObjDecl>(c, 'obj').operation as RevolveOp;
    expect(revolve.kind).toBe('revolve');
    expect(revolve.sketch).toMatchObject({
      kind: 'namedSketch',
      name: 'profile',
    });
    expect(revolve.around).toBe('y');
    expect(revolve.radius).toBeUndefined();

    const loft = bodyStmt<ObjDecl>(c, 'obj', 1).operation as LoftOp;
    expect(loft.kind).toBe('loft');
    expect(loft.sketches).toEqual([
      expect.objectContaining({ kind: 'namedSketch', name: 'profile' }),
      expect.objectContaining({ kind: 'namedSketch', name: 'mid' }),
    ]);
    expect(loft.guide).toMatchObject({ kind: 'namedSketch', name: 'rail' });

    const cut = bodyStmt<ObjDecl>(c, 'obj', 2).operation as CutOp;
    expect(cut.wrap).toBe(true);
    expect((cut.from as FaceRef).surfaceAngle).toBeDefined();

    const extrude = bodyStmt<ObjDecl>(c, 'obj', 3).operation as ExtrudeOp;
    expect(extrude.wrap).toBe(false);
    expect((extrude.from as FaceRef).surfaceAngle).toBeDefined();

    const fillet = bodyStmt<FilletDetail>(c, 'fillet');
    expect(faceChain(fillet.target)).toBe('vase.lip.edges');
  });

  it('parses radial_extrude with angle+length and all curve types', () => {
    const ast = parseOk(`
part m38 {
    sketch p = rect(4, 2);
    obj boss = radial_extrude(p, axis: z, angle: 90, length: 20);
    obj horn = radial_extrude(p, axis: z, angle: 180, length: 40,
        curve: ease-in-out, direction: ccw, start: 15,
        twist: 30, taper: 2, radius: 5, sections: 64);
    obj cam = radial_extrude(p, axis: z, angle: 270, length: 30,
        curve: cubic-bezier(0.2, 0.8, 0.4, 1.0));
    obj a = radial_extrude(p, axis: z, angle: 90, length: 10, curve: natural);
    obj b = radial_extrude(p, axis: z, angle: 90, length: 10, curve: linear);
    obj c = radial_extrude(p, axis: z, angle: 90, length: 10, curve: ease);
    obj d = radial_extrude(p, axis: z, angle: 90, length: 10, curve: ease-in);
    obj e = radial_extrude(p, axis: z, angle: 90, length: 10, curve: ease-out);
    obj f = radial_extrude(p, axis: z, angle: 90, length: 10, curve: step-start);
    obj g = radial_extrude(p, axis: z, angle: 90, length: 10, curve: step-end);
}
`);
    const c = component(ast, 'm38');
    const objs = c.body.statements.filter((s) => s.kind === 'obj') as ObjDecl[];
    const boss = objs[0].operation;
    expect(boss.kind).toBe('radial_extrude');
    if (boss.kind === 'radial_extrude') {
      expect(boss.sketch).toMatchObject({ kind: 'namedSketch', name: 'p' });
      expect(boss.axis).toBe('z');
      expect(boss.extent.kind).toBe('angle-length');
      expect(boss.curve.kind).toBe('natural');
      expect(boss.direction).toBe('ccw');
    }
    const horn = objs[1].operation;
    if (horn.kind === 'radial_extrude') {
      expect(horn.curve.kind).toBe('ease-in-out');
      expect(horn.direction).toBe('ccw');
      expect(horn.twist).not.toBeNull();
      expect(horn.taper).not.toBeNull();
      expect(horn.radius).not.toBeNull();
      expect(horn.sections.kind).toBe('expr');
    }
    const cam = objs[2].operation;
    if (cam.kind === 'radial_extrude') {
      expect(cam.curve.kind).toBe('cubic-bezier');
    }
    expect((objs[3].operation as { curve: { kind: string } }).curve.kind).toBe(
      'natural',
    );
    expect((objs[4].operation as { curve: { kind: string } }).curve.kind).toBe(
      'linear',
    );
    expect((objs[5].operation as { curve: { kind: string } }).curve.kind).toBe(
      'ease',
    );
    expect((objs[6].operation as { curve: { kind: string } }).curve.kind).toBe(
      'ease-in',
    );
    expect((objs[7].operation as { curve: { kind: string } }).curve.kind).toBe(
      'ease-out',
    );
    expect((objs[8].operation as { curve: { kind: string } }).curve.kind).toBe(
      'step-start',
    );
    expect((objs[9].operation as { curve: { kind: string } }).curve.kind).toBe(
      'step-end',
    );
  });

  it('parses radial_cut with from: placement', () => {
    const ast = parseOk(`
part m38c {
    sketch base = rect(40, 40);
    obj base = extrude(base, 10);
    sketch slot = rect(2, 4);
    obj cutout = radial_cut(slot, axis: z, angle: 90, length: 5,
                            from: base.top.center, direction: cw);
}
`);
    const c = component(ast, 'm38c');
    const objs = c.body.statements.filter((s) => s.kind === 'obj') as ObjDecl[];
    const cut = objs[1].operation;
    expect(cut.kind).toBe('radial_cut');
    if (cut.kind === 'radial_cut') {
      expect(cut.direction).toBe('cw');
      expect(cut.from).not.toBeNull();
    }
  });

  it('rejects radial_extrude missing axis or extent', () => {
    const r1 = parse(
      'part m { sketch s = rect(1,1); obj o = radial_extrude(s, angle: 90, length: 10); }',
      't.bscd',
    );
    expect(r1.errors.some((e) => /axis/i.test(e.message))).toBe(true);
    const r2 = parse(
      'part m { sketch s = rect(1,1); obj o = radial_extrude(s, axis: z); }',
      't.bscd',
    );
    expect(
      r2.errors.some((e) => /angle.*length|between/i.test(e.message)),
    ).toBe(true);
    const r3 = parse(
      'part m { sketch s = rect(1,1); obj o = radial_extrude(s, axis: z, angle: 90, length: 10, between: (a, b)); }',
      't.bscd',
    );
    expect(r3.errors.some((e) => /only one/i.test(e.message))).toBe(true);
  });

  it('parses revolve with optional radius: named arg', () => {
    const ast = parseOk(
      'part ring { sketch s = circle(2); obj r = revolve(s, 360deg around z, radius: 10); }',
    );
    const c = component(ast, 'ring');
    const revolve = bodyStmt<ObjDecl>(c, 'obj').operation as RevolveOp;
    expect(revolve.kind).toBe('revolve');
    expect(revolve.radius).toBeDefined();
    expect(revolve.radius?.kind).toBe('number');
    if (revolve.radius?.kind === 'number') {
      expect(revolve.radius.value).toBe(10);
    }
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
