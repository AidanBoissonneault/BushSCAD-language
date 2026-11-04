import type { ASTSourceSpan } from '../../sourceSpan.js';

/**
 * Accepted values for hardware spec kind are 'clearance', 'tap', 'counterbore', 'countersink',
 * 'heatset_insert', and 'pilot'.
 */
export type HardwareSpecKind =
  | 'clearance'
  | 'tap'
  | 'counterbore'
  | 'countersink'
  | 'heatset_insert'
  | 'pilot';

/**
 * Hardware spec ref, including size, spec kind, and span.
 */
export type HardwareSpecRef = {
  size: string;
  specKind: HardwareSpecKind;
  span: ASTSourceSpan;
};
