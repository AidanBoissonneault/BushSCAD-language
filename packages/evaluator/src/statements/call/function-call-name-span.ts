/**
 * Returns the identifier-only source range for a parsed function call.
 *
 * Editor links use this smaller span to select the called name without its
 * argument list.
 */
import type { ASTSourceSpan, FnCallExpr } from '@bushscad/ir';
/** Returns the identifier-only source range for a parsed function call. */
export function functionCallNameSpan(call: FnCallExpr): ASTSourceSpan {
  return {
    ...call.span,
    endLine: call.span.line,
    endCol: call.span.col + call.name.length,
  };
}
