/**
 * Callback contract for resolving statements nested in a component body.
 *
 * Feature resolvers receive the body orchestrator so nested scopes retain the
 * same predeclaration and context rules as their parent statement.
 */
import type { ComponentBody } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';

export type BodyResolver = (
  body: ComponentBody,
  scope: Scope,
  state: State,
  inComponent: boolean,
  allowPartMetadata?: boolean,
) => void;
