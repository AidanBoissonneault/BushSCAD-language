/**
 * @author Aidan Boissonneault
 * @file conversions.test.ts
 * @purpose Tests conversions behavior in the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { InsertTextFormat } from 'vscode-languageserver/node';
import {
  toLspCompletion,
  toLspDiagnostic,
} from '../../../src/platform/lsp/conversions.js';

describe('LSP conversions', () => {
  it('preserves multiline diagnostic end columns independently of the start', () => {
    const diagnostic = toLspDiagnostic({
      message: 'invalid model',
      span: { file: 'main.bscd', line: 2, col: 12, endLine: 3, endCol: 2 },
    });
    expect(diagnostic.range).toEqual({
      start: { line: 1, character: 11 },
      end: { line: 2, character: 1 },
    });
  });

  it('maps shared snippet completions to native LSP snippet format', () => {
    const completion = toLspCompletion({
      label: 'part',
      kind: 'keyword',
      insertText: 'part ${1:name} {}',
      snippet: true,
    });
    expect(completion.insertTextFormat).toBe(InsertTextFormat.Snippet);
  });
});
