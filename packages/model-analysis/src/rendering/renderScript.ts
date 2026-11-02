/**
 * @author Aidan Boissonneault
 * @file renderScript.ts
 * @purpose Renders script for the rendering in model analysis package.
 * @last-edited October 6, 2026
 */

/**
 * Returns browser-side report rendering code.
 * Keeping the script generated from TypeScript avoids adding checked-in
 * JavaScript source while still producing a standalone HTML report.
 */
export function renderScript(): string {
  return String.raw`
const data = JSON.parse(document.getElementById('report-data').textContent);
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
const cameraName = new URLSearchParams(location.search).get('view') || 'iso';
const cameras = {
  iso: [1, -1, 0.72],
  front: [0, -1, 0],
  right: [1, 0, 0],
  top: [0, 0, 1],
  bottom: [0, 0, -1],
  section: [1, -0.2, 0.15],
};
const camera = normalize(cameras[cameraName] || cameras.iso);
const upHint = Math.abs(camera[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
const right = normalize(cross(upHint, camera));
const up = normalize(cross(camera, right));
draw();
fillTables();
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bounds = combinedBounds(data.meshes);
  const center = scale(add(bounds.min, bounds.max), 0.5);
  const scalePx = 0.78 * Math.min(canvas.width, canvas.height) / Math.max(1, maxDim(bounds));
  const tris = [];
  for (const mesh of data.meshes) {
    for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
      const tri = [point(mesh, mesh.indices[i]), point(mesh, mesh.indices[i + 1]), point(mesh, mesh.indices[i + 2])];
      const projected = tri.map((p) => project(sub(p, center), scalePx));
      const normal = normalize(cross(sub(tri[1], tri[0]), sub(tri[2], tri[0])));
      tris.push({ projected, depth: tri.reduce((s, p) => s + dot(sub(p, center), camera), 0) / 3, normal, color: mesh.color || '#94a3b8' });
    }
  }
  tris.sort((a, b) => a.depth - b.depth);
  for (const tri of tris) {
    ctx.beginPath();
    ctx.moveTo(tri.projected[0][0], tri.projected[0][1]);
    ctx.lineTo(tri.projected[1][0], tri.projected[1][1]);
    ctx.lineTo(tri.projected[2][0], tri.projected[2][1]);
    ctx.closePath();
    ctx.fillStyle = shade(tri.color, tri.normal);
    ctx.fill();
  }
}
function fillTables() {
  document.getElementById('mesh-table').innerHTML = data.analysis.meshes.map((m) =>
    '<tr><td>' + m.key + '</td><td>' + m.triangleCount + ' tris</td><td>' + fmt(m.dimensions) + '</td></tr>'
  ).join('');
  document.getElementById('warnings').innerHTML = data.analysis.warnings.map((w) =>
    '<li class="warn">' + w.meshKey + ' z=' + w.z.toFixed(3) + ': ' + w.message + '</li>'
  ).join('') || '<li>None</li>';
  document.getElementById('trace-table').innerHTML = data.analysis.occtTraceEvents.slice(-80).map((e) =>
    '<tr><td>' + e.kind + '</td><td>' + (e.opKind || '') + '</td><td>' + (e.opName || '') + '</td></tr>'
  ).join('');
}
function point(mesh, index) { const i = index * 3; return [mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]]; }
function project(p, s) { return [canvas.width / 2 + dot(p, right) * s, canvas.height / 2 - dot(p, up) * s]; }
function shade(color, normal) { const light = normalize([0.45, -0.7, 1]); const f = 0.68 + 0.3 * Math.abs(dot(normal, light)); return colorMix(color, f); }
function colorMix(hex, f) { const n = parseInt(hex.replace('#', ''), 16); const r = Math.min(255, ((n >> 16) & 255) * f); const g = Math.min(255, ((n >> 8) & 255) * f); const b = Math.min(255, (n & 255) * f); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
function combinedBounds(meshes) { const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; for (const m of meshes) for (let i = 0; i + 2 < m.vertices.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], m.vertices[i + a]); max[a] = Math.max(max[a], m.vertices[i + a]); } return { min, max }; }
function maxDim(b) { return Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]); }
function fmt(v) { return v.map((n) => n.toFixed(2)).join(' x '); }
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]} function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function scale(a,s){return [a[0]*s,a[1]*s,a[2]*s]} function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function normalize(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}
`;
}
