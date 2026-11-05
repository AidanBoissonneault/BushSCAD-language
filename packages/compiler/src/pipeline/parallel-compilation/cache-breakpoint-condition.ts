/**
 * Evaluates scalar conditions attached to VS Code cache breakpoints.
 *
 * Why: conditional breakpoints must select unrolled loop instances without
 * evaluating arbitrary JavaScript in the compiler process.
 */
export function matchesCacheCondition(
  source: string,
  context: Readonly<Record<string, number | string | boolean>> | undefined,
): boolean {
  if (!context) return false;
  try {
    const parser = new ConditionParser(source, context);
    return parser.parse();
  } catch {
    return false;
  }
}

type Scalar = number | string | boolean;
/** Parses a bounded boolean expression over scalar loop bindings. */
class ConditionParser {
  private readonly tokens: string[];
  private index = 0;

  constructor(
    source: string,
    private readonly context: Readonly<Record<string, Scalar>>,
  ) {
    this.tokens = tokenize(source);
  }

  parse(): boolean {
    const value = this.parseOr();
    if (this.index !== this.tokens.length || typeof value !== 'boolean')
      throw new Error('Cache breakpoint condition must return a boolean.');
    return value;
  }

  private parseOr(): Scalar {
    let value = this.parseAnd();
    while (this.accept('||')) {
      const right = this.parseAnd();
      value = requireBoolean(value) || requireBoolean(right);
    }
    return value;
  }

  private parseAnd(): Scalar {
    let value = this.parseEquality();
    while (this.accept('&&')) {
      const right = this.parseEquality();
      value = requireBoolean(value) && requireBoolean(right);
    }
    return value;
  }

  private parseEquality(): Scalar {
    let value = this.parseComparison();
    while (
      this.peek() === '==' ||
      this.peek() === '!=' ||
      this.peek() === '===' ||
      this.peek() === '!=='
    ) {
      const operator = this.take();
      const right = this.parseComparison();
      const equal = value === right;
      value = operator === '!=' || operator === '!==' ? !equal : equal;
    }
    return value;
  }

  private parseComparison(): Scalar {
    let value = this.parseAdditive();
    while (true) {
      const operator = this.peek();
      if (!isOrderingOperator(operator)) break;
      this.take();
      const right = this.parseAdditive();
      value = compareScalars(value, right, operator);
    }
    return value;
  }

  private parseAdditive(): Scalar {
    let value = this.parseMultiplicative();
    while (this.peek() === '+' || this.peek() === '-') {
      const operator = this.take();
      const right = this.parseMultiplicative();
      if (typeof value !== 'number' || typeof right !== 'number')
        throw new Error('Cache breakpoint arithmetic needs numbers.');
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  private parseMultiplicative(): Scalar {
    let value = this.parseUnary();
    while (['*', '/', '%'].includes(this.peek() ?? '')) {
      const operator = this.take();
      const right = this.parseUnary();
      if (typeof value !== 'number' || typeof right !== 'number')
        throw new Error('Cache breakpoint arithmetic needs numbers.');
      if (operator === '*') value *= right;
      else if (operator === '/') value /= right;
      else value %= right;
      if (!Number.isFinite(value))
        throw new Error('Cache breakpoint arithmetic is not finite.');
    }
    return value;
  }

  private parseUnary(): Scalar {
    if (this.accept('!')) return !requireBoolean(this.parseUnary());
    if (this.accept('-')) return -requireNumber(this.parseUnary());
    if (this.accept('+')) return requireNumber(this.parseUnary());
    return this.parsePrimary();
  }

  private parsePrimary(): Scalar {
    if (this.accept('(')) {
      const value = this.parseOr();
      if (!this.accept(')'))
        throw new Error('Unclosed cache breakpoint condition.');
      return value;
    }
    const token = this.take();
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return Number(token);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token.startsWith('"')) return JSON.parse(token) as string;
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
      const value = this.context[token];
      if (value === undefined)
        throw new Error(`Unknown cache binding '${token}'.`);
      return value;
    }
    throw new Error('Unsupported cache breakpoint expression.');
  }

  private peek(): string | undefined {
    return this.tokens[this.index];
  }

  private take(): string {
    const token = this.tokens[this.index];
    if (token === undefined) throw new Error('Unexpected end of condition.');
    this.index++;
    return token;
  }

  private accept(expected: string): boolean {
    if (this.peek() !== expected) return false;
    this.index++;
    return true;
  }
}

/** Restricts ordering to valid numeric and string operators. */
function isOrderingOperator(
  operator: string | undefined,
): operator is '<' | '<=' | '>' | '>=' {
  return (
    operator === '<' ||
    operator === '<=' ||
    operator === '>' ||
    operator === '>='
  );
}

/** Applies a typed ordering expression after checking both operands. */
function compareScalars(
  left: Scalar,
  right: Scalar,
  operator: '<' | '<=' | '>' | '>=',
): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return applyOrdering(operator, compareNumbers(left, right));
  }
  if (typeof left === 'string' && typeof right === 'string') {
    return applyOrdering(operator, compareStrings(left, right));
  }
  if (typeof left !== typeof right || typeof left === 'boolean') {
    throw new Error('Cache breakpoint comparisons need matching scalar types.');
  }
  throw new Error('Cache breakpoint comparison is not supported.');
}

/** Returns the ordering of two numbers for the cache condition evaluator. */
function compareNumbers(left: number, right: number): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Returns the ordering of two strings for the cache condition evaluator. */
function compareStrings(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Maps an ordering result to the requested relational operator. */
function applyOrdering(
  operator: '<' | '<=' | '>' | '>=',
  order: -1 | 0 | 1,
): boolean {
  if (operator === '<') return order < 0;
  if (operator === '<=') return order <= 0;
  if (operator === '>') return order > 0;
  return order >= 0;
}

/** Tokenizes the supported expression subset and rejects all unknown syntax. */
function tokenize(source: string): string[] {
  const tokens: string[] = [];
  const pattern =
    /\s*(===|!==|==|!=|<=|>=|&&|\|\||[()+\-*/%!<>]|(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_][A-Za-z0-9_]*|"(?:\\.|[^"\\])*"|.)/gy;
  let offset = 0;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match || match[0].trim() === '') break;
    const token = match[1] ?? match[0].trim();
    if (token === '=' || token === '&' || token === '|')
      throw new Error('Unsupported cache breakpoint operator.');
    tokens.push(token);
    offset = pattern.lastIndex;
  }
  if (source.slice(offset).trim())
    throw new Error('Invalid cache breakpoint condition.');
  return tokens;
}

/** Requires a boolean condition operand. */
function requireBoolean(value: Scalar): boolean {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean value.');
  return value;
}

/** Requires a numeric arithmetic operand. */
function requireNumber(value: Scalar): number {
  if (typeof value !== 'number') throw new Error('Expected a numeric value.');
  return value;
}
