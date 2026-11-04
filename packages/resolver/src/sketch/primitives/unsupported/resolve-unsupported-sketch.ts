import type { SketchPrimitiveResolver } from '../types.js';

/** Leaves recognized unsupported syntax untouched for evaluator diagnostics. */
export const resolveUnsupportedSketch: SketchPrimitiveResolver = () => {};
