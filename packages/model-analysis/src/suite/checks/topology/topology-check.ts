import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles topology check in the suite flow.
 */
export function topologyCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const totals = analysis.meshes.reduce(
    (sum, mesh) => ({
      degenerate: sum.degenerate + mesh.issues.degenerateTriangles,
      normals: sum.normals + mesh.issues.invalidNormals,
      boundary: sum.boundary + mesh.issues.boundaryEdges,
      nonManifold: sum.nonManifold + mesh.issues.nonManifoldEdges,
      disconnected: sum.disconnected + mesh.issues.disconnectedComponents,
    }),
    { degenerate: 0, normals: 0, boundary: 0, nonManifold: 0, disconnected: 0 },
  );
  const passed =
    totals.degenerate <= maxIssue(expected, 'degenerateTriangles', 0) &&
    totals.normals <= maxIssue(expected, 'invalidNormals', 0) &&
    totals.nonManifold <= maxIssue(expected, 'nonManifoldEdges', 0) &&
    totals.boundary <=
      maxIssue(
        expected,
        'boundaryEdges',
        expected.allowBoundaryEdges === true ? Number.POSITIVE_INFINITY : 0,
      ) &&
    totals.disconnected <=
      maxIssue(
        expected,
        'disconnectedComponents',
        expected.allowDisconnectedComponents === true
          ? Number.POSITIVE_INFINITY
          : analysis.meshes.length,
      );
  return check(passed, 'Topology health', JSON.stringify(totals));
}

/**
 * Handles max issue in the suite flow.
 */
function maxIssue(
  expected: SuiteExpectation,
  issue: keyof NonNullable<SuiteExpectation['maxTopologyIssues']>,
  fallback: number,
): number {
  return expected.maxTopologyIssues?.[issue] ?? fallback;
}
