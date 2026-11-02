/**
 * @author Aidan Boissonneault
 * @file uri.ts
 * @purpose Provides uri behavior for the language in language server package.
 * @last-edited October 6, 2026
 */

/**
 * Converts editor URIs and paths into the compiler's normalized path format.
 * The VS Code host and tests can pass either `file:///...` URIs or plain paths,
 * but workspace indexing needs one canonical key.
 */
export function pathFromUri(uri: string): string {
  if (uri.startsWith('file://')) {
    try {
      const parsed = new URL(uri);
      const path = decodeURIComponent(parsed.pathname).replace(
        /^\/([A-Za-z]:)/,
        '$1',
      );
      return normalizePath(path.replace(/^\/{2,}/, '/'));
    } catch {
      // Fall through to the permissive path handling below.
    }
  }
  const decoded = (() => {
    try {
      return decodeURIComponent(uri);
    } catch {
      return uri;
    }
  })();
  return normalizePath(decoded.replace(/^\/([A-Za-z]:)/, '$1'));
}

/**
 * Handles uri from path in the language flow.
 */
export function uriFromPath(path: string): string {
  return `file:///${normalizePath(path).replace(/^\/+/, '')}`;
}

/**
 * Normalizes path into the canonical form.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
