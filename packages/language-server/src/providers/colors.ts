/**
 * @author Aidan Boissonneault
 * @file colors.ts
 * @purpose Provides colors behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

const HEX_COLOR_RE =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

/**
 * Rgba color, including red, green, blue, and alpha.
 */
export interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/**
 * Hex color literal, including text, offset, length, and color.
 */
export interface HexColorLiteral {
  text: string;
  offset: number;
  length: number;
  color: RgbaColor;
}

/**
 * Expands hex nibble into its concrete entries.
 */
function expandHexNibble(value: string): number {
  return Number.parseInt(`${value}${value}`, 16);
}

/**
 * Parses hex pair from the supplied source into the providers representation.
 */
function parseHexPair(value: string): number {
  return Number.parseInt(value, 16);
}

/** Parses CSS-style RGB/RGBA hexadecimal literals into byte-based channels. */
export function parseHexColorLiteral(text: string): RgbaColor | null {
  if (
    !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
      text,
    )
  ) {
    return null;
  }
  const hex = text.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    return {
      red: expandHexNibble(hex[0]),
      green: expandHexNibble(hex[1]),
      blue: expandHexNibble(hex[2]),
      alpha: hex.length === 4 ? expandHexNibble(hex[3]) / 255 : 1,
    };
  }
  return {
    red: parseHexPair(hex.slice(0, 2)),
    green: parseHexPair(hex.slice(2, 4)),
    blue: parseHexPair(hex.slice(4, 6)),
    alpha: hex.length === 8 ? parseHexPair(hex.slice(6, 8)) / 255 : 1,
  };
}

/** Finds every valid hexadecimal color while preserving its source range. */
export function findHexColorLiterals(text: string): HexColorLiteral[] {
  const colors: HexColorLiteral[] = [];
  for (const match of text.matchAll(HEX_COLOR_RE)) {
    const color = parseHexColorLiteral(match[0]);
    if (color && match.index !== undefined) {
      colors.push({
        text: match[0],
        offset: match.index,
        length: match[0].length,
        color,
      });
    }
  }
  return colors;
}

/**
 * Converts the supplied value to its hex byte representation.
 */
function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

/** Formats byte-based color channels for editor color presentations. */
export function formatHexColor(
  color: RgbaColor,
  includeAlpha = color.alpha < 1,
): string {
  const rgb = `#${toHexByte(color.red)}${toHexByte(color.green)}${toHexByte(color.blue)}`;
  return includeAlpha ? `${rgb}${toHexByte(color.alpha * 255)}` : rgb;
}

/** Chooses the higher-contrast text color after alpha compositing. */
export function contrastTextForColor(
  color: RgbaColor,
  base: RgbaColor = { red: 255, green: 255, blue: 255, alpha: 1 },
): '#111111' | '#ffffff' {
  const alpha = Math.max(0, Math.min(1, color.alpha));
  const baseChannels = [base.red, base.green, base.blue];
  const channels = [color.red, color.green, color.blue].map(
    (channel, index) => channel * alpha + baseChannels[index] * (1 - alpha),
  );
  const luminance =
    0.2126 * linearChannel(channels[0]) +
    0.7152 * linearChannel(channels[1]) +
    0.0722 * linearChannel(channels[2]);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? '#111111'
    : '#ffffff';
}

/**
 * Handles linear channel in the providers flow.
 */
function linearChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}
