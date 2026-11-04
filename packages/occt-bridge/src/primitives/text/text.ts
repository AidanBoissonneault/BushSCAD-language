/** Implements the text behavior owned by the OCCT bridge. */

import { PlanarShapeBridge } from '../planar-shape/planar-shape.js';

import type { IRFontRef, SourceSpan } from '@bushscad/ir';

import {
  horizontalTextAlignment,
  utf8ByteLength,
  verticalTextAlignmentCenter,
} from '../../core/text-utils.js';

import {
  isNullShape,
  occtError,
  rawErrorMessage,
} from '../../core/occt-errors.js';

import type { OC } from '../../bridge/bridge-types.js';

import {
  FONT_ALIAS_NAMES,
  BUNDLED_FONT_PATH_BY_NAME,
  FONT_ASPECT_REGULAR,
  OCCT_FALLBACK_FONT_PATH,
} from '../../bridge/occt-bridge-base.js';

export abstract class TextBridge extends PlanarShapeBridge {
  protected override buildWordShape(
    text: string,
    size: number,
    fontName: IRFontRef,
    align: 'center' | 'left' | 'right',
    span: SourceSpan,
  ): OC {
    if (text.length === 0) return this.buildEmptyWordMarker(size);

    const attempts = this.fontAttempts(fontName);
    const failures: string[] = [];
    for (const attempt of attempts) {
      const font = new this.oc.StdPrs_BRepFont_1();
      const fontString = this.ocUtf8String(attempt.value);
      try {
        const loaded =
          attempt.kind === 'path'
            ? font.Init_1(fontString, size, 0)
            : font.Init_2(fontString, FONT_ASPECT_REGULAR, size);
        if (!loaded) {
          failures.push(`${attempt.label}: unavailable`);
          continue;
        }

        const shape = this.performBRepText(text, font, align);
        if (!isNullShape(shape)) return shape;
        failures.push(`${attempt.label}: empty text shape`);
        shape?.delete?.();
      } catch (err) {
        failures.push(`${attempt.label}: ${rawErrorMessage(err)}`);
      } finally {
        fontString.delete();
        font.delete();
      }
    }

    if (typeof fontName !== 'string') {
      throw occtError(
        `Unable to build word sketch with imported font '${fontName.name}' from '${fontName.sourcePath}' (${failures.join('; ')})`,
        span,
      );
    }

    throw occtError(
      `Unable to build word sketch with font '${fontName}' or bundled fallback font (${failures.join('; ')})`,
      span,
    );
  }

  protected override fontAttempts(
    fontName: IRFontRef,
  ): { kind: 'name' | 'path'; value: string; label: string }[] {
    if (typeof fontName !== 'string') {
      return [
        {
          kind: 'path',
          value: fontName.fsPath,
          label: `imported:${fontName.name}`,
        },
      ];
    }

    const requested = fontName.trim() || 'sans';
    const bundledPath = BUNDLED_FONT_PATH_BY_NAME[requested.toLowerCase()];
    if (bundledPath) {
      return [{ kind: 'path', value: bundledPath, label: requested }];
    }

    const attempts: { kind: 'name' | 'path'; value: string; label: string }[] =
      [{ kind: 'name', value: requested, label: requested }];
    const seen = new Set([requested.toLowerCase()]);
    const aliases = FONT_ALIAS_NAMES[requested.toLowerCase()] ?? [];
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      attempts.push({ kind: 'name', value: alias, label: alias });
    }
    attempts.push({
      kind: 'path',
      value: OCCT_FALLBACK_FONT_PATH,
      label: OCCT_FALLBACK_FONT_PATH,
    });
    return attempts;
  }

  protected override performBRepText(
    text: string,
    font: OC,
    align: 'center' | 'left' | 'right',
  ): OC {
    const oc = this.oc;
    const textString = this.ocUtf8String(text);
    const origin = new oc.gp_Pnt_3(0, 0, 0);
    const normal = new oc.gp_Dir_4(0, 0, 1);
    const xDir = new oc.gp_Dir_4(1, 0, 0);
    const pen = new oc.gp_Ax3_3(origin, normal, xDir);
    const builder = new oc.StdPrs_BRepTextBuilder();
    try {
      return builder.Perform_2(
        font,
        textString,
        pen,
        horizontalTextAlignment(oc, align),
        verticalTextAlignmentCenter(oc),
      );
    } finally {
      builder.delete();
      textString.delete();
      pen.delete();
      origin.delete();
      normal.delete();
      xDir.delete();
    }
  }

  protected override ocUtf8String(value: string): OC {
    return new this.oc.NCollection_Utf8String_4(value, utf8ByteLength(value));
  }

  protected override buildEmptyWordMarker(size: number): OC {
    const wire = this.buildRect(size * 0.1, size * 0.1);
    const faceMaker = new this.oc.BRepBuilderAPI_MakeFace_15(wire, false);
    const face = faceMaker.Face();
    faceMaker.delete();
    wire.delete();
    return face;
  }
}
