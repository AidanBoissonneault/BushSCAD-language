/**
 * @author Aidan Boissonneault
 * @file text-utils.ts
 * @purpose Provides text utils behavior for the core in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';

const HORIZONTAL_ALIGN_FALLBACK = { left: 0, center: 1, right: 2 } as const;
const VERTICAL_ALIGN_CENTER_FALLBACK = 1;

/**
 * Handles utf8 byte length in the core flow.
 */
export function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined')
    return new TextEncoder().encode(value).length;
  return unescape(encodeURIComponent(value)).length;
}

/**
 * Handles horizontal text alignment in the core flow.
 */
export function horizontalTextAlignment(
  oc: OC,
  align: 'center' | 'left' | 'right',
): OC {
  const key =
    align === 'left'
      ? 'Graphic3d_HTA_LEFT'
      : align === 'right'
        ? 'Graphic3d_HTA_RIGHT'
        : 'Graphic3d_HTA_CENTER';
  return enumValue(
    oc.Graphic3d_HorizontalTextAlignment,
    key,
    HORIZONTAL_ALIGN_FALLBACK[align],
  );
}

/**
 * Handles vertical text alignment center in the core flow.
 */
export function verticalTextAlignmentCenter(oc: OC): OC {
  return enumValue(
    oc.Graphic3d_VerticalTextAlignment,
    'Graphic3d_VTA_CENTER',
    VERTICAL_ALIGN_CENTER_FALLBACK,
  );
}

/**
 * Handles enum value in the core flow.
 */
function enumValue(enumObj: unknown, key: string, fallback: number): OC {
  if (
    enumObj &&
    (typeof enumObj === 'object' || typeof enumObj === 'function') &&
    key in enumObj
  ) {
    const value = (enumObj as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
}
