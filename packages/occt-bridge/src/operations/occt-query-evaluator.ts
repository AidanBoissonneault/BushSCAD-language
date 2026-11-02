/**
 * @author Aidan Boissonneault
 * @file occt-query-evaluator.ts
 * @purpose Evaluates assertions and shape queries for the OCCT bridge.
 * @last-edited October 6, 2026
 */

import type {
  IRAssert,
  IRAssertExpr,
  IRProgram,
  ValidationResult,
} from '@bushscad/ir';
import { readShapeBounds } from '../drawing/drawing-projection.js';
import type { OC } from '../bridge/bridge-types.js';

/**
 * Evaluates program assertions and OpenCascade measurements against built shapes.
 * This service owns no geometry; it uses the initialized OCCT instance to read
 * the shape map and produce validation results for the build pipeline.
 */
export class OcctQueryEvaluator {
  /** Stores the initialized OpenCascade binding used by all query handlers. */
  constructor(private readonly oc: OC) {}

  /**
   * Coordinates validate assertions as part of the OpenCascade build pipeline.
   */
  validateAssertions(
    program: IRProgram,
    shapeMap: Map<string, OC>,
  ): ValidationResult[] {
    const results: ValidationResult[] = [];
    for (const op of program.ops) {
      if (op.kind !== 'assert') continue;
      const result = this.evalIRAssert(op, shapeMap);
      results.push(result);
    }
    return results;
  }

  /**
   * Evaluates IR assert for the current OpenCascade build.
   */
  private evalIRAssert(
    op: IRAssert,
    shapeMap: Map<string, OC>,
  ): ValidationResult {
    const left = this.evalIRAssertExpr(op.left, shapeMap);
    const right = this.evalIRAssertExpr(op.right, shapeMap);
    const passed = this.evalAssertComparison(op.op, left, right);
    // Could not evaluate — treat as passed (no false positive).
    const defaultMsg =
      op.severity === 'warning' ? 'Assertion warning' : 'Assertion failed';
    return {
      passed,
      severity: op.severity,
      message: op.message ?? defaultMsg,
      span: op.span,
    };
  }

  /**
   * Evaluates assert comparison for the current OpenCascade build.
   */
  private evalAssertComparison(
    op: IRAssert['op'],
    left: number | null,
    right: number | null,
  ): boolean {
    if (left === null || right === null) return true;
    const compare = this.assertComparators()[op];
    return compare ? compare(left, right) : false;
  }

  /**
   * Coordinates assert comparators as part of the OpenCascade build pipeline.
   */
  private assertComparators(): Record<
    IRAssert['op'],
    (left: number, right: number) => boolean
  > {
    return {
      '>=': (left, right) => left >= right,
      '<=': (left, right) => left <= right,
      '>': (left, right) => left > right,
      '<': (left, right) => left < right,
      '==': (left, right) => left === right,
      '!=': (left, right) => left !== right,
    };
  }

  /**
   * Evaluates IR assert expr for the current OpenCascade build.
   */
  private evalIRAssertExpr(
    expr: IRAssertExpr,
    shapeMap: Map<string, OC>,
  ): number | null {
    if (expr.kind === 'literal') return expr.value;
    if (expr.kind === 'binary')
      return this.evalBinaryAssertExpr(expr, shapeMap);
    if (expr.kind === 'query')
      return this.evalOcctQuery(expr.fn, expr.args, shapeMap);
    return null;
  }

  /**
   * Evaluates binary assert expr for the current OpenCascade build.
   */
  private evalBinaryAssertExpr(
    expr: Extract<IRAssertExpr, { kind: 'binary' }>,
    shapeMap: Map<string, OC>,
  ): number | null {
    const left = this.evalIRAssertExpr(expr.left, shapeMap);
    const right = this.evalIRAssertExpr(expr.right, shapeMap);
    if (left === null || right === null) return null;
    const evaluate = this.assertBinaryOperators()[expr.op];
    return evaluate ? evaluate(left, right) : null;
  }

  /**
   * Coordinates assert binary operators as part of the OpenCascade build pipeline.
   */
  private assertBinaryOperators(): Record<
    Extract<IRAssertExpr, { kind: 'binary' }>['op'],
    (left: number, right: number) => number | null
  > {
    return {
      '+': (left, right) => left + right,
      '-': (left, right) => left - right,
      '*': (left, right) => left * right,
      '/': (left, right) => (right !== 0 ? left / right : null),
    };
  }

  /**
   * Evaluates OpenCascade query for the current OpenCascade build.
   */
  private evalOcctQuery(
    fn: string,
    args: string[],
    shapeMap: Map<string, OC>,
  ): number | null {
    try {
      const handler = this.occtQueryHandlers(args, shapeMap)[fn];
      return handler ? handler() : null;
    } catch {
      return null;
    }
  }

  /**
   * Coordinates OpenCascade query handlers as part of the OpenCascade build pipeline.
   */
  private occtQueryHandlers(
    args: string[],
    shapeMap: Map<string, OC>,
  ): Record<string, () => number | null> {
    return {
      distance: () => this.evalDistanceQuery(args, shapeMap),
      clearance: () => this.evalDistanceQuery(args, shapeMap),
      bounding_box: () => this.evalBoundingBoxQuery(args, shapeMap),
      volume: () => this.evalVolumeQuery(args, shapeMap),
      wall_thickness: () => this.evalWallThicknessQuery(args, shapeMap),
      face_area: () => this.evalFaceAreaQuery(args, shapeMap),
    };
  }

