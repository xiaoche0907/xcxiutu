function drawCombinedHistogramCanvas(luminanceData, redData, greenData, blueData) {
const canvas = document.getElementById('combined-histogram');
if (!canvas) return;
const dpr = window.devicePixelRatio || 1;
canvas.width = 235 * dpr;
canvas.height = 90 * dpr;
canvas.style.width = `235px`;
canvas.style.height = `90px`;
const ctx = canvas.getContext('2d');
ctx.scale(dpr, dpr);
const width = canvas.width / dpr;
const height = canvas.height / dpr;
ctx.clearRect(0, 0, width, height);
ctx.fillStyle = 'rgba(30, 30, 30, 0.5)';
ctx.fillRect(0, 0, width, height);
ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
ctx.lineWidth = 0.5 / dpr;
for (let y = 0; y <= height; y += height / 4) {
ctx.beginPath();
ctx.moveTo(0, y);
ctx.lineTo(width, y);
ctx.stroke();
}
for (let x = 0; x <= width; x += width / 4) {
ctx.beginPath();
ctx.moveTo(x, 0);
ctx.lineTo(x, height);
ctx.stroke();
}
const drawChannel = (data, color, lineWidth = 1.5) => {
ctx.beginPath();
ctx.strokeStyle = color;
ctx.lineWidth = lineWidth / dpr;
for (let i = 0; i < data.length; i++) {
const x = (i / 255) * width;
const y = height - (data[i] * height);
if (i === 0) {
ctx.moveTo(x, y);
} else {
ctx.lineTo(x, y);
}
}
ctx.stroke();
};
if (document.getElementById('showRed').checked) {
drawChannel(redData, 'rgba(255, 50, 50, 0.8)');
}
if (document.getElementById('showGreen').checked) {
drawChannel(greenData, 'rgba(50, 255, 50, 0.8)');
}
if (document.getElementById('showBlue').checked) {
drawChannel(blueData, 'rgba(50, 50, 255, 0.8)');
}
if (document.getElementById('showLuminance').checked) {
drawChannel(luminanceData, 'rgba(220, 220, 220, 0.9)', 1.8);
}
}
function debounce(func, wait) {
let timeout;
return function() {
clearTimeout(timeout);
timeout = setTimeout(() => func.apply(this, arguments), wait);
};
}
let histogramCache = { timestamp: 0, data: null };
let imageContext = null;
function getImageContext(imageCanvas) {
if (!imageContext || imageContext.canvas !== imageCanvas) {
imageContext = imageCanvas.getContext('2d', { willReadFrequently: true });
}
return imageContext;
}
function drawCombinedHistogram() {
const imageCanvas = document.querySelector('.browser-image');
if (!imageCanvas) return;
const timestamp = Date.now();
if (histogramCache.data && timestamp - histogramCache.timestamp < 1000) {
drawCombinedHistogramCanvas(
histogramCache.data.luminance,
histogramCache.data.red,
histogramCache.data.green,
histogramCache.data.blue
);
return;
}
try {
const ctx = getImageContext(imageCanvas);
const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
const data = imageData.data;
const luminanceHist = new Array(256).fill(0);
const redHist = new Array(256).fill(0);
const greenHist = new Array(256).fill(0);
const blueHist = new Array(256).fill(0);
const totalPixels = imageData.width * imageData.height;
const sampleStep = Math.max(1, Math.floor(totalPixels / 100000));
for (let p = 0; p < totalPixels; p += sampleStep) {
const i = p * 4;
const r = data[i];
const g = data[i + 1];
const b = data[i + 2];
const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
luminanceHist[luminance]++;
redHist[r]++;
greenHist[g]++;
blueHist[b]++;
}
const normalize = (hist) => {
const max = Math.max(...hist);
return hist.map(value => max > 0 ? value / max : 0);
};
const normalizedLuminance = normalize(luminanceHist);
const normalizedRed = normalize(redHist);
const normalizedGreen = normalize(greenHist);
const normalizedBlue = normalize(blueHist);
histogramCache = {
timestamp,
data: {
luminance: normalizedLuminance,
red: normalizedRed,
green: normalizedGreen,
blue: normalizedBlue
}
};
drawCombinedHistogramCanvas(
histogramCache.data.luminance,
histogramCache.data.red,
histogramCache.data.green,
histogramCache.data.blue
);
} catch (error) {
console.error('Failed to draw combined histogram:', error);
}
}
function initHistogram() {
drawCombinedHistogram();
const debouncedDraw = debounce(drawCombinedHistogram, 200);
const observer = new MutationObserver(debouncedDraw);
const imageCanvas = document.querySelector('.browser-image');
if (imageCanvas) {
observer.observe(imageCanvas, { attributes: true });
}
const checkboxes = document.querySelectorAll('.channel-controls input');
checkboxes.forEach(checkbox => {
checkbox.addEventListener('change', debouncedDraw);
});
}
document.addEventListener('DOMContentLoaded', initHistogram);
