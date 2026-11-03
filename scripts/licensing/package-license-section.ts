/**
 * @author Aidan Boissonneault
 * @file package-license-section.ts
 * @purpose Reads and formats third-party npm package license notices.
 * @last-edited November 3, 2026
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const typeFestNotice = `Copyright (c) Sindre Sorhus <sindresorhus@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`;

/** Reads upstream notice files and formats one package section for LICENSES. */
export async function packageLicenseSection(
  packageRoot: string,
): Promise<string> {
  const manifest = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  ) as { name: string; version: string; license?: string };
  const noticeNames = (await readdir(packageRoot))
    .filter((name) =>
      /^(licen[sc]e|copying|notice)([-.]|$)|^third.?party.*notice/i.test(name),
    )
    .sort();
  const notices = await Promise.all(
    noticeNames.map((name) => readFile(join(packageRoot, name), 'utf8')),
  );
  if (notices.length === 0 && manifest.name === 'type-fest') {
    notices.push(typeFestNotice);
  }
  if (notices.length === 0) {
    throw new Error(
      `No license text found for shipped package ${manifest.name}`,
    );
  }
  return [
    `================================================================================\n${manifest.name} ${manifest.version}`,
    `Declared license: ${manifest.license ?? 'not specified'}`,
    ...notices.map((notice) => notice.trim()),
  ].join('\n\n');
}