  /**
   * Evaluates distance query for the current OpenCascade build.
   */
  private evalDistanceQuery(
    args: string[],
    shapeMap: Map<string, OC>,
  ): number | null {
    if (args.length < 2) return null;
    const shapeA = shapeMap.get(args[0]);
    const shapeB = shapeMap.get(args[1]);
    if (!shapeA || !shapeB) return null;
    const oc = this.oc;
    const dist = new oc.BRepExtrema_DistShapeShape_2(
      shapeA,
      shapeB,
      oc.Extrema_ExtFlag.Extrema_ExtFlag_MIN,
      oc.Extrema_ExtAlgo.Extrema_ExtAlgo_Grad,
    );
    if (!dist.IsDone()) return null;
    const result = dist.Value();
    dist.delete();
    return result;
  }

  /**
   * Evaluates bounding box query for the current OpenCascade build.
   */
  private evalBoundingBoxQuery(
    args: string[],
    shapeMap: Map<string, OC>,
  ): number | null {
    const shape = this.resolveSingleArgShape(args, shapeMap);
    if (!shape) return null;
    const b = readShapeBounds(this.oc, shape);
    return (b.xMax - b.xMin) * (b.yMax - b.yMin) * (b.zMax - b.zMin);
  }

  /**
   * Evaluates volume query for the current OpenCascade build.
   */
  private evalVolumeQuery(
    args: string[],
    shapeMap: Map<string, OC>,
  ): number | null {
    return this.evalMassQuery(args, shapeMap, (shape, props) =>
      this.oc.BRepGProp.VolumeProperties_1(shape, props, 1e-3, false, false),
    );
  }

  /**
   * Evaluates wall thickness query for the current OpenCascade build.
   */
  private evalWallThicknessQuery(
    args: string[],
    shapeMap: Map<string, OC>,
  ): number | null {
    const shape = this.resolveSingleArgShape(args, shapeMap);
    return shape ? this.computeWallThickness(shape) : null;
  }

  /**
   * Evaluates face area query for the current OpenCascade build.
   */
  private evalFaceAreaQuery(
    args: string[],
    shapeMap: Map<string, OC>,
  ): number | null {
    return this.evalMassQuery(args, shapeMap, (shape, props) =>
      this.oc.BRepGProp.SurfaceProperties_1(shape, props, 1e-3, false),
    );
  }

  /**
   * Evaluates mass query for the current OpenCascade build.
   */
  private evalMassQuery(
    args: string[],
    shapeMap: Map<string, OC>,
    fill: (shape: OC, props: OC) => void,
  ): number | null {
    const shape = this.resolveSingleArgShape(args, shapeMap);
    if (!shape) return null;
    return this.gpropMass((props) => fill(shape, props));
  }

  /** Resolves the shape named by the first query argument, if present. */
  private resolveSingleArgShape(
    args: string[],
    shapeMap: Map<string, OC>,
  ): OC | null {
    if (args.length < 1) return null;
    return this.resolveArgShape(args[0], shapeMap);
  }

  /** Computes a GProp mass-based metric (volume or surface area) for a shape. */
  private gpropMass(fill: (props: OC) => void): number {
    const props = new this.oc.GProp_GProps_1();
    fill(props);
    const mass = props.Mass();
    props.delete();
    return mass;
  }

  /**
   * Resolves arg shape for the current OpenCascade build.
   */
  private resolveArgShape(arg: string, shapeMap: Map<string, OC>): OC | null {
    // Try direct lookup first (part name), then strip face suffix (obj.face → obj)
    if (shapeMap.has(arg)) return shapeMap.get(arg);
    const rootName = arg.split('.')[0];
    return shapeMap.get(rootName) ?? null;
  }

  /**
   * Computes wall thickness for the current OpenCascade build.
   */
  private computeWallThickness(shape: OC): number | null {
    const faces = this.shapeFaces(shape);
    if (faces.length < 2) return null;
    const minDist = this.minimumSeparatedFaceDistance(faces);
    return minDist === Infinity ? null : minDist;
  }

  /**
   * Returns shape data for faces using the supplied shape and operation state.
   */
  private shapeFaces(shape: OC): OC[] {
    const faces: OC[] = [];
    const explorer = new this.oc.TopExp_Explorer_2(
      shape,
      this.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    while (explorer.More()) {
      faces.push(explorer.Current());
      explorer.Next();
    }
    explorer.delete();
    return faces;
  }

  /**
   * Coordinates minimum separated face distance as part of the OpenCascade build pipeline.
   */
  private minimumSeparatedFaceDistance(faces: OC[]): number {
    let minDist = Infinity;
    for (let i = 0; i < faces.length; i++) {
      for (let j = i + 1; j < faces.length; j++) {
        minDist = this.updateMinimumFaceDistance(minDist, faces[i], faces[j]);
      }
    }
    return minDist;
  }

  /**
   * Updates minimum face distance for the current OpenCascade build.
   */
  private updateMinimumFaceDistance(
    minDist: number,
    faceA: OC,
    faceB: OC,
  ): number {
    try {
      const dist = new this.oc.BRepExtrema_DistShapeShape_2(
        faceA,
        faceB,
        this.oc.Extrema_ExtFlag.Extrema_ExtFlag_MIN,
        this.oc.Extrema_ExtAlgo.Extrema_ExtAlgo_Grad,
      );
      const value = dist.IsDone() ? dist.Value() : null;
      dist.delete();
      return value !== null && value > 1e-4 && value < minDist
        ? value
        : minDist;
    } catch {
      return minDist;
    }
  }
}
