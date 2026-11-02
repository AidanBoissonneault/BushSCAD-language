/**
 * @author Aidan Boissonneault
 * @file polynomialRealRoots.ts
 * @purpose Provides polynomial real roots behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

/** Isolates all real roots of a degree-four-or-less polynomial. */
export function realPolynomialRoots(
  input: number[],
  tolerance: number,
): number[] {
  const coefficients = trimPolynomial(input, tolerance);
  const degree = coefficients.length - 1;
  if (degree <= 0) return [];
  if (degree === 1) return [-coefficients[0] / coefficients[1]];
  const leading = Math.abs(coefficients[degree]);
  const bound =
    1 +
    Math.max(
      ...coefficients.slice(0, -1).map((value) => Math.abs(value) / leading),
    );
  const derivative = coefficients
    .slice(1)
    .map((value, index) => value * (index + 1));
  const critical = realPolynomialRoots(derivative, tolerance).filter(
    (root) => Math.abs(root) <= bound,
  );
  const stops = [-bound, ...critical, bound].sort((x, y) => x - y);
  const roots = critical.filter(
    (root) => Math.abs(polynomialValue(coefficients, root)) <= tolerance * 16,
  );
  for (let index = 0; index < stops.length - 1; index++) {
    const left = stops[index];
    const right = stops[index + 1];
    const leftValue = polynomialValue(coefficients, left);
    const rightValue = polynomialValue(coefficients, right);
    if (leftValue * rightValue < 0) {
      roots.push(bisectRoot(coefficients, left, right));
    }
  }
  return [...new Set(roots.map((root) => Math.round(root / 1e-9) * 1e-9))];
}

/**
 * Handles trim polynomial in the geometry flow.
 */
function trimPolynomial(coefficients: number[], tolerance: number): number[] {
  const result = [...coefficients];
  while (result.length > 1 && Math.abs(result.at(-1)!) <= tolerance) {
    result.pop();
  }
  return result;
}

/**
 * Handles polynomial value in the geometry flow.
 */
function polynomialValue(coefficients: number[], value: number): number {
  return coefficients.reduceRight(
    (sum, coefficient) => sum * value + coefficient,
    0,
  );
}

/**
 * Handles bisect root in the geometry flow.
 */
function bisectRoot(
  coefficients: number[],
  initialLeft: number,
  initialRight: number,
): number {
  let left = initialLeft;
  let right = initialRight;
  let leftValue = polynomialValue(coefficients, left);
  for (let iteration = 0; iteration < 80; iteration++) {
    const middle = (left + right) / 2;
    const middleValue = polynomialValue(coefficients, middle);
    if (Math.abs(middleValue) <= 1e-12) return middle;
    if (leftValue * middleValue <= 0) right = middle;
    else {
      left = middle;
      leftValue = middleValue;
    }
  }
  return (left + right) / 2;
}
