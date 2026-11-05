/**
 * @author Aidan Boissonneault
 * @file symbols.ts
 * @purpose Provides symbols behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageSymbol } from '../protocol/ILanguageServer.js';
import { positionAt } from '../language/textPositions.js';
import { uriFromPath } from '../language/uri.js';
import { functionDetailsForSource } from './functionDetails.js';

const IDENT = '[A-Za-z_][\\w]*';

/**
 * Symbol pattern, including operation kind, regex, additional detail, and display value.
 */
type SymbolPattern = {
  kind: LanguageSymbol['kind'];
  regex: RegExp;
  detail: (match: RegExpExecArray) => string;
  value?: (match: RegExpExecArray) => string | undefined;
};

/**
 * Handles typed declaration pattern in the providers flow.
 */
function typedDeclarationPattern(kind: 'sketch' | 'obj'): SymbolPattern {
  return {
    kind,
    regex: new RegExp(`\\b${kind}\\s+(${IDENT})\\s*=\\s*(${IDENT})?`, 'g'),
    detail: (match) =>
      match[2] ? `${kind} ${match[1]}: ${match[2]}` : `${kind} ${match[1]}`,
    value: (match) => match[2],
  };
}

const PATTERNS: SymbolPattern[] = [
  {
    kind: 'var',
    regex: new RegExp(`\\bvar\\s+(${IDENT})\\s*=\\s*([^;\\n]+)`, 'g'),
    detail: (match) => `var ${match[1]}`,
    value: (match) => match[2],
  },
  {
    kind: 'env',
    regex: new RegExp(`\\benv\\s+(${IDENT})\\s+fallback\\s+([^;\\n]+)`, 'g'),
    detail: (match) => `env ${match[1]}`,
    value: (match) => `fallback ${match[2]}`,
  },
  {
    kind: 'font',
    regex: new RegExp(
      `\\bfont\\s+(${IDENT})\\s*=\\s*import\\s+(['"][^'"]+['"])`,
      'g',
    ),
    detail: (match) => `font ${match[1]}`,
    value: (match) => match[2],
  },
  typedDeclarationPattern('sketch'),
  typedDeclarationPattern('obj'),
  {
    kind: 'part',
    regex: new RegExp(`\\bpart\\s+(${IDENT})\\b`, 'g'),
    detail: (match) => `part ${match[1]}`,
  },
  {
    kind: 'ref',
    regex: new RegExp(
      `\\bref\\s+(${IDENT})(?:\\s+extends\\s+${IDENT})?\\s*(?=\\{|=)`,
      'g',
    ),
    detail: (match) => `ref ${match[1]}`,
  },
  {
    kind: 'fn',
    regex: new RegExp(`\\b(?:export\\s+)?fn\\s+(${IDENT})\\s*\\(([^)]*)`, 'g'),
    detail: (match) => `fn ${match[1]}(${cleanValue(match[2]) ?? ''})`,
    value: (match) => match[2],
  },
  {
    kind: 'plane',
    regex: new RegExp(`\\bplane\\s+(${IDENT})\\s*=\\s*offset\\(([^)]*)`, 'g'),
    detail: (match) => `plane ${match[1]}`,
    value: (match) => `offset(${match[2]}`,
  },
  {
    kind: 'anchor',
    regex: new RegExp(`@(${IDENT}(?:\\.${IDENT})*)\\s*=\\s*(@[^;\\n]+)`, 'g'),
    detail: (match) => `anchor ${match[1]}`,
    value: (match) => match[2],
  },
];

/**
 * Handles clean value in the providers flow.
 */
function cleanValue(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, ' ').trim();
}

/**
 * Handles name offset in the providers flow.
 */
function nameOffset(match: RegExpExecArray): number {
  return match.index + match[0].indexOf(match[1]);
}

/**
 * Collects declarations for one source document.
 * Symbol, completion, hover, and definition requests need a cheap index that
 * can run on every keystroke without invoking the full compiler pipeline.
 */
export function collectSymbolsForSource(
  source: string,
  filePath: string,
): LanguageSymbol[] {
  const functionDetails = functionDetailsForSource(source, filePath);
  const functionsByOffset = new Map(
    functionDetails.map((details) => [details.nameOffset, details]),
  );
  return PATTERNS.flatMap((pattern) =>
    collectPatternSymbols(source, filePath, pattern, functionsByOffset),
  );
}

/** Collects one declaration pattern while retaining source order per kind. */
function collectPatternSymbols(
  source: string,
  filePath: string,
  pattern: SymbolPattern,
  functionsByOffset: ReadonlyMap<
    number,
    ReturnType<typeof functionDetailsForSource>[number]
  >,
): LanguageSymbol[] {
  const symbols: LanguageSymbol[] = [];
  for (const match of source.matchAll(pattern.regex)) {
    const symbol = symbolForPatternMatch(
      source,
      filePath,
      pattern,
      match,
      functionsByOffset,
    );
    if (symbol) symbols.push(symbol);
  }
  return symbols;
}

/** Builds a language symbol from one regex match and its optional function info. */
function symbolForPatternMatch(
  source: string,
  filePath: string,
  pattern: SymbolPattern,
  match: RegExpExecArray,
  functionsByOffset: ReadonlyMap<
    number,
    ReturnType<typeof functionDetailsForSource>[number]
  >,
): LanguageSymbol | null {
  const name = match[1];
  if (!name) return null;
  const offset = nameOffset(match);
  const functionInfo =
    pattern.kind === 'fn' ? functionsByOffset.get(offset) : undefined;
  const start = positionAt(source, offset);
  return {
    name,
    kind: pattern.kind,
    detail: functionInfo?.signature ?? pattern.detail(match),
    ...(functionInfo ? { documentation: functionInfo.documentation } : {}),
    ...(!functionInfo || pattern.kind !== 'fn'
      ? { value: cleanValue(pattern.value?.(match)) }
      : {}),
    uri: uriFromPath(filePath),
    range: {
      start,
      end: { line: start.line, col: start.col + name.length },
    },
  };
}
