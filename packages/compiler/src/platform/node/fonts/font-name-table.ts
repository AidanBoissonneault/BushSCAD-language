/**
 * @author Aidan Boissonneault
 * @purpose Resolves Node-side font assets for compiler programs.
 * @last-edited October 6, 2026
 */

/** Reads preferred and legacy family names from an OpenType `name` table. */
export function fontFamilyNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) return [];
  const tableCount = view.getUint16(4);
  for (let index = 0; index < tableCount; index++) {
    const offset = 12 + index * 16;
    if (offset + 16 > bytes.byteLength || ascii(bytes, offset, 4) !== 'name')
      continue;
    return readNameTable(bytes, view.getUint32(offset + 8));
  }
  return [];
}

/**
 * Reads name table from the supplied source.
 */
function readNameTable(bytes: Uint8Array, tableOffset: number): string[] {
  if (tableOffset + 6 > bytes.byteLength) return [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(tableOffset + 2);
  const strings = tableOffset + view.getUint16(tableOffset + 4);
  const preferred: string[] = [];
  const legacy: string[] = [];
  for (let index = 0; index < count; index++) {
    const result = readNameRecord(bytes, view, tableOffset, strings, index);
    if (result.kind === 'end') break;
    if (result.kind === 'skip') continue;
    (result.nameId === 16 ? preferred : legacy).push(result.name);
  }
  return [...new Set(preferred.length > 0 ? preferred : legacy)];
}

/**
 * Reads and decodes one supported OpenType name record.
 */
function readNameRecord(
  bytes: Uint8Array,
  view: DataView,
  tableOffset: number,
  strings: number,
  index: number,
):
  | { kind: 'end' }
  | { kind: 'skip' }
  | { kind: 'name'; nameId: 1 | 16; name: string } {
  const record = tableOffset + 6 + index * 12;
  if (record + 12 > bytes.byteLength) return { kind: 'end' };
  const nameId = view.getUint16(record + 6);
  if (nameId !== 1 && nameId !== 16) return { kind: 'skip' };
  const length = view.getUint16(record + 8);
  const offset = strings + view.getUint16(record + 10);
  if (offset + length > bytes.byteLength) return { kind: 'skip' };
  const name = decodeName(
    bytes.subarray(offset, offset + length),
    view.getUint16(record),
  );
  return name
    ? { kind: 'name', nameId: nameId as 1 | 16, name }
    : { kind: 'skip' };
}

/**
 * Handles decode name in the platform node flow.
 */
function decodeName(bytes: Uint8Array, platform: number): string {
  if (platform !== 0 && platform !== 3)
    return new TextDecoder('latin1').decode(bytes).replace(/\0/g, '').trim();
  let value = '';
  for (let index = 0; index + 1 < bytes.length; index += 2)
    value += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  return value.replace(/\0/g, '').trim();
}

/**
 * Handles ascii in the platform node flow.
 */
function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
