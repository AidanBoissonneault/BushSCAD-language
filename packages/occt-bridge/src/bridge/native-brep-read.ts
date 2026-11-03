/**
 * Reads a shape from a native BRep artifact and rejects incomplete results.
 *
 * Why: the bridge and its compilation probes must enforce the same OCCT read
 * validation while retaining context-specific error messages.
 */
export function readNativeBrepShape<TShape extends { IsNull(): boolean }>(
  shape: TShape,
  read: () => boolean,
  failureMessage: string,
): TShape {
  if (!read() || shape.IsNull()) throw new Error(failureMessage);
  return shape;
}
