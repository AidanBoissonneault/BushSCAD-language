/**
 * @author Aidan Boissonneault
 * @file suitePdf.ts
 * @purpose Provides suite pdf behavior for the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import { pathToFileURL } from 'node:url';

/** Prints the standalone suite report to an A4 review artifact. */
export async function writeSuitePdf(
  htmlPath: string,
  pdfPath: string,
): Promise<void> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
}
