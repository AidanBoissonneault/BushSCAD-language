/**
 * @author Aidan Boissonneault
 * @file package-license-section.test.ts
 * @purpose Tests license text selection and formatting for shipped packages.
 * @last-edited November 3, 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { packageLicenseSection } from '../../../../scripts/licensing/package-license-section.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('third-party package license sections', () => {
  it('sorts and includes matching license and notice files', async () => {
    const root = await packageRoot({
      name: 'example-package',
      version: '2.1.0',
      license: 'MIT',
    });
    await writeFile(join(root, 'NOTICE.txt'), 'Notice body\n', 'utf8');
    await writeFile(join(root, 'LICENSE'), 'License body\n', 'utf8');
    await writeFile(join(root, 'readme.md'), 'Ignored text', 'utf8');

    const section = await packageLicenseSection(root);

    expect(section).toContain('example-package 2.1.0');
    expect(section).toContain('Declared license: MIT');
    expect(section.indexOf('License body')).toBeLessThan(
      section.indexOf('Notice body'),
    );
    expect(section).not.toContain('Ignored text');
  });

  it('uses the bundled type-fest notice when the package has no file', async () => {
    const root = await packageRoot({
      name: 'type-fest',
      version: '4.0.0',
      license: 'MIT',
    });

    await expect(packageLicenseSection(root)).resolves.toContain(
      'Copyright (c) Sindre Sorhus',
    );
  });

  it('rejects packages that have no license notice', async () => {
    const root = await packageRoot({ name: 'missing-license', version: '1.0.0' });
    await expect(packageLicenseSection(root)).rejects.toThrow(
      'No license text found for shipped package missing-license',
    );
  });
});

/** Creates a package fixture with an isolated manifest directory. */
async function packageRoot(manifest: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'bushscad-license-'));
  temporaryRoots.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify(manifest), 'utf8');
  return root;
}
