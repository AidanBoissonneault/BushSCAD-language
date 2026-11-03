/**
 * @author Aidan Boissonneault
 * @file publish-language-reference.ts
 * @purpose Provides publish language reference behavior for the scripts docs in repository tooling.
 * @last-edited October 6, 2026
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import MarkdownIt from 'markdown-it';
import { chromium } from 'playwright';
import { checkPublication } from './publication-check.ts';
import type { PublicationCheckInput } from './publication-check.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../..');
const referencePath = join(
  repositoryRoot,
  'BushSCAD_Language_Reference_v0.10.md',
);
const contentDirectory = join(repositoryRoot, 'packages/language-content/dist');
const publicDirectory = join(contentDirectory, 'public');
const packageReferencePath = join(contentDirectory, 'reference.md');
const markdownPath = join(publicDirectory, 'language-reference.md');
const pdfPath = join(publicDirectory, 'language-reference.pdf');
const robotsPath = join(publicDirectory, 'robots.txt');
const llmsPath = join(publicDirectory, 'llms.txt');
const manifestPath = join(publicDirectory, 'language-reference-manifest.json');

/**
 * Manifest data used to publish the canonical language reference and its generated indexes.
 */
type Publication = PublicationCheckInput;

/** Builds all deterministic publication content from the canonical reference. */
function createPublication(source: string): Publication {
  const version = source.match(/^\*\*Version\s+([^\s*]+)/m)?.[1];
  if (!version) {
    throw new Error(
      'The language reference must declare **Version <number>**.',
    );
  }

  return {
    source,
    version,
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    robots: [
      'User-agent: *',
      'Allow: /',
      'Allow: /docs/',
      'Allow: /language-reference.md',
      'Allow: /language-reference.pdf',
      '',
      '# Machine-readable documentation index: /llms.txt',
      '',
    ].join('\n'),
    llms: [
      '# BushSCAD',
      '',
      `> BushSCAD language reference version ${version}.`,
      '',
      'Use the plain Markdown reference when generating or checking BushSCAD source.',
      '',
      '- [Browsable language reference](/docs)',
      '- [Plain Markdown language reference](/language-reference.md)',
      '- [PDF language reference](/language-reference.pdf)',
      '',
    ].join('\n'),
  };
}

/** Produces a self-contained print document with readable code and tables. */
function renderReferenceHtml(publication: Publication): string {
  const renderedBody = new MarkdownIt({ html: false, linkify: true }).render(
    publication.source,
  );
  const body = keepFunctionEntriesTogether(renderedBody);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>BushSCAD Language Reference ${publication.version}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    :root { color: #1e1b16; font: 10.5pt/1.48 Arial, sans-serif; }
    body { margin: 0; }
    h1 { color: #206b39; font-size: 24pt; margin: 0 0 8pt; }
    h2 { break-after: avoid; border-bottom: 1px solid #d8d1c7; color: #206b39; font-size: 17pt; margin: 24pt 0 8pt; padding-bottom: 4pt; }
    h3, h4 { break-after: avoid; margin-bottom: 5pt; }
    h3 { font-size: 13pt; }
    h4 { font-size: 11pt; }
    .function-entry { break-inside: avoid; page-break-inside: avoid; }
    p, li { orphans: 3; widows: 3; }
    pre, table, blockquote { break-inside: avoid; }
    pre { overflow-wrap: anywhere; white-space: pre-wrap; background: #f0ece5; border: 1px solid #d8d1c7; border-radius: 5px; padding: 8pt; }
    code { font: 9pt/1.45 Consolas, monospace; }
    :not(pre) > code { background: #edf5ef; padding: 1pt 3pt; }
    table { border-collapse: collapse; font-size: 8.5pt; width: 100%; }
    th, td { border: 1px solid #d8d1c7; padding: 4pt; text-align: left; vertical-align: top; }
    th { background: #f0ece5; }
    a { color: #206b39; }
    blockquote { border-left: 3px solid #2f8f4e; margin-left: 0; padding-left: 10pt; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

/** Keeps each indexed function heading with its syntax, arguments, and example in print output. */
function keepFunctionEntriesTogether(html: string): string {
  const start = html.indexOf('<h2>Function Reference</h2>');
  const end = html.indexOf('<h2>Language Basics</h2>', start);
  if (start < 0 || end < 0) return html;

  const functionReference = html
    .slice(start, end)
    .replace(
      /<h4>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4>|<h3>|$)/g,
      '<div class="function-entry"><h4>$1</h4>$2</div>',
    );
  return html.slice(0, start) + functionReference + html.slice(end);
}

/** Writes the public text assets and browser-rendered PDF as one publication. */
async function publish(publication: Publication): Promise<void> {
  await mkdir(publicDirectory, { recursive: true });
  await Promise.all([
    writeFile(markdownPath, publication.source, 'utf8'),
    writeFile(packageReferencePath, publication.source, 'utf8'),
    writeFile(robotsPath, publication.robots, 'utf8'),
    writeFile(llmsPath, publication.llms, 'utf8'),
  ]);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(renderReferenceHtml(publication), {
      waitUntil: 'load',
    });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="color:#6f675d;font:8px Arial;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' },
    });
  } finally {
    await browser.close();
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        version: publication.version,
        sourceSha256: publication.sourceSha256,
        files: [
          'language-reference.md',
          'language-reference.pdf',
          'robots.txt',
          'llms.txt',
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

// Normalize Git checkout line endings so the publication checksum is portable.
const source = (await readFile(referencePath, 'utf8')).replace(/\r\n?/g, '\n');
const publication = createPublication(source);
if (process.argv.includes('--check'))
  await checkPublication(publication, {
    markdownPath,
    packageReferencePath,
    robotsPath,
    llmsPath,
    manifestPath,
    pdfPath,
  });
else await publish(publication);

console.log(
  process.argv.includes('--check')
    ? `Language reference ${publication.version} publication is current.`
    : `Published language reference ${publication.version}.`,
);
