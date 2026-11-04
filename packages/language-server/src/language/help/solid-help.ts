/**
 * @author Aidan Boissonneault
 * @file solid-help.ts
 * @purpose Provides solid help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import { axialPrimitiveHelp } from './axial-primitive-help.js';
import { detailOperationHelp } from './detail-operation-help.js';
import { hardwareOperationHelp } from './hardware-operation-help.js';
import { importedShapeHelp } from './imported-shape-help.js';
import { primitiveHelp } from './primitive-help.js';
import { profileOperationHelp } from './profile-operation-help.js';
import { radialCurveHelp } from './radial-curve-help.js';
import { radialOperationHelp } from './radial-operation-help.js';
import { surfaceOperationHelp } from './surface-operation-help.js';
import { transformOperationHelp } from './transform-operation-help.js';
import type { LanguageHelpEntry } from './types.js';
import { threadHelp } from './thread-help.js';

export const solidHelp: Record<string, LanguageHelpEntry> = {
  ...primitiveHelp,
  ...axialPrimitiveHelp,
  ...profileOperationHelp,
  ...detailOperationHelp,
  ...surfaceOperationHelp,
  ...radialOperationHelp,
  ...radialCurveHelp,
  ...transformOperationHelp,
  ...importedShapeHelp,
  ...hardwareOperationHelp,
  ...threadHelp,
};
