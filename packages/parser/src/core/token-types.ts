/**
 * @author Aidan Boissonneault
 * @file token-types.ts
 * @purpose Provides token types behavior for the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '@bushscad/ir';

/**
 * Accepted values for token kind are 'NUMBER', 'STRING', 'TEMPLATE_START', 'TEMPLATE_TEXT',
 * 'TEMPLATE_EXPR_START', 'TEMPLATE_EXPR_END', 'TEMPLATE_END', 'TEMPLATE_INVALID_ESCAPE', 'BOOL',
 * 'IDENT', 'BASE_UNIT', 'WORKPLANE', 'VAR', 'ENV', 'FALLBACK', 'SKETCH', 'OBJ', 'EXTRUDE',
 * 'CUT', 'THROUGH', 'FROM', 'SYMMETRIC', 'PART', 'FN', 'FOR', 'IN', 'WHERE', 'WITHIN', 'AUTO',
 * 'IF', 'ELSE', 'IMPORT', 'EXPORT', 'AS', 'PLACE', 'REF', 'AT', 'USING', 'ANCHOR', 'RETURN',
 * 'PLANE', 'OFFSET', 'COLOR', 'MATERIAL', 'ROTATE', 'AROUND', 'REVOLVE', 'RADIAL_EXTRUDE',
 * 'RADIAL_CUT', 'PLANT', 'LOFT', 'GUIDE', 'WRAP', 'PATTERN', 'LINEAR', 'MIRROR', 'ACROSS',
 * 'TRANSFORM', 'PATH', 'SWEEP', 'ALONG', 'USE', 'HOLE', 'HEATSET_INSERT', 'DEPTH', 'ASSERT',
 * 'WARNING', 'FIT', 'INTO', 'DRAWING', 'VIEW', 'DIMENSION', 'BETWEEN', 'SHEET', 'SURFACE',
 * 'FILL', 'OFFSET_SURFACE', 'THICKEN', 'CONSTRAIN', 'RECT', 'CIRCLE', 'ROUNDRECT',
 * 'TRIANGLE', 'POLYGON', 'WORD', 'INSET', 'LINE', 'ARC', 'RADIUS', 'CLOCKWISE',
 * 'COUNTERCLOCKWISE', 'FILLET', 'CHAMFER', 'SHELL', 'DRAFT', 'THREAD', 'OPEN', 'RANGE', 'GRID',
 * 'RADIAL', 'ENUMERATE', 'POS', 'THIS', 'UNIT_MM', 'UNIT_CM', 'UNIT_M', 'UNIT_IN', 'UNIT_FT',
 * 'UNIT_DEG', 'PLUS', 'MINUS', 'STAR', 'SLASH', 'PERCENT', 'AMPERSAND', 'EQ', 'NEQ', 'LT', 'GT',
 * 'LTE', 'GTE', 'AND', 'OR', 'BANG', 'ASSIGN', 'QUESTION', 'COLON', 'SEMICOLON', 'DOT', 'COMMA',
 * 'AT_SIGN', 'LPAREN', 'RPAREN', 'LBRACE', 'RBRACE', 'LBRACKET', 'RBRACKET', 'EOF', and
 * 'UNKNOWN'.
 */
export type TokenKind =
  // Literals
  | 'NUMBER'
  | 'STRING'
  | 'TEMPLATE_START'
  | 'TEMPLATE_TEXT'
  | 'TEMPLATE_EXPR_START'
  | 'TEMPLATE_EXPR_END'
  | 'TEMPLATE_END'
  | 'TEMPLATE_INVALID_ESCAPE'
  | 'BOOL'
  | 'IDENT'
  // Keywords
  | 'BASE_UNIT'
  | 'WORKPLANE'
  | 'VAR'
  | 'ENV'
  | 'FALLBACK'
  | 'SKETCH'
  | 'OBJ'
  | 'EXTRUDE'
  | 'CUT'
  | 'THROUGH'
  | 'FROM'
  | 'SYMMETRIC'
  | 'PART'
  | 'FN'
  | 'FOR'
  | 'IN'
  | 'WHERE'
  | 'WITHIN'
  | 'AUTO'
  | 'IF'
  | 'ELSE'
  | 'IMPORT'
  | 'EXPORT'
  | 'AS'
  | 'PLACE'
  | 'REF'
  | 'AT'
  | 'USING'
  | 'ANCHOR'
  | 'RETURN'
  | 'PLANE'
  | 'OFFSET'
  | 'COLOR'
  | 'MATERIAL'
  | 'ROTATE'
  | 'AROUND'
  | 'REVOLVE'
  | 'RADIAL_EXTRUDE'
  | 'RADIAL_CUT'
  | 'PLANT'
  | 'LOFT'
  | 'GUIDE'
  | 'WRAP'
  // Patterns and transforms
  | 'PATTERN'
  | 'LINEAR'
  | 'MIRROR'
  | 'ACROSS'
  | 'TRANSFORM'
  // Sweep / path
  | 'PATH'
  | 'SWEEP'
  | 'ALONG'
  // Hardware / holes
  | 'USE'
  | 'HOLE'
  | 'HEATSET_INSERT'
  | 'DEPTH'
  // Validation
  | 'ASSERT'
  | 'WARNING'
  // Fits / tolerances
  | 'FIT'
  | 'INTO'
  // Drawing / DXF export
  | 'DRAWING'
  | 'VIEW'
  | 'DIMENSION'
  // Assemblies / joints
  | 'BETWEEN'
  // Sheet metal
  | 'SHEET'
  | 'SURFACE'
  | 'FILL'
  | 'OFFSET_SURFACE'
  | 'THICKEN'
  // Sketch constraints
  | 'CONSTRAIN'
  // Primitives
  | 'RECT'
  | 'CIRCLE'
  | 'ROUNDRECT'
  | 'TRIANGLE'
  | 'POLYGON'
  | 'WORD'
  | 'INSET'
  | 'LINE'
  | 'ARC'
  | 'RADIUS'
  | 'CLOCKWISE'
  | 'COUNTERCLOCKWISE'
  // Details
  | 'FILLET'
  | 'CHAMFER'
  | 'SHELL'
  | 'DRAFT'
  | 'THREAD'
  | 'OPEN'
  // Iterators
  | 'RANGE'
  | 'GRID'
  | 'RADIAL'
  | 'ENUMERATE'
  // Pos/this
  | 'POS'
  | 'THIS'
  // Units
  | 'UNIT_MM'
  | 'UNIT_CM'
  | 'UNIT_M'
  | 'UNIT_IN'
  | 'UNIT_FT'
  | 'UNIT_DEG'
  // Operators
  | 'PLUS'
  | 'MINUS'
  | 'STAR'
  | 'SLASH'
  | 'PERCENT'
  | 'AMPERSAND'
  | 'EQ'
  | 'NEQ'
  | 'LT'
  | 'GT'
  | 'LTE'
  | 'GTE'
  | 'AND'
  | 'OR'
  | 'BANG'
  | 'ASSIGN'
  | 'QUESTION'
  | 'COLON'
  | 'SEMICOLON'
  | 'DOT'
  | 'COMMA'
  | 'AT_SIGN'
  // Delimiters
  | 'LPAREN'
  | 'RPAREN'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  // Special
  | 'EOF'
  | 'UNKNOWN';

/**
 * Token, including operation kind, display value, and span.
 */
export type Token = {
  kind: TokenKind;
  value: string;
  span: ASTSourceSpan;
};
