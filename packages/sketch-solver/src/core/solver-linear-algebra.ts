/**
 * @author Aidan Boissonneault
 * @file solver-linear-algebra.ts
 * @purpose Provides vector and matrix operations used by the sketch constraint solver.
 * @last-edited October 6, 2026
 */

/**
 * vector represented by number[].
 */

export type Vector = number[];
/**
 * matrix represented by number[][].
 */
export type Matrix = number[][];

/** Builds a finite-difference Jacobian for the current residual function. */
export function numericalJacobian(
  equations: (variables: Vector) => Vector,
  variables: Vector,
  values: Vector,
  variableCount: number,
  epsilon: number,
): Matrix {
  const matrix = values.map(() => new Array(variableCount).fill(0));
  for (let column = 0; column < variableCount; column++) {
    const perturbed = [...variables];
    perturbed[column] += epsilon;
    const next = equations(perturbed);
    for (let row = 0; row < values.length; row++) {
      matrix[row][column] = (next[row] - values[row]) / epsilon;
    }
  }
  return matrix;
}

/** Returns a damped least-squares Newton step, including rank-deficient systems. */
export function leastSquaresStep(
  matrix: Matrix,
  values: Vector,
): Vector | null {
  const columnCount = matrix[0]?.length ?? 0;
  if (matrix.length === 0 || columnCount === 0) return null;
  const transposed = transpose(matrix);
  const normal = multiply(transposed, matrix);
  const scale = Math.max(1, ...normal.flat().map((value) => Math.abs(value)));
  for (let index = 0; index < columnCount; index++) {
    normal[index][index] += scale * 1e-10;
  }
  const projected = transposed.map((row) =>
    row.reduce((sum, value, index) => sum + value * values[index], 0),
  );
  return gaussianSolve(
    normal,
    projected.map((value) => -value),
  );
}

/** Computes numerical rank using scaled row reduction. */
export function matrixRank(matrix: Matrix): number {
  return reducedRowEchelon(matrix).pivots.length;
}

/** Finds variable columns that participate in at least one Jacobian nullspace vector. */
export function nullspaceColumns(
  matrix: Matrix,
  columnCount: number,
): Set<number> {
  if (columnCount === 0) return new Set();
  const { rows, pivots } = reducedRowEchelon(matrix, columnCount);
  const pivotSet = new Set(pivots);
  const free = Array.from({ length: columnCount }, (_, index) => index).filter(
    (index) => !pivotSet.has(index),
  );
  const participating = new Set<number>();
  for (const freeColumn of free) {
    participating.add(freeColumn);
    pivots.forEach((pivotColumn, row) => {
      if (Math.abs(rows[row]?.[freeColumn] ?? 0) > 1e-8) {
        participating.add(pivotColumn);
      }
    });
  }
  return participating;
}

/**
 * Handles reduced row echelon in the core flow.
 */
function reducedRowEchelon(
  matrix: Matrix,
  explicitColumns?: number,
): { rows: Matrix; pivots: number[] } {
  const columns = explicitColumns ?? matrix[0]?.length ?? 0;
  const rows = matrix.map((row) =>
    Array.from({ length: columns }, (_, index) =>
      Number.isFinite(row[index]) ? row[index] : 0,
    ),
  );
  const maxValue = Math.max(1, ...rows.flat().map((value) => Math.abs(value)));
  const tolerance = maxValue * 1e-8;
  const pivots: number[] = [];
  let pivotRow = 0;
  for (let column = 0; column < columns && pivotRow < rows.length; column++) {
    const strongest = strongestPivotRow(rows, column, pivotRow);
    if (Math.abs(rows[strongest][column]) <= tolerance) continue;
    [rows[pivotRow], rows[strongest]] = [rows[strongest], rows[pivotRow]];
    normalizePivotRow(rows[pivotRow], column, columns);
    eliminatePivotColumn(rows, pivotRow, column, columns);
    pivots.push(column);
    pivotRow++;
  }
  return { rows, pivots };
}

/** Normalizes one pivot row so its leading coefficient is one. */
function normalizePivotRow(
  row: number[],
  column: number,
  columns: number,
): void {
  const pivot = row[column];
  for (let index = column; index < columns; index++) row[index] /= pivot;
}

/** Eliminates a pivot column from every non-pivot row. */
function eliminatePivotColumn(
  rows: Matrix,
  pivotRow: number,
  column: number,
  columns: number,
): void {
  for (let row = 0; row < rows.length; row++) {
    if (row === pivotRow) continue;
    const factor = rows[row][column];
    for (let index = column; index < columns; index++) {
      rows[row][index] -= factor * rows[pivotRow][index];
    }
  }
}

/**
 * Handles gaussian solve in the core flow.
 */
function gaussianSolve(matrix: Matrix, values: Vector): Vector | null {
  const size = matrix.length;
  const rows = matrix.map((row) => [...row]);
  const result = [...values];
  for (let column = 0; column < size; column++) {
    const pivotRow = strongestPivotRow(rows, column, column);
    if (Math.abs(rows[pivotRow][column]) < 1e-14) return null;
    [rows[column], rows[pivotRow]] = [rows[pivotRow], rows[column]];
    [result[column], result[pivotRow]] = [result[pivotRow], result[column]];
    for (let row = column + 1; row < size; row++) {
      const factor = rows[row][column] / rows[column][column];
      for (let index = column; index < size; index++) {
        rows[row][index] -= factor * rows[column][index];
      }
      result[row] -= factor * result[column];
    }
  }
  const solution = new Array(size).fill(0);
  for (let row = size - 1; row >= 0; row--) {
    solution[row] = result[row];
    for (let column = row + 1; column < size; column++) {
      solution[row] -= rows[row][column] * solution[column];
    }
    solution[row] /= rows[row][row];
  }
  return solution.every(Number.isFinite) ? solution : null;
}

/**
 * Handles strongest pivot row in the core flow.
 */
function strongestPivotRow(
  rows: Matrix,
  column: number,
  start: number,
): number {
  let pivot = start;
  for (let row = start + 1; row < rows.length; row++) {
    if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column]))
      pivot = row;
  }
  return pivot;
}

/**
 * Handles multiply in the core flow.
 */
function multiply(left: Matrix, right: Matrix): Matrix {
  return left.map((row) =>
    right[0].map((_, column) =>
      row.reduce((sum, value, index) => sum + value * right[index][column], 0),
    ),
  );
}

/**
 * Handles transpose in the core flow.
 */
function transpose(matrix: Matrix): Matrix {
  return matrix[0]?.map((_, column) => matrix.map((row) => row[column])) ?? [];
}
