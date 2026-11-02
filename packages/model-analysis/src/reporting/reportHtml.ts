/**
 * @author Aidan Boissonneault
 * @file reportHtml.ts
 * @purpose Provides report html behavior for the reporting in model analysis package.
 * @last-edited October 6, 2026
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ReportData } from './reportData.js';
import { renderScript } from '../rendering/renderScript.js';

/**
 * Writes the standalone visual analysis report.
 * A plain HTML artifact gives Codex and humans the same deterministic viewport
 * for screenshots, mesh metrics, and trace review.
 */
export async function writeReportHtml(
  path: string,
  data: ReportData,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, html(data), 'utf8');
}

/**
 * Handles html in the reporting flow.
 */
function html(data: ReportData): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>BushSCAD Model Analysis</title>
<style>
body{font:14px system-ui,sans-serif;margin:0;color:#172033;background:#f8fafc}
header{padding:16px 20px;background:#111827;color:white}
main{display:grid;grid-template-columns:minmax(420px,1fr) 380px;gap:16px;padding:16px}
canvas{width:100%;height:640px;background:#ffffff;border:1px solid #d1d5db}
section{background:white;border:1px solid #d1d5db;border-radius:6px;padding:12px}
table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #e5e7eb;padding:4px;text-align:left}
.warn{color:#b45309}.err{color:#b91c1c}
</style>
</head>
<body>
<header><h1>BushSCAD Model Analysis</h1></header>
<main>
<section><canvas id="view" width="1200" height="800"></canvas></section>
<section>
<h2>Meshes</h2>
<table><tbody id="mesh-table"></tbody></table>
<h2>Warnings</h2><ul id="warnings"></ul>
<h2>Trace</h2><table><tbody id="trace-table"></tbody></table>
</section>
</main>
<script id="report-data" type="application/json">${escapeJson(data)}</script>
<script>${renderScript()}</script>
</body>
</html>
`;
}

/**
 * Handles escape json in the reporting flow.
 */
function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
