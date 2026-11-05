/**
 * Optional storage contract for prepared component BRep payloads.
 *
 * Why: parallel hosts can persist completed geometry without making the
 * compiler depend on a filesystem or retain cache payloads between requests.
 */
export interface PreparedComponentBrepCache {
  /** Loads the BRep bytes for an exact canonical recipe digest, if present. */
  get(
    recipeDigest: string,
    recipeCanonical: string,
  ): Promise<Uint8Array | undefined>;

  /** Persists a completed BRep payload after the host's write policy allows it. */
  put(
    recipeDigest: string,
    recipeCanonical: string,
    brep: Uint8Array,
    operationDurationMs: number,
  ): Promise<void>;
}
