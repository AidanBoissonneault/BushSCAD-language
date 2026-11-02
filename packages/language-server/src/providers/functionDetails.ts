/**
 * @author Aidan Boissonneault
 * @file functionDetails.ts
 * @purpose Describes function parameters and explicit results for editor providers.
 * @last-edited October 13, 2026
 */

import type { ASTSourceSpan, FnDecl } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { offsetAt, positionAt } from '../language/textPositions.js';

/** Source-backed signature and result details for one declared function. */
export type FunctionSourceDetails = {
  name: string;
  nameOffset: number;
  line: number;
  col: number;
  signature: string;
  documentation: string;
};

/**
 * Reads user-defined function signatures and result entries from a document.
 *
 * Why:
 * Symbol matching alone can identify a function name, but only the parser's
 * recovered AST can describe defaults and the entries inside its return block.
 */
export function functionDetailsForSource(
  source: string,
  filePath = 'editor.bscd',
): FunctionSourceDetails[] {
  if (!/\b(?:export\s+)?fn\s+[A-Za-z_]\w*\s*\(/.test(source)) return [];

  const declarations: FnDecl[] = [];
  collectFunctionDeclarations(
    parse(source, filePath).ast,
    declarations,
    new Set(),
  );
  return declarations.map((declaration) =>
    describeFunction(source, declaration),
  );
}

/** Collects nested function declarations from the parser's plain AST tree. */
function collectFunctionDeclarations(
  value: unknown,
  declarations: FnDecl[],
  visited: Set<object>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectFunctionDeclarations(item, declarations, visited),
    );
    return;
  }
  if (value === null || typeof value !== 'object' || visited.has(value)) return;

  visited.add(value);
  if (isFunctionDeclaration(value)) declarations.push(value);
  Object.values(value).forEach((item) =>
    collectFunctionDeclarations(item, declarations, visited),
  );
}

/** Builds display data while keeping all expression text from its source span. */
function describeFunction(
  source: string,
  declaration: FnDecl,
): FunctionSourceDetails {
  const declarationStart = offsetAt(source, {
    line: declaration.span.line,
    col: declaration.span.col,
  });
  const declarationEnd = offsetAt(source, {
    line: declaration.span.endLine,
    col: declaration.span.endCol,
  });
  const declarationText = source.slice(declarationStart, declarationEnd);
  const nameMatch = new RegExp(
    `\\bfn\\s+${escapeRegExp(declaration.name)}\\b`,
  ).exec(declarationText);
  const nameOffset = nameMatch
    ? declarationStart +
      nameMatch.index +
      nameMatch[0].lastIndexOf(declaration.name)
    : declarationStart;
  const parameters = declaration.params.map((parameter) => {
    const defaultValue = parameter.default
      ? compact(sourceForSpan(source, parameter.default.span))
      : null;
    return {
      name: parameter.name,
      defaultValue,
      signature: defaultValue
        ? `${parameter.name}: ${defaultValue}`
        : parameter.name,
    };
  });
  const signature = `fn ${declaration.name}(${parameters
    .map((parameter) => parameter.signature)
    .join(', ')})`;
  const returnStatement = declaration.body.statements.find(
    (statement) => statement.kind === 'return',
  );
  const returnEntries =
    returnStatement?.body.statements.map((statement) =>
      compact(sourceForSpan(source, statement.span)),
    ) ?? [];
  const location = positionAt(source, nameOffset);

  return {
    name: declaration.name,
    nameOffset,
    line: location.line,
    col: location.col,
    signature,
    documentation: formatFunctionDocumentation(parameters, returnEntries),
  };
}

/** Renders concise Markdown for required/default parameters and return entries. */
function formatFunctionDocumentation(
  parameters: { name: string; defaultValue: string | null }[],
  returnEntries: string[],
): string {
  const sections = ['**Parameters**'];
  sections.push(
    ...(parameters.length
      ? parameters.map((parameter) =>
          parameter.defaultValue
            ? `- \`${parameter.name}\` (optional; defaults to \`${parameter.defaultValue}\`).`
            : `- \`${parameter.name}\` (required).`,
        )
      : ['- No parameters.']),
  );
  sections.push('**Return entries**');
  sections.push(
    ...(returnEntries.length
      ? returnEntries.map((entry) => `- \`${entry}\``)
      : ['- No explicit `return` block.']),
  );
  return sections.join('\n');
}

/** Extracts the exact source covered by a parser span. */
function sourceForSpan(source: string, span: ASTSourceSpan): string {
  const start = offsetAt(source, { line: span.line, col: span.col });
  const end = offsetAt(source, { line: span.endLine, col: span.endCol });
  return source.slice(start, end);
}

/** Narrows a plain parser object to a function declaration. */
function isFunctionDeclaration(value: object): value is FnDecl {
  const candidate = value as Partial<FnDecl>;
  return (
    candidate.kind === 'fn' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.params) &&
    candidate.body !== undefined
  );
}

/** Escapes function names before locating them in their declaration span. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Collapses source whitespace for readable signatures and hover bullets. */
function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
