/**
 * @author Aidan Boissonneault
 * @file parse-drawing.ts
 * @purpose Parses drawing for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  DrawingDecl,
  DrawingViewDecl,
  DimensionDecl,
  DimensionRef,
  ViewFace,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const VIEW_FACES = new Set<string>([
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
]);
const EXTENT_AXES = new Set<string>(['width', 'height', 'depth']);

/**
 * Parses view from the supplied source into the geometry representation.
 */
function parseView(p: Parser): DrawingViewDecl {
  const start = p.peek().span;
  p.advance(); // VIEW
  const { objName: viewObj, face: viewFace } = parseDotRef(p);
  const faceTok = { value: viewFace, span: p.peek().span };

  if (!VIEW_FACES.has(viewFace)) {
    p.addError(
      `Invalid view face '${viewFace}'. Expected: top, bottom, front, back, left, right`,
      faceTok.span,
    );
  }

  let scale: number | null = null;
  if (p.peek().kind === 'IDENT' && p.peek().value === 'scale') {
    p.advance(); // 'scale'
    p.expect('COLON');
    const numTok = p.expect('NUMBER');
    scale = parseFloat(numTok.value);
  }

  p.eatSemi();
  return {
    objName: viewObj,
    face: viewFace as ViewFace,
    scale,
    span: p.spanFrom(start),
  };
}

/**
 * Parses dot ref from the supplied source into the geometry representation.
 */
function parseDotRef(p: Parser): { objName: string; face: string } {
  const parts: string[] = [p.expect('IDENT').value];
  while (p.peek().kind === 'DOT') {
    p.advance(); // DOT
    parts.push(p.expect('IDENT').value);
  }
  const face = parts.pop()!;
  return { objName: parts.join('.'), face };
}

/**
 * Parses dimension from the supplied source into the geometry representation.
 */
function parseDimension(p: Parser): DimensionDecl {
  const start = p.peek().span;
  p.advance(); // DIMENSION

  const from = parseDotRef(p);

  let ref: DimensionRef;
  // 'to' is not a keyword — check IDENT value
  if (p.peek().kind === 'IDENT' && p.peek().value === 'to') {
    p.advance(); // 'to'
    const to = parseDotRef(p);
    ref = {
      kind: 'point_to_face',
      fromObjName: from.objName,
      fromFace: from.face,
      toObjName: to.objName,
      toFace: to.face,
    };
  } else {
    if (!EXTENT_AXES.has(from.face)) {
      p.addError(
        `Invalid dimension axis '${from.face}'. For single-ref dimensions use: width, height, depth. For distance dimensions use: obj.face to obj2.face`,
        p.peek().span,
      );
    }
    ref = {
      kind: 'obj_extent',
      objName: from.objName,
      axis: from.face as 'width' | 'height' | 'depth',
    };
  }

  p.eatSemi();
  return { kind: 'dimension', ref, span: p.spanFrom(start) };
}

/**
 * Parses drawing declaration from the supplied source into the geometry representation.
 */
export function parseDrawingDecl(p: Parser): DrawingDecl {
  const start = p.peek().span;
  p.advance(); // DRAWING

  const nameTok = p.expect('IDENT');
  p.expect('LBRACE');

  let view: DrawingViewDecl | null = null;
  const dimensions: DimensionDecl[] = [];
  let exportDxfPath: string | null = null;
  let exportSvgPath: string | null = null;

  while (!p.check('RBRACE', 'EOF')) {
    const t = p.peek();

    if (t.kind === 'VIEW') {
      if (view !== null) {
        p.addError(
          'A drawing block can only have one view declaration',
          t.span,
        );
      }
      view = parseView(p);
    } else if (t.kind === 'DIMENSION') {
      dimensions.push(parseDimension(p));
    } else if (t.kind === 'EXPORT') {
      p.advance(); // EXPORT
      const fmtTok = p.expect('IDENT');
      if (fmtTok.value === 'dxf') {
        exportDxfPath = p.expect('STRING').value;
      } else if (fmtTok.value === 'svg') {
        exportSvgPath = p.expect('STRING').value;
      } else {
        p.addError(
          `Unknown drawing export format '${fmtTok.value}'. Use 'dxf' or 'svg'`,
          fmtTok.span,
        );
      }
      p.eatSemi();
    } else {
      p.addError(`Unexpected token in drawing block: '${t.value}'`, t.span);
      p.advance();
    }
  }

  p.expect('RBRACE');

  if (view === null) {
    p.addError(
      `Drawing '${nameTok.value}' is missing a view declaration`,
      nameTok.span,
    );
    // Return a placeholder that lets parsing continue after the diagnostic.
    view = {
      objName: '',
      face: 'top',
      scale: null,
      span: nameTok.span,
    };
  }

  return {
    kind: 'drawing',
    name: nameTok.value,
    view,
    dimensions,
    exportDxfPath,
    exportSvgPath,
    span: p.spanFrom(start),
  };
}
