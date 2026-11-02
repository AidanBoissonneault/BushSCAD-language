/**
 * @author Aidan Boissonneault
 * @file dxf-r12.ts
 * @purpose Provides dxf r12 behavior for the export in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

/**
 * Creates a minimal DXF R12 document buffer with an open ENTITIES section.
 * Drawing exports and sheet-metal flat patterns use the same R12 header and
 * unit metadata; keeping it shared prevents the two writers from drifting.
 */
export function createDxfR12Document(): string[] {
  const lines: string[] = [];
  lines.push('0', 'SECTION', '2', 'HEADER');
  lines.push('9', '$ACADVER', '1', 'AC1009');
  lines.push('9', '$INSUNITS', '70', '4');
  lines.push('0', 'ENDSEC');
  lines.push('0', 'SECTION', '2', 'ENTITIES');
  return lines;
}

/**
 * Closes an open DXF ENTITIES section and returns the serialized document.
 */
export function finishDxfR12Document(lines: string[]): string {
  lines.push('0', 'ENDSEC');
  lines.push('0', 'EOF');
  return lines.join('\n');
}
