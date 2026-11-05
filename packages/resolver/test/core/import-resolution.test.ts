/**
 * @author Aidan Boissonneault
 * @file import-resolution.test.ts
 * @purpose Tests import resolution behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import type { FileLoader } from '../../src/index.js';
import { resolve } from '../../src/index.js';
import { resolveErrors } from './test-support.js';

describe('import resolution', () => {
  it('circular import detected', () => {
    const fileMap: Record<string, string> = {
      'a.bscd': "import './b.bscd';",
      'b.bscd': "import './a.bscd';",
    };
    /**
     * Handles loader in the core flow.
     */
    const loader: FileLoader = (p) => fileMap[p] ?? null;

    const parsed = parse("import './b.bscd';", 'a.bscd');
    const result = resolve(parsed.ast, 'a.bscd', loader);
    expect(
      result.errors.some((e) => e.message.includes('Circular import')),
    ).toBe(true);
  });

  it('unresolvable import file → error', () => {
    const errors = resolveErrors("import './missing.bscd';");
    expect(errors.some((e) => e.includes('Cannot load import'))).toBe(true);
  });

  it('named import resolves symbol into scope', () => {
    const fileMap: Record<string, string> = {
      'hw.bscd':
        'export part bracket { sketch b = rect(10, 10); obj b = extrude(b, 5); }',
    };
    /**
     * Handles loader in the core flow.
     */
    const loader: FileLoader = (p) => fileMap[p] ?? null;
    const parsed = parse(
      `
import { bracket } from './hw.bscd';
part frame {
    sketch base = rect(120, 80);
    obj base = extrude(base, 10);
    place(bracket, @base.top.center);
}
`,
      'main.bscd',
    );
    const result = resolve(parsed.ast, 'main.bscd', loader);
    expect(result.errors).toHaveLength(0);
  });

  it('import all exports resolves symbol into scope', () => {
    const fileMap: Record<string, string> = {
      'hw.bscd':
        'export part bracket { sketch b = rect(10, 10); obj b = extrude(b, 5); }',
    };
    /**
     * Handles loader in the core flow.
     */
    const loader: FileLoader = (p) => fileMap[p] ?? null;
    const parsed = parse(
      `
import './hw.bscd';
part frame {
    sketch base = rect(120, 80);
    obj base = extrude(base, 10);
    place(bracket, @base.top.center);
}
`,
      'main.bscd',
    );
    const result = resolve(parsed.ast, 'main.bscd', loader);
    expect(result.errors).toHaveLength(0);
  });

  it('imports exported refs as hidden reusable components', () => {
    const fileMap: Record<string, string> = {
      'hw.bscd': `
export ref bracket {
  sketch b = rect(this.width / 2, 10);
  obj b = extrude(b, 5);
}
`,
    };
    /**
     * Handles loader in the core flow.
     */
    const loader: FileLoader = (p) => fileMap[p] ?? null;
    const parsed = parse(
      `
import { bracket } from './hw.bscd';
part frame {
  sketch base = rect(120, 80);
  obj base = extrude(base, 10);
  place(bracket, @base.top.center);
}
`,
      'main.bscd',
    );

    const result = resolve(parsed.ast, 'main.bscd', loader);
    expect(result.errors).toHaveLength(0);
  });

  it('keeps local refs private to their declaring file', () => {
    const fileMap: Record<string, string> = {
      'hw.bscd': 'ref bracket { obj body = cube([10, 10, 5]); }',
    };
    const loader: FileLoader = (p) => fileMap[p] ?? null;
    const parsed = parse(
      "import { bracket } from './hw.bscd';",
      'main.bscd',
    );

    const result = resolve(parsed.ast, 'main.bscd', loader);

    expect(
      result.errors.some((error) =>
        error.message.includes("'bracket' not found in './hw.bscd'"),
      ),
    ).toBe(true);
  });

  it('named import cannot access non-exported symbols', () => {
    const fileMap: Record<string, string> = {
      'hw.bscd':
        'part private_bracket { sketch b = rect(10, 10); obj b = extrude(b, 5); }',
    };
    /**
     * Handles loader in the core flow.
     */
    const loader: FileLoader = (p) => fileMap[p] ?? null;
    const parsed = parse(
      "import { private_bracket } from './hw.bscd';",
      'main.bscd',
    );
    const result = resolve(parsed.ast, 'main.bscd', loader);
    expect(
      result.errors.some((e) =>
        e.message.includes("'private_bracket' not found"),
      ),
    ).toBe(true);
  });
});
