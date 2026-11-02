/**
 * @author Aidan Boissonneault
 * @file preview-types.ts
 * @purpose Provides preview types behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import { compileFileToIr } from '@bushscad/compiler/node';

/** Successful compiler output shared by parallel and classic pool paths. */
export type CompiledPreviewInput = Extract<
  ReturnType<typeof compileFileToIr>,
  { ok: true }
>;
