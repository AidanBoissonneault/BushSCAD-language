/**
 * @author Aidan Boissonneault
 * @file compileSource.ts
 * @purpose Provides compile source behavior for the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileAssets } from '@bushscad/ir';
import type { EnvManifestEntry } from '../types/types.js';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { evaluate } from '@bushscad/evaluator';
import { buildWorkspaceIndex } from '../workspace/buildWorkspaceIndex.js';
import { normalizePath } from '../core/paths.js';
import { now } from './time.js';
import { toCompileErrors } from '../core/errors.js';
import { collectEnvManifest, coerceEnvOverrides } from '../core/env.js';
import { collectFontAssets } from '../assets/fonts.js';
import { collectShapeAssets } from './shapes.js';
import { collectMaterialContext } from '../assets/materials.js';
import type {
  CompileDocumentResult,
  CompileSourceInput,
} from '../types/types.js';

/**
 * Runs the browser-safe compiler pipeline with caller-provided file loading.
 * The pipeline indexes the workspace, parses source into an AST, resolves names
 * and imports, validates environment and asset inputs, then evaluates the
 * resolved tree into concrete IR operations and drawing instructions.
 */
export function compileSource(
  input: CompileSourceInput,
): CompileDocumentResult {
  const t0 = now();
  const normalizedFilePath = normalizePath(input.filePath);
  let env: EnvManifestEntry[] = [];
  const emptyAssets: CompileAssets = { fonts: [], shapes: [] };
  const workspace =
    input.workspaceIndex ??
    buildWorkspaceIndex({
      rootPath: input.rootPath,
      activeFilePath: normalizedFilePath,
      fileMap: { [normalizedFilePath]: input.source },
      loadFile: input.loadFile,
    });

  try {
    if (workspace.errors.length > 0) {
      return {
        ok: false,
        errors: workspace.errors,
        assets: emptyAssets,
        env,
        workspace,
        elapsedMs: now() - t0,
      };
    }

    const { ast, errors: parseErrors } = parse(
      input.source,
      normalizedFilePath,
    );
    if (parseErrors.length > 0) {
      return {
        ok: false,
        errors: toCompileErrors(parseErrors),
        assets: emptyAssets,
        env,
        workspace,
        elapsedMs: now() - t0,
      };
    }

    const { ast: resolved, errors: resolveErrors } = resolve(
      ast,
      normalizedFilePath,
      (path) => input.loadFile(normalizePath(path)),
      input.loadAsset
        ? (path) => input.loadAsset?.(normalizePath(path)) ?? null
        : undefined,
    );
    const envManifest = collectEnvManifest(resolved.statements);
    env = envManifest.entries;
    const fontAssets = collectFontAssets(resolved.statements, input.loadAsset);
    const shapeAssets = collectShapeAssets(
      resolved.statements,
      input.loadAsset,
    );
    const mergedAssets: CompileAssets = {
      fonts: fontAssets.assets.fonts,
      shapes: shapeAssets.shapes,
    };
    const materialContext = collectMaterialContext(
      workspace.assets,
      input.loadAsset,
    );
    const setupErrors = [
      ...resolveErrors,
      ...envManifest.errors,
      ...fontAssets.errors,
      ...shapeAssets.errors,
      ...materialContext.errors,
    ];
    if (setupErrors.length > 0) {
      return {
        ok: false,
        errors: setupErrors,
        assets: mergedAssets,
        env,
        workspace,
        elapsedMs: now() - t0,
      };
    }

    const rawEnv = {
      ...declaredManifestEnv(workspace.manifest?.env ?? {}, env),
      ...(input.env ?? {}),
    };
    const coercedEnv = coerceEnvOverrides(rawEnv, env, {
      file: normalizedFilePath,
      line: 1,
      col: 1,
    });
    if (!coercedEnv.ok) {
      return {
        ok: false,
        errors: coercedEnv.errors,
        assets: mergedAssets,
        env,
        workspace,
        elapsedMs: now() - t0,
      };
    }

    const {
      program,
      drawings,
      errors: evalErrors,
    } = evaluate(resolved, {
      env: coercedEnv.env,
      materials: materialContext.context,
    });
    if (evalErrors.length > 0) {
      return {
        ok: false,
        errors: evalErrors,
        assets: mergedAssets,
        env,
        workspace,
        elapsedMs: now() - t0,
      };
    }

    return {
      ok: true,
      program,
      drawings,
      assets: mergedAssets,
      env,
      workspace,
      elapsedMs: now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          message: err instanceof Error ? err.message : String(err),
          span: { file: normalizedFilePath, line: 1, col: 1 },
        },
      ],
      assets: emptyAssets,
      env,
      workspace,
      elapsedMs: now() - t0,
    };
  }
}

/**
 * Keeps manifest defaults scoped to env declarations used by this compile.
 * A workspace can expose multiple entrypoints with different env declarations.
 * Manifest defaults should configure matching entries without turning every
 * other entrypoint into an unknown-env failure.
 */
function declaredManifestEnv(
  manifestEnv: Record<string, string>,
  env: EnvManifestEntry[],
): Record<string, string> {
  const declared = new Set(env.map((entry) => entry.name));
  return Object.fromEntries(
    Object.entries(manifestEnv).filter(([name]) => declared.has(name)),
  );
}
