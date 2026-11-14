(function() {
const cloneHeaderStyle = document.createElement('style');
cloneHeaderStyle.textContent = 'body.clone-active .header{pointer-events:none;opacity:0.4;user-select:none;}';
document.head.appendChild(cloneHeaderStyle);
function setCloneUI(on) {
document.body.classList.toggle('clone-active', on);
}
let cloneSystemModal = null;
let originalCanvas = null;
let editCanvas = null;
let originalCtx = null;
let editCtx = null;
let brushCursor = null;
let altCursor = null;
let previewCanvas = null;
let previewCtx = null;
let tempCanvas = null;
let tempCtx = null;
let cursorTempCanvas = null;
let cursorTempCtx = null;
let cursorMaskCanvas = null;
let cursorMaskCtx = null;
let cursorMaskKey = '';
let pendingMoveEvent = null;
let moveRafId = 0;
let cachedCanvasRect = null;
let cachedContainerRect = null;
let brushMaskCache = { size: -1, feather: -1, alpha: null };
let originalImageCopy = null;
let patchPreviewCanvas = null;
let patchPreviewCtx = null;
let patchOverlayCanvas = null;
let patchOverlayCtx = null;
let patchMaskCanvas = null;
let patchMaskCtx = null;
let isPatchModeActive = false;
let patchPhase = 'idle';
let patchPoints = [];
let patchStart = [0, 0];
let patchOff = [0, 0];
let patchBase = null;
let patchBaseScale = 1;
let patchRenderScale = 1;
let patchDpr = 1;
let patchAntsRAF = 0;
let patchDashOffset = 0;
let patchAntsLastT = 0;
let patchUpHandled = false;
let patchBusy = false;
let patchWorker = null;
let baseScale = 1; 
let displayScale = 1; 
const minDisplayScale = 0.3; 
const maxDisplayScale = 9.9; 
let zoomValueElement = null;
let isSampling = false;
let isDrawing = false;
let currentTool = 'clone';
let brushSize = 100;
let clonefeatherValue = 100;
let dataSource = 'edited';
let samplePoint = null;
let firstDrawPoint = null;
let offset = null;
let lastDrawPoint = null;
let hasStartedDrawing = false;
let isDragModeActive = false;
let isDraggingImage = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;
const PATCH_OUTSIDE = 0, PATCH_RING = 1, PATCH_HOLE = 2;
function patchHealSolve(value, role, w, h, depth) {
let iterations = 120;
if (w > 32 && h > 32 && depth < 16) {
const cw = (w + 1) >> 1, ch = (h + 1) >> 1;
const coarse = new Float32Array(cw * ch * 4);
const coarseRole = new Uint8Array(cw * ch);
for (let y = 0; y < ch; ++y) {
for (let x = 0; x < cw; ++x) {
let known = 0, hole = 0;
const knownSum = [0, 0, 0, 0], holeSum = [0, 0, 0, 0];
for (let j = 0; j < 2; ++j) for (let i = 0; i < 2; ++i) {
const fx = x * 2 + i, fy = y * 2 + j;
if (fx >= w || fy >= h) continue;
const p = fy * w + fx;
if (role[p] === PATCH_RING) { ++known; for (let c = 0; c < 4; ++c) knownSum[c] += value[p * 4 + c]; }
else if (role[p] === PATCH_HOLE) { ++hole; for (let c = 0; c < 4; ++c) holeSum[c] += value[p * 4 + c]; }
}
const q = y * cw + x;
if (known) { coarseRole[q] = PATCH_RING; for (let c = 0; c < 4; ++c) coarse[q * 4 + c] = knownSum[c] / known; }
else if (hole) { coarseRole[q] = PATCH_HOLE; for (let c = 0; c < 4; ++c) coarse[q * 4 + c] = holeSum[c] / hole; }
}
}
patchHealSolve(coarse, coarseRole, cw, ch, depth + 1);
for (let y = 0; y < h; ++y) {
for (let x = 0; x < w; ++x) {
const p = y * w + x, q = ((y >> 1) * cw + (x >> 1));
if (role[p] === PATCH_HOLE && coarseRole[q] === PATCH_HOLE) {
value[p * 4] = coarse[q * 4]; value[p * 4 + 1] = coarse[q * 4 + 1];
value[p * 4 + 2] = coarse[q * 4 + 2]; value[p * 4 + 3] = coarse[q * 4 + 3];
}
}
}
iterations = 20;
}
const omega = 1.8;
for (let it = 0; it < iterations; ++it) {
let maxDelta = 0;
for (let y = 0; y < h; ++y) {
for (let x = 0; x < w; ++x) {
const p = y * w + x;
if (role[p] !== PATCH_HOLE) continue;
let n = 0;
let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
if (x > 0) { const q = p - 1; if (role[q] !== PATCH_OUTSIDE) { s0 += value[q * 4]; s1 += value[q * 4 + 1]; s2 += value[q * 4 + 2]; s3 += value[q * 4 + 3]; ++n; } }
if (x < w - 1) { const q = p + 1; if (role[q] !== PATCH_OUTSIDE) { s0 += value[q * 4]; s1 += value[q * 4 + 1]; s2 += value[q * 4 + 2]; s3 += value[q * 4 + 3]; ++n; } }
if (y > 0) { const q = p - w; if (role[q] !== PATCH_OUTSIDE) { s0 += value[q * 4]; s1 += value[q * 4 + 1]; s2 += value[q * 4 + 2]; s3 += value[q * 4 + 3]; ++n; } }
if (y < h - 1) { const q = p + w; if (role[q] !== PATCH_OUTSIDE) { s0 += value[q * 4]; s1 += value[q * 4 + 1]; s2 += value[q * 4 + 2]; s3 += value[q * 4 + 3]; ++n; } }
if (!n) continue;
const f = 1 / n;
const d0 = omega * (s0 * f - value[p * 4]);
const d1 = omega * (s1 * f - value[p * 4 + 1]);
const d2 = omega * (s2 * f - value[p * 4 + 2]);
const d3 = omega * (s3 * f - value[p * 4 + 3]);
value[p * 4] += d0; value[p * 4 + 1] += d1; value[p * 4 + 2] += d2; value[p * 4 + 3] += d3;
let a = d0 < 0 ? -d0 : d0;
const a1 = d1 < 0 ? -d1 : d1; if (a1 > a) a = a1;
const a2 = d2 < 0 ? -d2 : d2; if (a2 > a) a = a2;
const a3 = d3 < 0 ? -d3 : d3; if (a3 > a) a = a3;
if (a > maxDelta) maxDelta = a;
}
}
if (maxDelta < 1.0) break;
}
}
function patchMakeAdapter(dest, src, ringPix, W, wx0, wy0) {
const n = ringPix.length >> 1;
if (n < 8) return (c, v) => v;
const muD = [0, 0, 0, 0], muS = [0, 0, 0, 0], sd = [0, 0, 0, 0], ss = [0, 0, 0, 0], k = [1, 1, 1, 1];
for (let i = 0; i < ringPix.length; i += 2) {
const t = ((wy0 + ringPix[i + 1]) * W + wx0 + ringPix[i]) * 4;
for (let c = 0; c < 4; ++c) {
const dv = dest[t + c], sv = src[t + c];
muD[c] += dv; sd[c] += dv * dv; muS[c] += sv; ss[c] += sv * sv;
}
}
for (let c = 0; c < 4; ++c) {
muD[c] /= n; muS[c] /= n;
const vd = Math.max(sd[c] / n - muD[c] * muD[c], 0), vs = Math.max(ss[c] / n - muS[c] * muS[c], 0);
if (vs > 4) k[c] = Math.min(2, Math.max(0.5, Math.sqrt(vd / vs)));
}
return (c, v) => muD[c] + (v - muS[c]) * k[c];
}
function patchBlend(dest, src, cov, W, H, bx0, by0, bx1, by1) {
const size = Math.max(bx1 - bx0, by1 - by0);
let ring = Math.floor(size / 8); if (ring < 2) ring = 2; if (ring > 16) ring = 16;
const wx0 = Math.max(0, bx0 - ring), wy0 = Math.max(0, by0 - ring);
const wx1 = Math.min(W, bx1 + ring), wy1 = Math.min(H, by1 + ring);
const ww = wx1 - wx0, wh = wy1 - wy0, wn = ww * wh;
const role = new Uint8Array(wn), near = new Uint8Array(wn), prefix = new Int32Array(Math.max(ww, wh) + 1);
for (let y = 0; y < wh; ++y)
for (let x = 0; x < ww; ++x)
role[y * ww + x] = cov[(wy0 + y) * W + wx0 + x] ? PATCH_HOLE : PATCH_OUTSIDE;
for (let y = 0; y < wh; ++y) {
prefix[0] = 0;
for (let x = 0; x < ww; ++x) prefix[x + 1] = prefix[x] + (role[y * ww + x] === PATCH_HOLE ? 1 : 0);
for (let x = 0; x < ww; ++x) {
const lo = Math.max(0, x - ring), hi = Math.min(ww, x + ring + 1);
if (prefix[hi] - prefix[lo] > 0) near[y * ww + x] = 1;
}
}
let ringCount = 0;
for (let x = 0; x < ww; ++x) {
prefix[0] = 0;
for (let y = 0; y < wh; ++y) prefix[y + 1] = prefix[y] + near[y * ww + x];
for (let y = 0; y < wh; ++y) {
const lo = Math.max(0, y - ring), hi = Math.min(wh, y + ring + 1);
const p = y * ww + x;
if (role[p] === PATCH_OUTSIDE && prefix[hi] - prefix[lo] > 0) { role[p] = PATCH_RING; ++ringCount; }
}
}
if (!ringCount) return false;
const ringPix = new Int32Array(ringCount * 2);
{ let qi = 0;
for (let y = 0; y < wh; ++y) for (let x = 0; x < ww; ++x)
if (role[y * ww + x] === PATCH_RING) { ringPix[qi++] = x; ringPix[qi++] = y; } }
const adapt = patchMakeAdapter(dest, src, ringPix, W, wx0, wy0);
const value = new Float32Array(wn * 4);
const mean = [0, 0, 0, 0];
for (let y = 0; y < wh; ++y) for (let x = 0; x < ww; ++x) {
const p = y * ww + x;
if (role[p] !== PATCH_RING) continue;
const t = ((wy0 + y) * W + wx0 + x) * 4;
for (let c = 0; c < 4; ++c) { const v = dest[t + c] - adapt(c, src[t + c]); value[p * 4 + c] = v; mean[c] += v; }
}
for (let c = 0; c < 4; ++c) mean[c] /= ringCount;
for (let p = 0; p < wn; ++p)
if (role[p] === PATCH_HOLE) { value[p * 4] = mean[0]; value[p * 4 + 1] = mean[1]; value[p * 4 + 2] = mean[2]; value[p * 4 + 3] = mean[3]; }
patchHealSolve(value, role, ww, wh, 0);
for (let y = 0; y < wh; ++y) for (let x = 0; x < ww; ++x) {
const p = y * ww + x;
if (role[p] !== PATCH_HOLE) continue;
const t = ((wy0 + y) * W + wx0 + x) * 4;
for (let c = 0; c < 3; ++c) {
const v = adapt(c, src[t + c]) + value[p * 4 + c];
dest[t + c] = v < 0 ? 0 : v > 255 ? 255 : v;
}
}
return true;
}
function patchPointInPoly(x, y, pts) {
let inside = false;
for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
const [xi, yi] = pts[i], [xj, yj] = pts[j];
if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
}
return inside;
}
function patchPolyArea(pts) {
let a = 0;
for (let i = 0, n = pts.length; i < n; ++i) {
const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
a += x1 * y2 - x2 * y1;
}
return a / 2;
}
function patchPolyBounds(pts) {
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
return { x0, y0, x1, y1 };
}
function getActualScale() {
return baseScale * displayScale;
}
function updateZoomValue() {
if (zoomValueElement) {
const percentage = Math.round(displayScale * 100);
zoomValueElement.textContent = `${percentage}%`;
}
}
function initCloneSystem() {
createCloneSystemModal();
}
function createCloneSystemModal() {
cloneSystemModal = document.createElement('div');
cloneSystemModal.className = 'modal';
cloneSystemModal.id = 'cloneSystemModal';
cloneSystemModal.style.display = 'none';
cloneSystemModal.style.position = 'fixed';
cloneSystemModal.style.top = '0';
cloneSystemModal.style.left = '0';
cloneSystemModal.style.width = '100%';
cloneSystemModal.style.height = 'calc(100vh - 50px)';
cloneSystemModal.style.marginTop = '50px';
cloneSystemModal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
cloneSystemModal.style.zIndex = '1000';
cloneSystemModal.style.alignItems = 'center';
cloneSystemModal.style.justifyContent = 'center';
const modalContent = document.createElement('div');
modalContent.className = 'modal-content';
modalContent.style.backgroundColor = '#fff';
modalContent.style.width = '100%';
modalContent.style.height = '100%';
modalContent.style.overflow = 'hidden';
const mainContainer = document.createElement('div');
mainContainer.className = 'clone-system-container';
const canvasContainer = document.createElement('div');
canvasContainer.className = 'canvas-container';
originalCanvas = document.createElement('canvas');
originalCanvas.id = 'originalCanvas';
originalCanvas.style.display = 'none';
editCanvas = document.createElement('canvas');
editCanvas.id = 'editCanvas';
brushCursor = document.createElement('div');
brushCursor.id = 'brushCursor';
brushCursor.className = 'brush-cursor';
altCursor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
altCursor.id = 'altCursor';
altCursor.style.display = 'none';
altCursor.style.position = 'absolute';
altCursor.style.pointerEvents = 'none';
altCursor.style.zIndex = '9999';
altCursor.setAttribute('width', '50');
altCursor.setAttribute('height', '50');
altCursor.setAttribute('viewBox', '0 0 1024 1024');
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
circle.setAttribute('cx', '512');
circle.setAttribute('cy', '512');
circle.setAttribute('r', '482');
circle.setAttribute('fill', 'white');
circle.setAttribute('fill-opacity', '0.5');
const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
path.setAttribute('d', 'M511.964696 959.159226c-246.923786 0-447.124434-200.26614-447.124434-447.187879 0-246.928902 200.201671-447.12955 447.124434-447.12955 246.927879 0 447.195042 200.201671 447.195042 447.12955C959.158714 758.893086 758.891552 959.159226 511.964696 959.159226L511.964696 959.159226zM531.423887 104.705714l0 123.933637c0 10.769274-8.689916 19.460214-19.460214 19.460214-10.704806 0-19.394722-8.69094-19.394722-19.460214L492.56895 104.705714c-209.961966 9.948583-378.008286 177.966251-387.898541 387.863748l157.820422 0c10.734482 0 19.425422 8.691963 19.425422 19.400862 0 10.768251-8.69094 19.459191-19.425422 19.459191L104.670409 531.429515c9.890254 209.896474 177.937598 377.915166 387.898541 387.864772L492.56895 784.210705c0-10.768251 8.689916-19.459191 19.394722-19.459191 10.769274 0 19.460214 8.689916 19.460214 19.459191l0 135.084605c209.959919-9.950629 377.920282-177.968297 387.80542-387.864772L803.605939 531.430538c-10.734482 0-19.424398-8.69094-19.424398-19.459191 0-10.709923 8.689916-19.400862 19.424398-19.400862l115.623367 0C909.345192 282.671964 741.383806 114.654296 531.423887 104.705714L531.423887 104.705714z');
path.setAttribute('fill', '#2c2c2c');
altCursor.appendChild(circle);
altCursor.appendChild(path);
previewCanvas = document.createElement('canvas');
previewCanvas.id = 'previewCanvas';
previewCanvas.style.display = 'none';
previewCanvas.style.position = 'absolute';
previewCanvas.style.pointerEvents = 'none';
previewCanvas.style.zIndex = '5';
previewCanvas.style.borderRadius = '50%';
patchPreviewCanvas = document.createElement('canvas');
patchPreviewCanvas.id = 'patchPreviewCanvas';
patchPreviewCanvas.style.position = 'absolute';
patchPreviewCanvas.style.left = '0';
patchPreviewCanvas.style.top = '0';
patchPreviewCanvas.style.transformOrigin = '0 0';
patchPreviewCanvas.style.pointerEvents = 'none';
patchPreviewCanvas.style.zIndex = '30';
patchPreviewCanvas.style.display = 'none';
patchOverlayCanvas = document.createElement('canvas');
patchOverlayCanvas.id = 'patchOverlayCanvas';
patchOverlayCanvas.style.position = 'absolute';
patchOverlayCanvas.style.left = '0';
patchOverlayCanvas.style.top = '0';
patchOverlayCanvas.style.transformOrigin = '0 0';
patchOverlayCanvas.style.pointerEvents = 'none';
patchOverlayCanvas.style.zIndex = '40';
patchOverlayCanvas.style.display = 'none';
loadingIndicator = document.createElement('div');
loadingIndicator.id = 'cloneLoadingIndicator';
loadingIndicator.className = 'loading-indicator';
loadingIndicator.textContent = '正在解析....请解析完成后重新打开';
loadingIndicator.style.position = 'absolute';
loadingIndicator.style.top = '35%';
loadingIndicator.style.left = '50%';
loadingIndicator.style.transform = 'translate(-50%, -50%)';
loadingIndicator.style.fontSize = '18px';
loadingIndicator.style.color = '#7b7b7bff';
loadingIndicator.style.padding = '15px 30px';
loadingIndicator.style.borderRadius = '5px';
loadingIndicator.style.zIndex = '10000';
loadingIndicator.style.display = 'none';
canvasContainer.appendChild(originalCanvas);
canvasContainer.appendChild(editCanvas);
canvasContainer.appendChild(patchPreviewCanvas);
canvasContainer.appendChild(patchOverlayCanvas);
canvasContainer.appendChild(brushCursor);
canvasContainer.appendChild(altCursor);
canvasContainer.appendChild(previewCanvas);
canvasContainer.appendChild(loadingIndicator);
const toolbox = document.createElement('div');
toolbox.className = 'clone-toolbox';
const toolModeGroup = document.createElement('div');
toolModeGroup.className = 'brush-tool-group';
toolModeGroup.id = 'cloneToolModeGroup';
const toolModeRow = document.createElement('div');
toolModeRow.className = 'tool-row';
const brushToolBtn = document.createElement('button');
brushToolBtn.id = 'cloneBrushTool';
brushToolBtn.className = 'clone-tool-btn active';
brushToolBtn.title = '画笔';
brushToolBtn.innerHTML = '<img src="css/icon-stamp.svg" width="20" height="20" alt="画笔">';
brushToolBtn.addEventListener('click', () => selectCloneTool('brush'));
const patchToolBtn = document.createElement('button');
patchToolBtn.id = 'clonePatchTool';
patchToolBtn.className = 'clone-tool-btn';
patchToolBtn.title = '修补';
patchToolBtn.innerHTML = '<img src="css/icon-xiubu.svg" width="20" height="20" alt="修补">';
patchToolBtn.addEventListener('click', () => selectCloneTool('patch'));
const dragToolBtn = document.createElement('button');
dragToolBtn.id = 'cloneDragTool';
dragToolBtn.className = 'clone-tool-btn';
dragToolBtn.title = '拖拽';
dragToolBtn.innerHTML = '<img src="css/icon-drag.svg" width="20" height="20" alt="拖拽">';
dragToolBtn.addEventListener('click', () => selectCloneTool('drag'));
toolModeRow.appendChild(dragToolBtn);
toolModeRow.appendChild(brushToolBtn);
toolModeRow.appendChild(patchToolBtn);
toolModeGroup.appendChild(toolModeRow);
const toolGroup = document.createElement('div');
toolGroup.className = 'clone-tool-container';
const toolRow = document.createElement('div');
toolRow.className = 'tool-row';
toolGroup.appendChild(toolRow);
const zoomGroup = document.createElement('div');
zoomGroup.className = 'tool-group';
const zoomLabelContainer = document.createElement('div');
zoomLabelContainer.className = 'label-value-container';
const zoomLabel = document.createElement('label');
zoomLabel.textContent = '缩放';
zoomValueElement = document.createElement('span');
zoomValueElement.id = 'cloneZoomValue';
zoomValueElement.className = 'value-display';
zoomValueElement.textContent = '100%';
zoomLabelContainer.appendChild(zoomLabel);
zoomLabelContainer.appendChild(zoomValueElement);
const zoomControls = document.createElement('div');
zoomControls.style.display = 'flex';
zoomControls.style.alignItems = 'center';
zoomControls.style.gap = '5px';
const zoomOutButton = document.createElement('button');
zoomOutButton.id = 'cloneZoomOutButton';
zoomOutButton.className = 'clone-tool-btn';
zoomOutButton.title = '缩小（Ctrl + -）';
zoomOutButton.innerHTML = '<img src="css/icon-zoom-out.svg" width="20" height="20" alt="缩小">';
const zoomInButton = document.createElement('button');
zoomInButton.id = 'cloneZoomInButton';
zoomInButton.className = 'clone-tool-btn';
zoomInButton.title = '放大（Ctrl + +）';
zoomInButton.innerHTML = '<img src="css/icon-zoom-in.svg" width="20" height="20" alt="放大">';
const resetBtn = document.createElement('button');
resetBtn.id = 'resetBtn';
resetBtn.className = 'clone-tool-btn';
resetBtn.title = '重置图像';
resetBtn.innerHTML = '<img src="css/icon-redo.svg" width="20" height="20" alt="重置">';
resetBtn.addEventListener('click', resetCloneSystem);
toolRow.appendChild(resetBtn);
toolRow.appendChild(zoomOutButton);
toolRow.appendChild(zoomInButton);
const uploadContainer = document.createElement('div');
uploadContainer.className = 'clone-tool-group';
const uploadInput = document.createElement('input');
uploadInput.type = 'file';
uploadInput.id = 'imageUpload';
uploadInput.accept = 'image/*';
uploadInput.addEventListener('change', handleImageUpload);
uploadContainer.appendChild(uploadInput);
const clonebrushSizeGroup = document.createElement('div');
clonebrushSizeGroup.className = 'tool-group';
clonebrushSizeGroup.id = 'cloneBrushSizeGroup';
const clonebrushSizeLabelContainer = document.createElement('div');
clonebrushSizeLabelContainer.className = 'label-value-container';
const brushSizeLabel = document.createElement('label');
brushSizeLabel.textContent = '半径';
const clonebrushSizeValue = document.createElement('span');
clonebrushSizeValue.id = 'clonebrushSizeValue';
clonebrushSizeValue.className = 'value-display';
clonebrushSizeValue.textContent = `${brushSize}`;
clonebrushSizeLabelContainer.appendChild(brushSizeLabel);
clonebrushSizeLabelContainer.appendChild(clonebrushSizeValue);
const clonebrushSizeSlider = document.createElement('input');
clonebrushSizeSlider.type = 'range';
clonebrushSizeSlider.id = 'brushSize';
clonebrushSizeSlider.className = 'slider-track';
clonebrushSizeSlider.min = '2';
clonebrushSizeSlider.max = '1000';
clonebrushSizeSlider.value = brushSize;
clonebrushSizeSlider.addEventListener('input', function() {
brushSize = parseInt(this.value);
document.getElementById('clonebrushSizeValue').textContent = `${brushSize}`;
});
clonebrushSizeGroup.appendChild(clonebrushSizeLabelContainer);
clonebrushSizeGroup.appendChild(clonebrushSizeSlider);
const clonefeatherGroup = document.createElement('div');
clonefeatherGroup.className = 'tool-group';
clonefeatherGroup.id = 'cloneFeatherGroup';
const clonefeatherLabelContainer = document.createElement('div');
clonefeatherLabelContainer.className = 'label-value-container';
const clonefeatherLabel = document.createElement('label');
clonefeatherLabel.textContent = '羽化';
const clonefeatherValueDisplay = document.createElement('span');
clonefeatherValueDisplay.id = 'clonefeatherValue';
clonefeatherValueDisplay.className = 'value-display';
clonefeatherValueDisplay.textContent = `${clonefeatherValue}%`;
clonefeatherLabelContainer.appendChild(clonefeatherLabel);
clonefeatherLabelContainer.appendChild(clonefeatherValueDisplay);
const clonefeatherSlider = document.createElement('input');
clonefeatherSlider.type = 'range';
clonefeatherSlider.id = 'clonefeather';
clonefeatherSlider.className = 'slider-track';
clonefeatherSlider.min = '0';
clonefeatherSlider.max = '100';
clonefeatherSlider.value = clonefeatherValue;
clonefeatherSlider.addEventListener('input', function() {
clonefeatherValue = parseInt(this.value);
document.getElementById('clonefeatherValue').textContent = `${clonefeatherValue}%`;
});
clonefeatherGroup.appendChild(clonefeatherLabelContainer);
clonefeatherGroup.appendChild(clonefeatherSlider);
const dataSourceGroup = document.createElement('div');
dataSourceGroup.className = 'clone-tool-group';
dataSourceGroup.id = 'cloneDataSourceGroup';
const dataSourceLabel = document.createElement('span');
dataSourceLabel.textContent = '采样源';
dataSourceLabel.style.color = '#999';
dataSourceLabel.style.fontSize = '14px';
const helpIcon = document.createElement('span');
helpIcon.className = 'circle-question';
helpIcon.textContent = '?';
helpIcon.dataset.tip = '按住 alt 键（ Mac 按 Option 键 ）获取采样源。当前图层：经过克隆编辑后的图像作为采样源；原始图层：使用最原始的图像数据作为采样源。';
dataSourceLabel.appendChild(helpIcon);
const dataSourceSelect = document.createElement('select');
dataSourceSelect.id = 'dataSource';
dataSourceSelect.style.width = '100%';
dataSourceSelect.style.marginTop = '-5px';
dataSourceSelect.style.marginBottom = '20px';
dataSourceSelect.innerHTML = `<option value="edited" selected>当前图层</option>
<option value="original">原始图层</option>`;
dataSourceSelect.addEventListener('change', function() {
dataSource = this.value;
});
dataSourceGroup.appendChild(dataSourceLabel);
dataSourceGroup.appendChild(document.createElement('br'));
dataSourceGroup.appendChild(dataSourceSelect);
zoomOutButton.addEventListener('click', () => {
applyDisplayScale(displayScale - 0.1);
});
zoomInButton.addEventListener('click', () => {
applyDisplayScale(displayScale + 0.1);
});
const zoomSlider = document.createElement('input');
zoomSlider.type = 'range';
zoomSlider.id = 'cloneZoomSlider';
zoomSlider.className = 'slider-track';
zoomSlider.step = 0.1;
zoomSlider.style.flex = '1';
zoomSlider.addEventListener('input', function() {
applyDisplayScale(parseFloat(this.value));
});
const resetZoomButton = document.createElement('button');
resetZoomButton.id = 'cloneResetZoomButton';
resetZoomButton.className = 'clone-tool-btn';
resetZoomButton.title = '自适应大小（Ctrl + 0）';
resetZoomButton.innerHTML = '<img src="css/icon-zoom-auto.svg" width="20" height="20" alt="drag">';
resetZoomButton.addEventListener('click', () => {
fitCloneCanvasToContainer();
});
toolRow.appendChild(resetZoomButton);
zoomControls.appendChild(zoomSlider);
zoomGroup.appendChild(zoomLabelContainer);
zoomGroup.appendChild(zoomControls);
const actionBtnGroup = document.createElement('div');
actionBtnGroup.className = 'clone-tool-group action-buttons';
const cancelBtn = document.createElement('button');
cancelBtn.id = 'cancelCloneDemo';
cancelBtn.className = 'action-btn cancel';
cancelBtn.textContent = '取消';
cancelBtn.addEventListener('click', closeCloneSystemModal);
const confirmBtn = document.createElement('button');
confirmBtn.id = 'confirmCloneDemo';
confirmBtn.className = 'action-btn confirm';
confirmBtn.textContent = '保存';
confirmBtn.addEventListener('click', confirmCloneSystem);
actionBtnGroup.appendChild(cancelBtn);
actionBtnGroup.appendChild(confirmBtn);
toolbox.appendChild(clonefeatherGroup);
toolbox.appendChild(clonebrushSizeGroup);
toolbox.appendChild(zoomGroup);
toolbox.appendChild(toolModeGroup);
toolbox.appendChild(toolGroup);
toolbox.appendChild(uploadContainer);
toolbox.appendChild(dataSourceGroup);
toolbox.appendChild(actionBtnGroup);
mainContainer.appendChild(canvasContainer);
mainContainer.appendChild(toolbox);
modalContent.appendChild(mainContainer);
cloneSystemModal.appendChild(modalContent);
document.body.appendChild(cloneSystemModal);
originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
editCtx = editCanvas.getContext('2d', { willReadFrequently: true });
previewCtx = previewCanvas.getContext('2d');
tempCanvas = document.createElement('canvas');
tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
patchOverlayCtx = patchOverlayCanvas.getContext('2d');
patchPreviewCtx = patchPreviewCanvas.getContext('2d');
patchMaskCanvas = document.createElement('canvas');
patchMaskCtx = patchMaskCanvas.getContext('2d', { willReadFrequently: true });
setupEventListeners();
}
function applyDisplayScale(newDisplayScale, centerX, centerY) {
const clampedScale = Math.min(Math.max(minDisplayScale, newDisplayScale), maxDisplayScale);
const container = editCanvas.parentElement;
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;
const actualScale = getActualScale();
const newActualScale = baseScale * clampedScale;
const rect = editCanvas.getBoundingClientRect();
const currentLeft = parseFloat(editCanvas.style.left) || 0;
const currentTop = parseFloat(editCanvas.style.top) || 0;
const pivotX = centerX !== undefined ? centerX : containerWidth / 2;
const pivotY = centerY !== undefined ? centerY : containerHeight / 2;
const relativeX = pivotX - rect.left;
const relativeY = pivotY - rect.top;
const scaleRatio = newActualScale / actualScale;
const newLeft = currentLeft + relativeX * (1 - scaleRatio);
const newTop = currentTop + relativeY * (1 - scaleRatio);
displayScale = clampedScale;
editCanvas.style.transform = `scale(${newActualScale})`;
editCanvas.style.transformOrigin = '0 0';
editCanvas.style.left = `${newLeft}px`;
editCanvas.style.top = `${newTop}px`;
syncPatchOverlayTransform();
updateZoomValue();
updateZoomSlider();
invalidateRectCache();
}
function fitCloneCanvasToContainer() {
const container = editCanvas.parentElement;
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;
if (!containerWidth || !containerHeight || !editCanvas.width || !editCanvas.height) return;

baseScale = Math.min(containerWidth / editCanvas.width, containerHeight / editCanvas.height);
displayScale = 1.0; 
centerImage();
updateZoomValue();
updateZoomSlider();
}
function updateZoomSlider() {
const zoomSlider = document.getElementById('cloneZoomSlider');
if (zoomSlider) {
zoomSlider.min = minDisplayScale;
zoomSlider.max = maxDisplayScale;
zoomSlider.value = displayScale;
}
}
function centerImage() {
const container = editCanvas.parentElement;
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;
if (!containerWidth || !containerHeight || !editCanvas.width || !editCanvas.height) return;
const actualScale = getActualScale();
const scaledWidth = editCanvas.width * actualScale;
const scaledHeight = editCanvas.height * actualScale;
editCanvas.style.transform = `scale(${actualScale})`;
editCanvas.style.transformOrigin = '0 0';
editCanvas.style.left = `${(containerWidth - scaledWidth) / 2}px`;
editCanvas.style.top = `${(containerHeight - scaledHeight) / 2}px`;
syncPatchOverlayTransform();
invalidateRectCache();
}
function selectCloneTool(type) {
const brushBtn = document.getElementById('cloneBrushTool');
const dragBtn = document.getElementById('cloneDragTool');
const patchBtn = document.getElementById('clonePatchTool');
if (type === 'drag') {
isDragModeActive = true;
isPatchModeActive = false;
editCanvas.style.cursor = 'grab';
if (dragBtn) dragBtn.classList.add('active');
if (brushBtn) brushBtn.classList.remove('active');
if (patchBtn) patchBtn.classList.remove('active');
} else if (type === 'patch') {
isDragModeActive = false;
isPatchModeActive = true;
editCanvas.style.cursor = 'crosshair';
if (dragBtn) dragBtn.classList.remove('active');
if (brushBtn) brushBtn.classList.remove('active');
if (patchBtn) patchBtn.classList.add('active');
clearPatchSelection();
} else {
isDragModeActive = false;
isPatchModeActive = false;
editCanvas.style.cursor = 'default';
if (dragBtn) dragBtn.classList.remove('active');
if (brushBtn) brushBtn.classList.add('active');
if (patchBtn) patchBtn.classList.remove('active');
}
hideBrushCursor();
}
function syncPatchOverlayTransform() {
if (!patchOverlayCanvas || !editCanvas) return;
patchRenderScale = getActualScale();
patchDpr = window.devicePixelRatio || 1;
const cw = Math.max(1, Math.round(editCanvas.width * patchRenderScale));
const ch = Math.max(1, Math.round(editCanvas.height * patchRenderScale));
const iw = Math.round(cw * patchDpr);
const ih = Math.round(ch * patchDpr);
patchOverlayCanvas.style.transform = 'none';
patchOverlayCanvas.style.left = editCanvas.style.left;
patchOverlayCanvas.style.top = editCanvas.style.top;
patchOverlayCanvas.style.width = cw + 'px';
patchOverlayCanvas.style.height = ch + 'px';
if (patchOverlayCanvas.width !== iw || patchOverlayCanvas.height !== ih) {
patchOverlayCanvas.width = iw;
patchOverlayCanvas.height = ih;
}
if (patchPreviewCanvas) {
patchPreviewCanvas.style.transform = 'none';
patchPreviewCanvas.style.left = editCanvas.style.left;
patchPreviewCanvas.style.top = editCanvas.style.top;
patchPreviewCanvas.style.width = cw + 'px';
patchPreviewCanvas.style.height = ch + 'px';
if (patchPreviewCanvas.width !== iw || patchPreviewCanvas.height !== ih) {
patchPreviewCanvas.width = iw;
patchPreviewCanvas.height = ih;
}
}
}
function stopPatchAnts() { if (patchAntsRAF) { cancelAnimationFrame(patchAntsRAF); patchAntsRAF = 0; } }
function clearPatchSelection() {
stopPatchAnts();
patchPhase = 'idle'; patchPoints = []; patchOff = [0, 0]; patchBase = null;
patchDashOffset = 0;
if (patchPreviewCanvas && patchPreviewCtx) { patchPreviewCtx.clearRect(0, 0, patchPreviewCanvas.width, patchPreviewCanvas.height); patchPreviewCanvas.style.display = 'none'; }
if (patchOverlayCanvas) { patchOverlayCtx.clearRect(0, 0, patchOverlayCanvas.width, patchOverlayCanvas.height); patchOverlayCanvas.style.display = 'none'; }
}
function startPatchAnts() {
if (patchAntsRAF) return;
patchAntsLastT = performance.now();
const tick = (t) => {
patchDashOffset = (patchDashOffset + (t - patchAntsLastT) * 0.024) % 8;
patchAntsLastT = t;
drawPatchOverlay();
if (patchPhase === 'selected' || patchPhase === 'dragging') patchAntsRAF = requestAnimationFrame(tick);
else patchAntsRAF = 0;
};
patchAntsRAF = requestAnimationFrame(tick);
}
function drawPatchOverlay() {
if (!patchOverlayCanvas || !patchOverlayCtx) return;
syncPatchOverlayTransform();
const k = patchRenderScale * patchDpr;
const d = patchDpr;
patchOverlayCtx.clearRect(0, 0, patchOverlayCanvas.width, patchOverlayCanvas.height);
if (patchPhase === 'idle' || patchPoints.length < 2) return;
patchOverlayCanvas.style.display = 'block';
const ox = patchPhase === 'dragging' ? patchOff[0] * k : 0;
const oy = patchPhase === 'dragging' ? patchOff[1] * k : 0;
patchOverlayCtx.beginPath();
patchPoints.forEach(([x, y], i) => i ? patchOverlayCtx.lineTo(x * k + ox, y * k + oy) : patchOverlayCtx.moveTo(x * k + ox, y * k + oy));
patchOverlayCtx.lineJoin = 'round';
if (patchPhase === 'drawing') {
patchOverlayCtx.strokeStyle = 'rgba(0,0,0,.8)'; patchOverlayCtx.lineWidth = 3 * d; patchOverlayCtx.stroke();
patchOverlayCtx.strokeStyle = '#fff'; patchOverlayCtx.lineWidth = 1.5 * d; patchOverlayCtx.stroke();
return;
}
if (patchPhase !== 'dragging') {
patchOverlayCtx.closePath();
patchOverlayCtx.fillStyle = 'rgba(255,255,255,.07)';
patchOverlayCtx.fill();
patchOverlayCtx.moveTo(patchPoints[0][0] * k, patchPoints[0][1] * k);
patchPoints.forEach(([x, y], i) => i ? patchOverlayCtx.lineTo(x * k + ox, y * k + oy) : patchOverlayCtx.moveTo(x * k + ox, y * k + oy));
}
if (patchPhase === 'dragging') {
patchOverlayCtx.beginPath();
patchPoints.forEach(([x, y], i) => i ? patchOverlayCtx.lineTo(x * k, y * k) : patchOverlayCtx.moveTo(x * k, y * k));
patchOverlayCtx.closePath();
patchOverlayCtx.strokeStyle = 'rgba(255,255,255,.55)';
patchOverlayCtx.lineWidth = 1.2 * d;
patchOverlayCtx.stroke();
}
patchOverlayCtx.lineWidth = d;
patchOverlayCtx.setLineDash([4 * d, 4 * d]);
patchOverlayCtx.lineDashOffset = patchDashOffset * d;
patchOverlayCtx.strokeStyle = '#000'; patchOverlayCtx.stroke();
patchOverlayCtx.lineDashOffset = (patchDashOffset - 4) * d;
patchOverlayCtx.strokeStyle = '#fff'; patchOverlayCtx.stroke();
patchOverlayCtx.setLineDash([]);
patchOverlayCtx.lineDashOffset = 0;
}
function patchPreview(ox, oy) {
if (!patchBase) {
const maxSide = 1600;
patchBaseScale = Math.min(1, maxSide / Math.max(editCanvas.width, editCanvas.height));
patchBase = document.createElement('canvas');
patchBase.width = Math.max(1, Math.round(editCanvas.width * patchBaseScale));
patchBase.height = Math.max(1, Math.round(editCanvas.height * patchBaseScale));
patchBase.getContext('2d').drawImage(editCanvas, 0, 0, patchBase.width, patchBase.height);
}
syncPatchOverlayTransform();
const ctx = patchPreviewCtx;
const kr = patchRenderScale * patchDpr;
const kb = patchBaseScale;
patchPreviewCanvas.style.display = 'block';
ctx.clearRect(0, 0, patchPreviewCanvas.width, patchPreviewCanvas.height);
const b = patchPolyBounds(patchPoints);
const pad = 2;
const sx0 = Math.max(0, Math.floor(b.x0) - pad);
const sy0 = Math.max(0, Math.floor(b.y0) - pad);
const sx1 = Math.min(editCanvas.width, Math.ceil(b.x1) + pad);
const sy1 = Math.min(editCanvas.height, Math.ceil(b.y1) + pad);
const sw = sx1 - sx0, sh = sy1 - sy0;
ctx.save();
ctx.beginPath();
patchPoints.forEach(([x, y], i) => i ? ctx.lineTo(x * kr, y * kr) : ctx.moveTo(x * kr, y * kr));
ctx.closePath();
ctx.clip();

ctx.drawImage(patchBase, (sx0 + ox) * kb, (sy0 + oy) * kb, sw * kb, sh * kb, sx0 * kr, sy0 * kr, sw * kr, sh * kr);
ctx.restore();
}
function discardPatchPreview() {
if (patchPreviewCanvas) patchPreviewCtx.clearRect(0, 0, patchPreviewCanvas.width, patchPreviewCanvas.height);
patchPreviewCanvas.style.display = 'none';
patchBase = null;
}
function ensurePatchWorker() {
if (patchWorker) return patchWorker;
const workerSrc = [
'const PATCH_OUTSIDE = 0, PATCH_RING = 1, PATCH_HOLE = 2;',
patchHealSolve.toString(),
patchMakeAdapter.toString(),
patchBlend.toString(),
'function patchBlurMask(mask, w, h, r) {',
'  r = Math.max(1, Math.round(r));',
'  var out = new Float32Array(w * h);',
'  for (var y = 0; y < h; y++) {',
'    for (var x = 0; x < w; x++) {',
'      var sum = 0, cnt = 0;',
'      for (var j = -r; j <= r; j++) {',
'        var yy = y + j; if (yy < 0 || yy >= h) continue;',
'        for (var i = -r; i <= r; i++) {',
'          var xx = x + i; if (xx < 0 || xx >= w) continue;',
'          sum += mask[yy * w + xx]; cnt++;',
'        }',
'      }',
'      out[y * w + x] = cnt ? sum / cnt : 0;',
'    }',
'  }',
'  return out;',
'}',
'self.onmessage = function(e) {',
'  var d = e.data;',
'  var ok = patchBlend(d.dest, d.src, d.cov, d.W, d.H, d.bx0, d.by0, d.bx1, d.by1);',
'  if (!ok) { self.postMessage({ ok: false }); return; }',
'  var alpha = patchBlurMask(d.cov, d.W, d.H, d.feather);',
'  var n = d.W * d.H;',
'  for (var i = 0, p = 0; i < n; i++, p += 4) {',
'    var a = alpha[i];',
'    if (a > 0.5 && a < 254.5) {',
'      for (var c = 0; c < 3; c++) {',
'        d.dest[p + c] = (d.orig[p + c] * (255 - a) + d.dest[p + c] * a) / 255;',
'      }',
'    }',
'  }',
'  self.postMessage({ ok: true, dest: d.dest }, [d.dest.buffer]);',
'};'
].join('\n');
const blob = new Blob([workerSrc], { type: 'application/javascript' });
patchWorker = new Worker(URL.createObjectURL(blob));
return patchWorker;
}
function patchApply(dx, dy, callback) {
const W = editCanvas.width, H = editCanvas.height;
const pts = patchPoints.map(p => [p[0], p[1]]);
const b = patchPolyBounds(pts);
const bx0 = Math.max(0, Math.round(b.x0)), by0 = Math.max(0, Math.round(b.y0));
const bx1 = Math.min(W, Math.round(b.x1)), by1 = Math.min(H, Math.round(b.y1));
if (bx1 <= bx0 || by1 <= by0) { callback(false); return; }
const m = 28;
const sx0 = Math.max(0, bx0 - m), sy0 = Math.max(0, by0 - m);
const sx1 = Math.min(W, bx1 + m), sy1 = Math.min(H, by1 + m);
const sw = sx1 - sx0, sh = sy1 - sy0;
const swn = sw * sh;
if (sx0 + dx < 0 || sy0 + dy < 0 || sx1 + dx > W || sy1 + dy > H) { callback(false); return; }
const tracePath = () => {
patchMaskCtx.beginPath();
pts.forEach(([x, y], i) => i ? patchMaskCtx.lineTo(x, y) : patchMaskCtx.moveTo(x, y));
patchMaskCtx.closePath();
};
patchMaskCanvas.width = W; patchMaskCanvas.height = H;
patchMaskCtx.clearRect(0, 0, W, H);
patchMaskCtx.fillStyle = '#fff';
tracePath(); patchMaskCtx.fill();
const dest = new Uint8Array(editCtx.getImageData(sx0, sy0, sw, sh).data);
const orig = new Uint8Array(dest);
const src = new Uint8Array(editCtx.getImageData(sx0 + dx, sy0 + dy, sw, sh).data);
const md = patchMaskCtx.getImageData(sx0, sy0, sw, sh);
const cov = new Uint8Array(swn);
for (let i = 0; i < swn; ++i) cov[i] = md.data[i * 4];
const feather = Math.max(1.5, Math.min(6, Math.sqrt(bx1 - bx0 + by1 - by0) * 0.55));
const worker = ensurePatchWorker();
worker.onmessage = function(e) {
const res = e.data;
if (!res.ok) { callback(false); return; }
const outImageData = editCtx.createImageData(sw, sh);
outImageData.data.set(res.dest);
editCtx.putImageData(outImageData, sx0, sy0);
patchMaskCtx.clearRect(0, 0, W, H);
callback(true);
};
worker.postMessage({
dest: dest, src: src, cov: cov, orig: orig, W: sw, H: sh,
bx0: bx0 - sx0, by0: by0 - sy0, bx1: bx1 - sx0, by1: by1 - sy0,
feather: feather
}, [dest.buffer, src.buffer, orig.buffer]);
}
function handlePatchMouseDown(e) {
if (patchBusy) return;
patchUpHandled = false;
const { x, y } = getCanvasCoordinates(e, editCanvas);
if (patchPhase === 'selected' && patchPointInPoly(x, y, patchPoints)) {
patchPhase = 'dragging'; patchStart = [x, y]; patchOff = [0, 0];
} else {
patchPhase = 'drawing'; patchPoints = [[x, y]]; patchOff = [0, 0];
}
drawPatchOverlay();
}
function handlePatchMouseMove(e) {
const { x, y } = getCanvasCoordinates(e, editCanvas);
if (patchPhase === 'drawing') {
const p = patchPoints, last = p[p.length - 1];
if (Math.hypot(x - last[0], y - last[1]) >= 3) { p.push([x, y]); drawPatchOverlay(); }
} else if (patchPhase === 'dragging') {
patchOff = [x - patchStart[0], y - patchStart[1]];
patchPreview(patchOff[0], patchOff[1]);
if (!patchAntsRAF) startPatchAnts();
} else if (patchPhase === 'selected') {
editCanvas.style.cursor = 'crosshair';
}
}
function handlePatchMouseUp() {
flushPendingMove();
if (patchUpHandled) return;
patchUpHandled = true;
if (patchPhase === 'drawing') {
if (patchPoints.length < 3 || Math.abs(patchPolyArea(patchPoints)) < 60) {
clearPatchSelection();
showNotification('选区太小，按住左键套住要修补的区域');
} else {
patchPhase = 'selected'; patchOff = [0, 0];
drawPatchOverlay();
startPatchAnts();
return;
}
drawPatchOverlay();
} else if (patchPhase === 'dragging') {
const dx = Math.round(patchOff[0]), dy = Math.round(patchOff[1]);
patchPhase = 'selected'; patchOff = [0, 0];
stopPatchAnts();
discardPatchPreview();
drawPatchOverlay();
if (Math.abs(dx) + Math.abs(dy) < 2) {
showNotification('拖动距离太短——拖到另一块纹理上再松手');
return;
}
patchBusy = true;
showNotification('修补混合中…');
patchApply(dx, dy, function(ok) {
patchBusy = false;
if (!ok) {
showNotification('采样区超出图像边界，换个拖动距离');
return;
}
tempCtx.drawImage(editCanvas, 0, 0);
});
clearPatchSelection();
} else {
clearPatchSelection();
}
}
function setupEventListeners() {
editCanvas.addEventListener('mousedown', handleMouseDown);
editCanvas.addEventListener('mousemove', handleMouseMove);
editCanvas.addEventListener('mouseup', handleMouseUp);
editCanvas.addEventListener('mouseleave', handleMouseLeave);
editCanvas.addEventListener('mouseenter', handleMouseEnter);
editCanvas.addEventListener('contextmenu', (e) => {
e.preventDefault();
});
editCanvas.addEventListener('wheel', (e) => {
e.preventDefault();
const mouseX = e.clientX;
const mouseY = e.clientY;
const isTouchpad = Math.abs(e.deltaY) < 100;
const isContinuous = e.deltaMode === 0;
let scaleFactor;
if (isTouchpad || isContinuous) {
scaleFactor = e.deltaY > 0 ? 0.98 : 1.02;
} else {
scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
}
const newDisplayScale = displayScale * scaleFactor;
applyDisplayScale(newDisplayScale, mouseX, mouseY);
}, { passive: false });
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape' && isPatchModeActive && patchPhase !== 'idle') {
clearPatchSelection();
showNotification('已取消选区');
return;
}
if ((e.ctrlKey || e.metaKey)) {
if (e.key === '+' || e.key === '=') {
e.preventDefault();
applyDisplayScale(displayScale + 0.1);
} else if (e.key === '-') {
e.preventDefault();
applyDisplayScale(displayScale - 0.1);
} else if (e.key === '0') {
e.preventDefault();
fitCloneCanvasToContainer();
}
}
});
document.addEventListener('mouseup', handleGlobalMouseUp);
window.addEventListener('resize', invalidateRectCache);
}
function getCurrentImageId() {
if (typeof currentImageIndex === 'undefined' || currentImageIndex < 0 || !window.imageDataList || !Array.isArray(window.imageDataList) || window.imageDataList.length === 0) {
return null;
}
const imageIndex = currentImageIndex >= 0 ? currentImageIndex : 0;
return window.imageDataList[imageIndex].id;
}
function applyCloneIsolation(mode) {
const featherGroup = document.getElementById('cloneFeatherGroup');
const brushSizeGroup = document.getElementById('cloneBrushSizeGroup');
const dataSourceGroup = document.getElementById('cloneDataSourceGroup');
const brushBtn = document.getElementById('cloneBrushTool');
const patchBtn = document.getElementById('clonePatchTool');
const isPatch = mode === 'patch';
if (featherGroup) featherGroup.style.display = isPatch ? 'none' : '';
if (brushSizeGroup) brushSizeGroup.style.display = isPatch ? 'none' : '';
if (dataSourceGroup) dataSourceGroup.style.display = isPatch ? 'none' : '';
if (brushBtn) brushBtn.style.display = isPatch ? 'none' : '';
if (patchBtn) patchBtn.style.display = isPatch ? '' : 'none';
}
function openCloneSystemModal(mode) {
setCloneUI(true);
if (typeof currentImageIndex === 'undefined' || currentImageIndex < 0 || !window.imageDataList || !Array.isArray(window.imageDataList) || window.imageDataList.length === 0) {
showNotification('请先导入图片');
return;
}
if (!cloneSystemModal || !originalCanvas || !editCanvas) {
createCloneSystemModal();
} else {
cloneSystemModal.style.display = 'flex';
if (originalCanvas) originalCanvas.style.display = 'none';
if (editCanvas) editCanvas.style.display = 'block';
if (previewCanvas) {
previewCanvas.style.display = 'none';
previewCanvas.style.position = 'absolute';
previewCanvas.style.pointerEvents = 'none';
previewCanvas.style.zIndex = '1000';
}
if (brushCursor) {
brushCursor.style.display = 'none';
brushCursor.style.position = 'absolute';
brushCursor.style.pointerEvents = 'none';
brushCursor.style.zIndex = '999';
}
if (altCursor) {
altCursor.style.display = 'none';
altCursor.style.position = 'absolute';
altCursor.style.pointerEvents = 'none';
altCursor.style.zIndex = '999';
}
}
document.body.style.overflow = 'hidden';
resetCloneSystem();
applyCloneIsolation(mode);
if (mode === 'patch') {
selectCloneTool('patch');
} else {
selectCloneTool('brush');
}
if (window.currentImageIndex === undefined || window.currentImageIndex === -1) {
if (window.imageDataList && window.imageDataList.length > 0) {
window.currentImageIndex = 0;
}
}
loadCurrentImage();
}
function printCurrentImageId() {
const imageId = getCurrentImageId();
if (imageId) {
}
}
function closeCloneSystemModal() {
setCloneUI(false);
if (cloneSystemModal) {
cloneSystemModal.style.display = 'none';
document.body.style.overflow = 'auto';
hideBrushCursor();
resetCloneSystem();
originalImageCopy = null;
}
}
async function confirmCloneSystem() {
editCanvas.toBlob(async function(blob) {
if (blob) {
const imageId = getCurrentImageId();
if (imageId) {
try {
const reader = new FileReader();
reader.onloadend = async function() {
const base64data = reader.result.split(',')[1];
const result = await iceaiNative.saveCloneResult({ imageId, editedImage: base64data });
if (result.success) {
if (window.imageDataList && window.imageDataList.length > 0 && typeof currentImageIndex !== 'undefined' && currentImageIndex !== -1) {
const imageData = window.imageDataList[currentImageIndex];
imageData.compressedImage = blob;
imageData.resetOriginalImage = blob;


if (imageData.groupCache) {
imageData.groupCache.isInitialized = false;
imageData.groupCache = {
isInitialized: false,
group1: null,
group2: null,
group3: null,
group4: null,
group5: null,
group6: null,
group7: null,
group8: null,
group9: null,
group10: null,
group11: null,
group12: null,
group13: null,
group14: null,
group15: null,
group16: null,
group17: null,
group18: null,
group19: null,
group20: null,
group21: null
};
}

if (typeof notifyImageDataListUpdated === 'function') {
notifyImageDataListUpdated();
}
const event = new Event('imageChanged');
document.dispatchEvent(event);

sendRequest(imageData);
}
} else {
console.error('Failed to save clone result:', result.error);
}
closeCloneSystemModal();
simulateManualOperation();
};
reader.readAsDataURL(blob);
} catch (error) {
console.error('Failed to save clone result:', error);
closeCloneSystemModal();
simulateManualOperation();
}
} else {
if (window.imageDataList && window.imageDataList.length > 0 && typeof currentImageIndex !== 'undefined' && currentImageIndex !== -1) {
const imageData = window.imageDataList[currentImageIndex];
imageData.compressedImage = blob;
imageData.resetOriginalImage = blob;


if (imageData.groupCache) {
imageData.groupCache.isInitialized = false;
imageData.groupCache = {
isInitialized: false,
group1: null,
group2: null,
group3: null,
group4: null,
group5: null,
group6: null,
group7: null,
group8: null,
group9: null,
group10: null,
group11: null,
group12: null,
group13: null,
group14: null,
group15: null,
group16: null,
group17: null,
group18: null,
group19: null,
group20: null,
group21: null
};
}

if (typeof notifyImageDataListUpdated === 'function') {
notifyImageDataListUpdated();
}
const event = new Event('imageChanged');
document.dispatchEvent(event);

sendRequest(imageData);
}
closeCloneSystemModal();
simulateManualOperation();
}
} else {
closeCloneSystemModal();
simulateManualOperation();
}
}, 'image/jpeg');
}
const targetSlider001 = document.getElementById('sliderT04');
const targetValue001 = document.getElementById('slider-valueT04');
function simulateManualOperation() {
if (targetSlider001 && targetValue001) {
const originalValue = parseInt(targetSlider001.value);
targetSlider001.value = originalValue + 1;
targetValue001.textContent = targetSlider001.value;
setTimeout(function() {
targetSlider001.value = originalValue;
targetValue001.textContent = targetSlider001.value;
const event = new Event('input');
targetSlider001.dispatchEvent(event);
}, 50);
} else {
console.error('Slider element with id "sliderT04" or its value display element with id "slider-valueT04" was not found.');
}
}
function resetCloneSystem() {
isSampling = false;
isDrawing = false;
hasStartedDrawing = false;
isDraggingImage = false;
clearPatchSelection();
samplePoint = null;
firstDrawPoint = null;
lastDrawPoint = null;
offset = null;
if (loadingIndicator) {
loadingIndicator.style.display = 'none';
}
if (originalImageCopy && originalCtx && editCtx && tempCtx) {
if (originalImageCopy.complete && originalImageCopy.naturalWidth > 0) {
originalCtx.drawImage(originalImageCopy, 0, 0);
editCtx.drawImage(originalImageCopy, 0, 0);
tempCtx.drawImage(originalImageCopy, 0, 0);
} else {
originalImageCopy.onload = function() {
originalCtx.drawImage(originalImageCopy, 0, 0);
editCtx.drawImage(originalImageCopy, 0, 0);
tempCtx.drawImage(originalImageCopy, 0, 0);
};
}
} else {
if (originalCtx && originalCanvas) {
originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
}
if (editCtx && editCanvas) {
editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
}
if (tempCtx && tempCanvas) {
tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
}
}
if (previewCtx && previewCanvas) {
previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
}
}
async function loadCurrentImage() {
const imageId = getCurrentImageId();
if (imageId) {
if (loadingIndicator) {
loadingIndicator.textContent = '正在解析....请解析完成后重新打开';
loadingIndicator.style.display = 'block';
}
try {
const imageBuffer = await iceaiNative.getCloneImage({ imageId });
const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
const img = new Image();
const objectUrl = URL.createObjectURL(blob);
img.onload = function() {
setupCanvas(img);
if (loadingIndicator) {
loadingIndicator.style.display = 'none';
}
URL.revokeObjectURL(objectUrl);
};
img.src = objectUrl;
} catch (error) {
console.error('获取克隆图像失败:', error);
if (loadingIndicator) {
loadingIndicator.textContent = '解析失败，请稍后重试';
loadingIndicator.style.color = '#ff0000';
loadingIndicator.style.display = 'block';
}
}
}
}
function setupCanvas(image) {
if (!originalCanvas || !editCanvas || !tempCanvas) {
return;
}
originalCanvas.width = image.width;
originalCanvas.height = image.height;
editCanvas.width = image.width;
editCanvas.height = image.height;
tempCanvas.width = image.width;
tempCanvas.height = image.height;
patchOverlayCanvas.style.display = 'none';
patchPreviewCanvas.style.display = 'none';
patchMaskCanvas.width = image.width;
patchMaskCanvas.height = image.height;
if (originalCtx && editCtx && tempCtx) {
originalCtx.drawImage(image, 0, 0);
editCtx.drawImage(image, 0, 0);
tempCtx.drawImage(image, 0, 0);
}
const imgCopy = new Image();
imgCopy.src = image.src;
originalImageCopy = imgCopy;
displayScale = 1;
editCanvas.style.transform = `scale(${baseScale})`;
editCanvas.style.transformOrigin = '0 0';
fitCloneCanvasToContainer();
updateZoomValue();
}
function handleImageUpload(e) {
const file = e.target.files[0];
if (file) {
const reader = new FileReader();
reader.onload = function(event) {
const img = new Image();
img.onload = function() {
setupCanvas(img);
};
img.src = event.target.result;
};
reader.readAsDataURL(file);
}
}
function handleMouseDown(e) {
if (isPatchModeActive) { handlePatchMouseDown(e); return; }
if (isDragModeActive) {
isDraggingImage = true;
dragStartX = e.clientX;
dragStartY = e.clientY;
dragStartLeft = parseFloat(editCanvas.style.left) || 0;
dragStartTop = parseFloat(editCanvas.style.top) || 0;
editCanvas.style.cursor = 'grabbing';
return;
}
if (e.altKey) {
isSampling = true;
const { x, y } = getCanvasCoordinates(e, editCanvas);
samplePoint = { x, y };
firstDrawPoint = null;
offset = null;
lastDrawPoint = null;
hasStartedDrawing = false;
updateBrushCursor(e);
} else if (samplePoint) {
isDrawing = true;
const { x, y } = getCanvasCoordinates(e, editCanvas);
if (!firstDrawPoint) {
firstDrawPoint = { x, y };
offset = {
dx: samplePoint.x - firstDrawPoint.x,
dy: samplePoint.y - firstDrawPoint.y
};
samplePoint = {
x: x + offset.dx,
y: y + offset.dy
};
}
draw(x, y);
} else {
showNotification('请先按住Alt键（Mac系统按住Option键）获取采样源');
}
}
function handleMouseMove(e) {
pendingMoveEvent = e;
if (!moveRafId) {
moveRafId = requestAnimationFrame(processMouseMove);
}
}
function flushPendingMove() {
if (moveRafId) {
cancelAnimationFrame(moveRafId);
moveRafId = 0;
}
if (pendingMoveEvent) {
processMouseMove();
}
}
function processMouseMove() {
moveRafId = 0;
const e = pendingMoveEvent;
pendingMoveEvent = null;
if (!e) return;
if (isPatchModeActive) { handlePatchMouseMove(e); return; }
if (isDraggingImage) {
const newLeft = dragStartLeft + (e.clientX - dragStartX);
const newTop = dragStartTop + (e.clientY - dragStartY);
editCanvas.style.left = `${newLeft}px`;
editCanvas.style.top = `${newTop}px`;
syncPatchOverlayTransform();
return;
}
updateBrushCursor(e);
if (isDragModeActive) {
editCanvas.style.cursor = 'grab';
return;
}
if (e.altKey || isSampling) {
editCanvas.style.cursor = 'none';
} else if (isDrawing) {
editCanvas.style.cursor = 'none';
} else {
editCanvas.style.cursor = 'default';
}
if (isDrawing && samplePoint && firstDrawPoint && offset) {
const { x, y } = getCanvasCoordinates(e, editCanvas);
draw(x, y);
}
}
function handleMouseUp() {
flushPendingMove();
if (isPatchModeActive) { handlePatchMouseUp(); return; }
if (isDraggingImage) {
isDraggingImage = false;
invalidateRectCache();
editCanvas.style.cursor = isDragModeActive ? 'grab' : 'default';
return;
}
isSampling = false;
if (isDrawing) {
tempCtx.drawImage(editCanvas, 0, 0);
isDrawing = false;
}
if (firstDrawPoint && offset) {
hasStartedDrawing = true;
}
}
function handleGlobalMouseUp() {
flushPendingMove();
if (isPatchModeActive) { handlePatchMouseUp(); return; }
if (isDraggingImage) {
isDraggingImage = false;
invalidateRectCache();
editCanvas.style.cursor = isDragModeActive ? 'grab' : 'default';
}
if (isDrawing) {
tempCtx.drawImage(editCanvas, 0, 0);
isDrawing = false;
}
if (firstDrawPoint && offset) {
hasStartedDrawing = true;
}
}
function handleMouseLeave() {
flushPendingMove();
if (isPatchModeActive) { clearPatchSelection(); hideBrushCursor(); return; }
if (isDraggingImage) {
isDraggingImage = false;
invalidateRectCache();
editCanvas.style.cursor = isDragModeActive ? 'grab' : 'default';
}
hideBrushCursor();
isSampling = false;
isDrawing = false;
}
function handleMouseEnter(e) {
invalidateRectCache();
updateBrushCursor(e);
}
function invalidateRectCache() {
cachedCanvasRect = null;
cachedContainerRect = null;
}
function getCanvasRect() {
if (!cachedCanvasRect && editCanvas) {
cachedCanvasRect = editCanvas.getBoundingClientRect();
}
return cachedCanvasRect;
}
function getContainerRect() {
if (!cachedContainerRect) {
const canvasContainer = document.querySelector('.canvas-container');
if (canvasContainer) {
cachedContainerRect = canvasContainer.getBoundingClientRect();
}
}
return cachedContainerRect;
}
function getCursorTempCanvas(size) {
if (!cursorTempCanvas) {
cursorTempCanvas = document.createElement('canvas');
cursorTempCtx = cursorTempCanvas.getContext('2d');
}
if (cursorTempCanvas.width !== size || cursorTempCanvas.height !== size) {
cursorTempCanvas.width = size;
cursorTempCanvas.height = size;
}
return cursorTempCanvas;
}
function getCursorMaskCanvas(size) {
if (!cursorMaskCanvas) {
cursorMaskCanvas = document.createElement('canvas');
cursorMaskCtx = cursorMaskCanvas.getContext('2d');
}
if (cursorMaskCanvas.width !== size || cursorMaskCanvas.height !== size) {
cursorMaskCanvas.width = size;
cursorMaskCanvas.height = size;
cursorMaskKey = '';
}
return cursorMaskCanvas;
}
function getCanvasCoordinates(e, canvas) {
if (!canvas) return { x: 0, y: 0 };
const rect = canvas === editCanvas ? getCanvasRect() : canvas.getBoundingClientRect();
if (!rect) return { x: 0, y: 0 };
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
const x = (e.clientX - rect.left) * scaleX;
const y = (e.clientY - rect.top) * scaleY;
return { x, y };
}
function updateBrushCursor(e) {
if (isDragModeActive || isDraggingImage || isPatchModeActive) {
hideBrushCursor();
return;
}
if (!editCanvas || !brushCursor || !altCursor || !previewCanvas) return;
const rect = getCanvasRect();
const scaleX = editCanvas.width / rect.width;
const scaleY = editCanvas.height / rect.height;
const canvasX = (e.clientX - rect.left) * scaleX;
const canvasY = (e.clientY - rect.top) * scaleY;
const displayRadius = (brushSize / 2) / scaleX;
const containerRect = getContainerRect() || { left: 0, top: 0 };
const relativeX = e.clientX - containerRect.left;
const relativeY = e.clientY - containerRect.top;
if (e.altKey) {
brushCursor.style.display = 'none';
altCursor.style.display = 'block';
const svgSize = Math.min(50, Math.max(20, displayRadius * 2));
altCursor.style.width = `${svgSize}px`;
altCursor.style.height = `${svgSize}px`;
altCursor.style.left = `${relativeX - svgSize/2}px`;
altCursor.style.top = `${relativeY - svgSize/2}px`;
previewCanvas.style.display = 'none';
} else {
brushCursor.style.display = 'block';
altCursor.style.display = 'none';
brushCursor.style.width = `${displayRadius * 2}px`;
brushCursor.style.height = `${displayRadius * 2}px`;
brushCursor.style.left = `${relativeX - displayRadius}px`;
brushCursor.style.top = `${relativeY - displayRadius}px`;
if (samplePoint) {
previewCanvas.style.display = 'block';
const previewSize = displayRadius * 2;
previewCanvas.width = previewSize;
previewCanvas.height = previewSize;
previewCanvas.style.width = `${previewSize}px`;
previewCanvas.style.height = `${previewSize}px`;
previewCanvas.style.left = `${relativeX - previewSize/2}px`;
previewCanvas.style.top = `${relativeY - previewSize/2}px`;
previewCanvas.style.zIndex = '1000';
previewCtx.clearRect(0, 0, previewSize, previewSize);
let sourceCtx;
if (dataSource === 'edited') {
sourceCtx = editCtx;
} else {
sourceCtx = originalCtx;
}
let sourceSize = brushSize;
let sourceX, sourceY;
if ((hasStartedDrawing && lastDrawPoint) || (isDrawing && firstDrawPoint && offset)) {
let referencePoint, refOffsetX, refOffsetY;
if (hasStartedDrawing && lastDrawPoint) {
referencePoint = lastDrawPoint;
refOffsetX = offset.dx;
refOffsetY = offset.dy;
} else {
referencePoint = firstDrawPoint;
refOffsetX = offset.dx;
refOffsetY = offset.dy;
}
const currentOffsetX = canvasX - referencePoint.x;
const currentOffsetY = canvasY - referencePoint.y;
sourceX = referencePoint.x + refOffsetX + currentOffsetX - sourceSize/2;
sourceY = referencePoint.y + refOffsetY + currentOffsetY - sourceSize/2;
} else {
sourceX = samplePoint.x - sourceSize/2;
sourceY = samplePoint.y - sourceSize/2;
}
const tempCanvas = getCursorTempCanvas(previewSize);
const tempCtx = cursorTempCtx;
tempCtx.clearRect(0, 0, previewSize, previewSize);
tempCtx.drawImage(
sourceCtx.canvas,
sourceX, sourceY, sourceSize, sourceSize,
0, 0, previewSize, previewSize
);
const maskCanvas = getCursorMaskCanvas(previewSize);
const maskCtx = cursorMaskCtx;
const maskKey = `${previewSize}_${clonefeatherValue}`;
if (cursorMaskKey !== maskKey) {
const centerX = previewSize / 2;
const centerY = previewSize / 2;
const radius = previewSize / 2;
const gradient = maskCtx.createRadialGradient(
centerX, centerY, 0,
centerX, centerY, radius
);
const clonefeatherPercentage = clonefeatherValue / 100;
gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
gradient.addColorStop(Math.max(0, 1 - clonefeatherPercentage), 'rgba(255, 255, 255, 1)');
gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
maskCtx.fillStyle = gradient;
maskCtx.fillRect(0, 0, previewSize, previewSize);
cursorMaskKey = maskKey;
}
previewCtx.drawImage(tempCanvas, 0, 0);
previewCtx.globalCompositeOperation = 'destination-in';
previewCtx.drawImage(maskCanvas, 0, 0);
previewCtx.globalCompositeOperation = 'source-over';
} else {
previewCanvas.style.display = 'none';
}
}
}
function hideBrushCursor() {
if (brushCursor) brushCursor.style.display = 'none';
if (altCursor) altCursor.style.display = 'none';
if (previewCanvas) previewCanvas.style.display = 'none';
}
function draw(x, y) {
const currentOffsetX = x - firstDrawPoint.x;
const currentOffsetY = y - firstDrawPoint.y;
const currentSampleX = firstDrawPoint.x + offset.dx + currentOffsetX;
const currentSampleY = firstDrawPoint.y + offset.dy + currentOffsetY;
samplePoint = {
x: currentSampleX,
y: currentSampleY
};
lastDrawPoint = { x, y };
clonePixels(currentSampleX, currentSampleY, x, y);
}
function getBrushAlphaMask(size, feather) {
if (brushMaskCache.size === size && brushMaskCache.feather === feather) {
return brushMaskCache.alpha;
}
const alpha = new Float32Array(size * size);
const center = size / 2;
const radius = size / 2;
let featherStartRadius = radius;
let featherRange = 0;
if (feather > 0) {
featherStartRadius = radius * ((100 - feather) / 100);
featherRange = radius - featherStartRadius;
}
for (let y = 0; y < size; y++) {
const dy = y - center;
for (let x = 0; x < size; x++) {
const dx = x - center;
const distance = Math.sqrt(dx * dx + dy * dy);
let a = 0;
if (distance <= radius) {
a = 1;
if (featherRange > 0 && distance > featherStartRadius) {
const t = (distance - featherStartRadius) / featherRange;
a = 1 - (3 * t * t - 2 * t * t * t);
if (a < 0) a = 0;
else if (a > 1) a = 1;
}
}
alpha[y * size + x] = a;
}
}
brushMaskCache = { size: size, feather: feather, alpha: alpha };
return alpha;
}
function clonePixels(sampleX, sampleY, targetX, targetY) {
let sourceCtx;
if (dataSource === 'edited') {
sourceCtx = tempCtx;
} else {
sourceCtx = originalCtx;
}
const size = brushSize;
const half = size / 2;
const sourceImageData = sourceCtx.getImageData(
sampleX - half, sampleY - half,
size, size
);
const targetImageData = editCtx.getImageData(
targetX - half, targetY - half,
size, size
);
const sourceData = sourceImageData.data;
const targetData = targetImageData.data;
const alphaMask = getBrushAlphaMask(size, clonefeatherValue);
for (let i = 0, p = 0; i < alphaMask.length; i++, p += 4) {
const alpha = alphaMask[i];
if (alpha <= 0) continue;
if (alpha >= 1) {
targetData[p] = sourceData[p];
targetData[p + 1] = sourceData[p + 1];
targetData[p + 2] = sourceData[p + 2];
targetData[p + 3] = sourceData[p + 3];
} else {
const inv = 1 - alpha;
targetData[p] = Math.floor(sourceData[p] * alpha + targetData[p] * inv);
targetData[p + 1] = Math.floor(sourceData[p + 1] * alpha + targetData[p + 1] * inv);
targetData[p + 2] = Math.floor(sourceData[p + 2] * alpha + targetData[p + 2] * inv);
targetData[p + 3] = Math.floor(sourceData[p + 3] * alpha + targetData[p + 3] * inv);
}
}
editCtx.putImageData(targetImageData, targetX - half, targetY - half);
}
window.addEventListener('DOMContentLoaded', function() {
initCloneSystem();
});
document.addEventListener('DOMContentLoaded', function() {
const fixPixButton = document.getElementById('fix-pix-button001');
if (fixPixButton) {
fixPixButton.addEventListener('click', function() {
setTimeout(() => {
openCloneSystemModal('clone');
}, 200);
});
}
const patchPixButton = document.getElementById('patch-pix-button001');
if (patchPixButton) {
patchPixButton.addEventListener('click', function() {
setTimeout(() => {
openCloneSystemModal('patch');
}, 200);
});
}
});
window.initCloneSystem = initCloneSystem;
})();
