/**
 * @author Aidan Boissonneault
 * @file requested-file-entrypoint.test.ts
 * @purpose Tests requested file entrypoint behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileFileToIr } from '../../src/platform/node/node';

describe('requested-file compiler entrypoint mode', () => {
  const projectPath = fileURLToPath(
    new URL('../../../../examples/m14', import.meta.url),
  );
  const importedPartPath = fileURLToPath(
    new URL(
      '../../../../examples/m14/src/parts/foot.bscd',
      import.meta.url,
    ),
  );

  it('keeps workspace entrypoint resolution as the default', () => {
    const result = compileFileToIr({
      filePath: importedPartPath,
      rootPath: projectPath,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env.map((entry) => entry.name)).toEqual(['build_mode']);
  });

  it('compiles the requested source file inside a manifest workspace', () => {
    const result = compileFileToIr({
      filePath: importedPartPath,
      rootPath: projectPath,
      entrypointMode: 'requested-file',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.env).toEqual([]);
    expect(result.workspace.defaultEntrypoint).toMatch(/src\/main\.bscd$/);
  });
});
