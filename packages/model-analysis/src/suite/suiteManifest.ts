/**
 * @author Aidan Boissonneault
 * @file suiteManifest.ts
 * @purpose Provides suite manifest behavior for the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import { readFile, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { isBushScadFile } from '@bushscad/compiler/paths';
import { languageCapabilityCatalog } from './capabilityCatalog.js';
import type { SuiteCheck, SuiteCoverage, SuiteManifest } from './suiteTypes.js';

/**
 * Loaded manifest, including manifest, suite root, checks, and coverage.
 */
type LoadedManifest = {
  manifest: SuiteManifest;
  suiteRoot: string;
  checks: SuiteCheck[];
  coverage: SuiteCoverage;
};

/** Loads and validates the self-contained language true-check manifest. */
export async function loadSuiteManifest(
  suiteRootInput: string,
): Promise<LoadedManifest> {
  const suiteRoot = resolve(suiteRootInput);
  const raw = JSON.parse(
    await readFile(resolve(suiteRoot, 'suite.json'), 'utf8'),
  ) as unknown;
  const manifest = parseManifest(raw);
  const checks = await manifestChecks(manifest, suiteRoot);
  return {
    manifest,
    suiteRoot,
    checks,
    coverage: capabilityCoverage(manifest),
  };
}

/**
 * Parses manifest from the supplied source into the suite representation.
 */
function parseManifest(value: unknown): SuiteManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.cases)) {
    throw new TypeError('suite.json must be a version 1 suite manifest');
  }
  if (
    typeof value.title !== 'string' ||
    typeof value.description !== 'string'
  ) {
    throw new TypeError('suite.json requires title and description strings');
  }
  return value as SuiteManifest;
}

/**
 * Handles manifest checks in the suite flow.
 */
async function manifestChecks(
  manifest: SuiteManifest,
  suiteRoot: string,
): Promise<SuiteCheck[]> {
  const ids = manifest.cases.map((entry) => entry.id);
  const files = manifest.cases.map((entry) => entry.file.replace(/\\/g, '/'));
  const diskFiles = (await bushscadFiles(suiteRoot)).sort();
  return [
    check(
      new Set(ids).size === ids.length,
      'Unique case IDs',
      `${ids.length} declared case IDs`,
    ),
    check(
      new Set(files).size === files.length,
      'Unique case files',
      `${files.length} declared model files`,
    ),
    check(
      manifest.cases.every((entry) => safeSuiteFile(suiteRoot, entry.file)),
      'Suite-local model paths',
      'Every model is a relative .bscd path inside the suite root',
    ),
    check(
      sameStrings(files.sort(), diskFiles),
      'Manifest declares every model',
      diskDeclarationDetail(files, diskFiles),
    ),
  ];
}

/**
 * Handles capability coverage in the suite flow.
 */
function capabilityCoverage(manifest: SuiteManifest): SuiteCoverage {
  const required = [...languageCapabilityCatalog()].sort();
  const covered = [
    ...new Set(manifest.cases.flatMap((entry) => entry.capabilities)),
  ].sort();
  const requiredSet = new Set(required);
  return {
    required,
    covered,
    missing: required.filter((name) => !covered.includes(name)),
    unknown: covered.filter((name) => !requiredSet.has(name)),
  };
}

/**
 * Handles bushscad files in the suite flow.
 */
async function bushscadFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...(await bushscadFiles(root, path)));
    else if (entry.isFile() && isBushScadFile(entry.name)) {
      files.push(relative(root, path).split(sep).join('/'));
    }
  }
  return files;
}

/**
 * Handles safe suite file in the suite flow.
 */
function safeSuiteFile(root: string, file: string): boolean {
  if (isAbsolute(file) || !isBushScadFile(file)) return false;
  const rel = relative(root, resolve(root, file));
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Handles disk declaration detail in the suite flow.
 */
function diskDeclarationDetail(declared: string[], disk: string[]): string {
  const undeclared = disk.filter((file) => !declared.includes(file));
  const missing = declared.filter((file) => !disk.includes(file));
  if (undeclared.length === 0 && missing.length === 0)
    return `${disk.length} model files are declared exactly once`;
  return `undeclared: ${undeclared.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`;
}

/**
 * Checks whether the supplied strings values are equivalent.
 */
function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

/**
 * Handles check in the suite flow.
 */
function check(passed: boolean, name: string, detail: string): SuiteCheck {
  return { passed, name, detail };
}

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
