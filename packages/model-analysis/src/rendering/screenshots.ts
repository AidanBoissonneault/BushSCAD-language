/**
 * @author Aidan Boissonneault
 * @file screenshots.ts
 * @purpose Provides screenshots behavior for the rendering in model analysis package.
 * @last-edited October 6, 2026
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const VIEWS = ['iso', 'front', 'right', 'top', 'bottom', 'section'] as const;

/**
 * Options for screenshot, including report path, out dir, width, and height.
 */
type ScreenshotOptions = {
  reportPath: string;
  outDir: string;
  width: number;
  height: number;
};

/**
 * Captures deterministic report screenshots with Playwright.
 * Codex needs image artifacts from known camera angles, not a manually adjusted
 * viewport, to verify what geometry actually changed.
 */
export async function captureScreenshots(
  options: ScreenshotOptions,
): Promise<string[]> {
  const { chromium } = await import('playwright');
  await mkdir(options.outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });
    const paths: string[] = [];
    for (const view of VIEWS) {
      const outputPath = join(options.outDir, `${view}.png`);
      await page.goto(reportUrl(options.reportPath, view));
      await page.locator('#view').screenshot({ path: outputPath });
      paths.push(outputPath);
    }
    return paths;
  } finally {
    await browser.close();
  }
}

/**
 * Handles report url in the rendering flow.
 */
function reportUrl(reportPath: string, view: string): string {
  const url = pathToFileURL(reportPath);
  url.searchParams.set('view', view);
  return url.href;
}
