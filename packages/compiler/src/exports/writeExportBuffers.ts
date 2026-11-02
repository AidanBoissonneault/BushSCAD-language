import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import type { ExportFormat } from '@bushscad/ir';
import { absolutePath } from '../platform/node/nodePaths';
import { normalizePath } from '../core/paths';

/**
 * Writes exported buffers to disk and returns their output paths.
 * Export can produce one or more named buffers, while CLI callers need stable
 * filenames and sanitized output names.
 */
function sourceBaseName(sourceFile: string): string {
  const normalized = absolutePath(sourceFile);
  const fileName = normalized.split('/').pop() ?? 'output';
  return fileName.replace(/\.[^.]+$/, '');
}

function sanitizeOutputName(name: string): string {
  let sanitized = '';
  for (const char of name) {
    sanitized += isInvalidOutputChar(char) ? '_' : char;
  }
  return sanitized;
}

function isInvalidOutputChar(char: string): boolean {
  if (/[<>:"/\\|?*]/.test(char)) return true;
  const code = char.charCodeAt(0);
  return code >= 0 && code <= 31;
}

export function writeExportBuffers(
  buffers: { name: string; data: ArrayBuffer }[],
  options: { sourceFile: string; format: ExportFormat; out?: string | null },
): string[] {
  const ext = options.format === 'step' ? 'step' : 'stl';
  const base = sourceBaseName(options.sourceFile);

  if (buffers.length === 1) {
    let target = options.out
      ? absolutePath(options.out)
      : absolutePath(join(dirname(options.sourceFile), `${base}.${ext}`));
    if (options.out && existsSync(target) && extname(target) === '') {
      mkdirSync(target, { recursive: true });
      target = normalizePath(join(target, `${base}.${ext}`));
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(buffers[0].data));
    return [target];
  }

  const outDir = options.out
    ? absolutePath(options.out)
    : absolutePath(join(dirname(options.sourceFile), `${base}-exports`));
  mkdirSync(outDir, { recursive: true });
  return buffers.map((buffer) => {
    const target = normalizePath(join(outDir, sanitizeOutputName(buffer.name)));
    writeFileSync(target, Buffer.from(buffer.data));
    return target;
  });
}
