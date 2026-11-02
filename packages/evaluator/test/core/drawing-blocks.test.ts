/**
 * @author Aidan Boissonneault
 * @file drawing-blocks.test.ts
 * @purpose Tests drawing blocks behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { describe, expect, it } from 'vitest';
import { evalOk } from './test-support.js';

describe('drawing blocks', () => {
  it('emits a DrawingProgram with one entry', () => {
    const result = evalOk(`
      sketch s = rect(60, 40);
      obj base = extrude(s, 10);
      drawing plate {
        view base.top scale: 2;
        dimension base.width;
        export dxf './out/plate.dxf';
      }
    `);
    expect(result.drawings.drawings).toHaveLength(1);
    const d = result.drawings.drawings[0];
    expect(d.name).toBe('plate');
    expect(d.view.face).toBe('top');
    expect(d.view.scale).toBe(2);
    expect(d.dimensions).toHaveLength(1);
    expect(d.dimensions[0].kind).toBe('obj_extent');
    expect(d.exportDxfPath).toBe('./out/plate.dxf');
    expect(d.exportSvgPath).toBeNull();
  });

  it('produces no drawings when none declared', () => {
    const result = evalOk(`
      sketch s = rect(10, 10);
      obj base = extrude(s, 5);
    `);
    expect(result.drawings.drawings).toHaveLength(0);
  });

  it('errors when drawing references unknown object', () => {
    const parsed = parse(
      `
      sketch s = rect(10, 10);
      obj base = extrude(s, 5);
      drawing d { view ghost.top; }
    `,
      'test.bscd',
    );
    const resolved = resolve(parsed.ast, 'test.bscd', () => null);
    expect(resolved.errors.some((e) => e.message.includes('ghost'))).toBe(true);
  });
});
