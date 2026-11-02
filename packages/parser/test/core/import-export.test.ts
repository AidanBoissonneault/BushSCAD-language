/**
 * @author Aidan Boissonneault
 * @file import-export.test.ts
 * @purpose Tests import export behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ExportDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parseOk } from '../fixtures/parse.js';

describe('parser — import/export', () => {
  it('parses import all', () => {
    const ast = parseOk("import './hardware.bscd';");
    const imp = ast.statements[0];
    expect(imp.kind).toBe('import');
    if (imp.kind === 'import') {
      expect(imp.path).toBe('./hardware.bscd');
      expect(imp.names).toBeNull();
      expect(imp.namespace).toBeNull();
    }
  });

  it('parses import named', () => {
    const ast = parseOk(
      "import { bracket, bolt_hole } from './hardware.bscd';",
    );
    const imp = ast.statements[0];
    expect(imp.kind).toBe('import');
    if (imp.kind === 'import') {
      expect(imp.names).toHaveLength(2);
      expect(imp.names![0].name).toBe('bracket');
    }
  });

  it('parses import aliased', () => {
    const ast = parseOk(
      "import { bracket as hw_bracket } from './hardware.bscd';",
    );
    const imp = ast.statements[0];
    if (imp.kind === 'import') {
      expect(imp.names![0].alias).toBe('hw_bracket');
    }
  });

  it('parses import namespace', () => {
    const ast = parseOk("import * as hw from './hardware.bscd';");
    const imp = ast.statements[0];
    expect(imp.kind).toBe('import');
    if (imp.kind === 'import') {
      expect(imp.namespace).toBe('hw');
    }
  });

  it('parses export component', () => {
    const ast = parseOk(
      'export part bracket { sketch b = rect(1,1); obj b = extrude(b,1); }',
    );
    const exp = ast.statements[0] as ExportDecl;
    expect(exp.kind).toBe('export');
    expect(exp.statement.kind).toBe('part');
  });

  it('parses export fn', () => {
    const ast = parseOk(
      'export fn bolt_hole(d, depth: 5) { sketch h = circle(d); obj h = cut(h, depth , @base.top.center); }',
    );
    const exp = ast.statements[0] as ExportDecl;
    expect(exp.statement.kind).toBe('fn');
  });
});
