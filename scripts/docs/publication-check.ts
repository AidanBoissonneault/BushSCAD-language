/**
 * @author Aidan Boissonneault
 * @file publication-check.ts
 * @purpose Validates generated language-reference publication assets.
 * @last-edited November 3, 2026
 */

import { readFile, stat } from 'node:fs/promises';

/** Deterministic source and text assets expected from one publication build. */
export type PublicationCheckInput = {
  source: string;
  version: string;
  sourceSha256: string;
  robots: string;
  llms: string;
};

/** Paths to the files whose consistency is required for publication. */
export type PublicationAssetPaths = {
  markdownPath: string;
  packageReferencePath: string;
  robotsPath: string;
  llmsPath: string;
  manifestPath: string;
  pdfPath: string;
};

/** Rejects stale generated files before the website release build. */
export async function checkPublication(
  publication: PublicationCheckInput,
  paths: PublicationAssetPaths,
): Promise<void> {
  const [markdown, packageReference, robots, llms, manifestSource, pdfInfo] =
    await Promise.all([
      readFile(paths.markdownPath, 'utf8'),
      readFile(paths.packageReferencePath, 'utf8'),
      readFile(paths.robotsPath, 'utf8'),
      readFile(paths.llmsPath, 'utf8'),
      readFile(paths.manifestPath, 'utf8'),
      stat(paths.pdfPath),
    ]);
  const manifest = JSON.parse(manifestSource) as {
    version?: string;
    sourceSha256?: string;
  };
  const current =
    markdown === publication.source &&
    packageReference === publication.source &&
    robots === publication.robots &&
    llms === publication.llms &&
    manifest.version === publication.version &&
    manifest.sourceSha256 === publication.sourceSha256 &&
    pdfInfo.size > 0;
  if (!current) {
    throw new Error(
      'Published language-reference assets are stale. Run npm run docs:publish.',
    );
  }
}
