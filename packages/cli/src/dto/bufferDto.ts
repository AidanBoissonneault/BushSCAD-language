/**
 * @author Aidan Boissonneault
 * @file bufferDto.ts
 * @purpose Provides buffer dto behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import type { BufferDto } from './types.js';

/**
 * Converts binary export buffers into base64 DTO format.
 * Buffers must be serialized safely for IPC/service transport.
 */
export function bufferToDto(buffer: {
  name: string;
  data: ArrayBuffer;
}): BufferDto {
  return {
    name: buffer.name,
    dataBase64: Buffer.from(buffer.data).toString('base64'),
  };
}
