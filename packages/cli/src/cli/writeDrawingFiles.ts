/**
 * @author Aidan Boissonneault
 * @file writeDrawingFiles.ts
 * @purpose Writes drawing files for the cli in cli package.
 * @last-edited October 6, 2026
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { DrawingResult } from '@bushscad/ir';

/**
 * Written drawing, including name, path, and export format.
 */
type WrittenDrawing = { name: string; path: string; format: 'dxf' | 'svg' };
/**
 * Drawing file content, including export format, content, and export path.
 */
type DrawingFileContent = {
  format: WrittenDrawing['format'];
  content?: string | null;
  exportPath?: string | null;
};

/**
 * Writes DXF and SVG drawing outputs to disk.
 * Paths in drawing blocks are resolved relative to the source file.
 */
export function writeDrawingFiles(
  drawings: DrawingResult[],
  sourceFilePath: string,
): WrittenDrawing[] {
  const written: WrittenDrawing[] = [];
  const sourceDir = dirname(
    isAbsolute(sourceFilePath) ? sourceFilePath : resolve(sourceFilePath),
  );

  for (const drawing of drawings) {
    written.push(...writeDrawingOutputs(drawing, sourceDir));
  }

  return written;
}

/**
 * Writes drawing outputs to the configured destination.
 */
function writeDrawingOutputs(
  drawing: DrawingResult,
  sourceDir: string,
): WrittenDrawing[] {
  return drawingFileContents(drawing).flatMap((file) =>
    writeDrawingOutput(drawing.name, sourceDir, file),
  );
}

/**
 * Handles drawing file contents in the cli flow.
 */
function drawingFileContents(drawing: DrawingResult): DrawingFileContent[] {
  return [
    {
      format: 'dxf',
      content: drawing.dxfContent,
      exportPath: drawing.exportDxfPath,
    },
    {
      format: 'svg',
      content: drawing.svgContent,
      exportPath: drawing.exportSvgPath,
    },
  ];
}

/**
 * Writes drawing output to the configured destination.
 */
function writeDrawingOutput(
  name: string,
  sourceDir: string,
  file: DrawingFileContent,
): WrittenDrawing[] {
  if (!file.content || !file.exportPath) return [];
  const outPath = isAbsolute(file.exportPath)
    ? file.exportPath
    : join(sourceDir, file.exportPath);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, file.content, 'utf8');
  return [{ name, path: outPath, format: file.format }];
}
