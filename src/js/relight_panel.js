

(function () {
    'use strict';

    var DIAL = 84;

    
    var lights = {
        key:  { az: 135, el: 40, on: true },
        fill: { az: 45,  el: 15, on: false },
        rim:  { az: 270, el: 50, on: false }
    };

    
    var MAP = [
        { key: 'key',  canvas: 'relightDialKey',  dir: 'relightDirKey',  sw: 'relightSwKey',  size: 150 },
        { key: 'fill', canvas: 'relightDialFill', dir: 'relightDirFill', sw: 'relightSwFill', size: 100 },
        { key: 'rim',  canvas: 'relightDialRim',  dir: 'relightDirRim',  sw: 'relightSwRim',  size: 100 }
    ];

    
    var LIGHT_DEFAULTS = {
        key:  { az: 135, el: 40, on: true },
        fill: { az: 45,  el: 15, on: false },
        rim:  { az: 270, el: 50, on: false }
    };
    var SLIDER_DEFAULTS = { relight_intensity: 100, relight_ambient: 12, relight_blur: 0, relight_opacity: 75 };

    
    var editing = false;
    var dirty = false;
    var committed = null;   
    var dialItems = [];

    
    var RELIGHT_DEBUG = true;
    function rlog(tag, obj) {
        if (!RELIGHT_DEBUG) return;
        if (obj === undefined) ;
        else ;
    }

    
    function onChange() {
        refreshGroupResetBtn();
        if (!editing) return;
        dirty = true;
        schedulePreview();
    }

    
    
    var SLIDER_IDS = ['relight_intensity', 'relight_ambient', 'relight_blur', 'relight_opacity'];

    function sliderVal(id, def) {
        var el = document.getElementById(id);
        return el ? parseInt(el.value, 10) : def;
    }

    
    function getParams() {
        return {
            key:  { az: lights.key.az,  el: lights.key.el,  on: lights.key.on },
            fill: { az: lights.fill.az, el: lights.fill.el, on: lights.fill.on },
            rim:  { az: lights.rim.az,  el: lights.rim.el,  on: lights.rim.on },
            intensity: sliderVal('relight_intensity', 100),
            ambient:   sliderVal('relight_ambient', 12),
            blur:      sliderVal('relight_blur', 0),
            opacity:   sliderVal('relight_opacity', 75)
        };
    }

    function drawDial(item) {
        var canvas = item.canvasEl;
        var size = item.size || DIAL;
        var dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        var g = canvas.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);

        var cx = size / 2, cy = size / 2, R = size / 2 - 5;
        g.clearRect(0, 0, size, size);

        var bg = g.createRadialGradient(cx, cy - R * 0.35, R * 0.05, cx, cy, R);
        bg.addColorStop(0, 'rgba(95,100,114,0.98)');
        bg.addColorStop(1, 'rgba(26,27,32,0.99)');
        g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = bg; g.fill();

        g.strokeStyle = 'rgba(255,255,255,0.09)';
        g.lineWidth = 1;
        for (var f = 1; f <= 2; f++) {
            g.beginPath(); g.arc(cx, cy, R * (f / 3), 0, Math.PI * 2); g.stroke();
        }
        g.beginPath();
        g.moveTo(cx - R, cy); g.lineTo(cx + R, cy);
        g.moveTo(cx, cy - R); g.lineTo(cx, cy + R);
        g.stroke();

        
        var L = lights[item.key];
        var a = L.az * Math.PI / 180, e = L.el * Math.PI / 180, rr = R * Math.sin(e);
        var px = cx + rr * Math.cos(a), py = cy - rr * Math.sin(a);

        var glowR = size * 0.18;
        var glow = g.createRadialGradient(px, py, 1, px, py, glowR);
        glow.addColorStop(0, 'rgba(255,246,214,0.55)');
        glow.addColorStop(1, 'rgba(255,246,214,0)');
        g.fillStyle = glow; g.beginPath(); g.arc(px, py, glowR, 0, Math.PI * 2); g.fill();

        var dR = size * 0.095;
        var dot = g.createRadialGradient(px - dR * 0.35, py - dR * 0.4, 1, px, py, dR);
        dot.addColorStop(0, '#ffffff');
        dot.addColorStop(0.5, 'rgba(255,246,214,0.98)');
        dot.addColorStop(1, 'rgba(186,168,120,1)');
        g.beginPath(); g.arc(px, py, dR, 0, Math.PI * 2); g.fillStyle = dot; g.fill();
        g.beginPath(); g.arc(px, py, dR, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.stroke();
    }

    function updateDirText(item) {
        if (!item.dirEl) return;
        var L = lights[item.key];
        item.dirEl.textContent = 'az ' + Math.round(L.az) + '° / el ' + Math.round(L.el) + '°';
    }

    function refresh(item) {
        drawDial(item);
        updateDirText(item);
        onChange();
    }

    
    function updateSwitch(item) {
        if (!item.swEl) return;
        var on = lights[item.key].on !== false;
        item.swEl.classList.toggle('on', on);
        item.swEl.setAttribute('aria-checked', on ? 'true' : 'false');
        if (item.itemEl) item.itemEl.classList.toggle('off', !on);
    }

    function bindSwitch(item) {
        if (!item.swEl) return;
        item.swEl.addEventListener('click', function () {
            lights[item.key].on = !(lights[item.key].on !== false);
            updateSwitch(item);
            onChange();
        });
    }

    function bindDial(item) {
        var canvas = item.canvasEl;
        var dragging = false;
        
        function calc(ev) {
            var r = canvas.getBoundingClientRect();
            var x = ev.clientX - r.left, y = ev.clientY - r.top;
            var L = r.width, cx = L / 2, cy = L / 2, Rn = L / 2 - 4;
            var dx = x - cx, dy = y - cy;
            var d = Math.min(Math.hypot(dx, dy), Rn);
            var cur = lights[item.key];
            cur.az = Math.atan2(-dy, dx) * 180 / Math.PI;
            cur.el = Math.max(5, Math.min(90, (d < 1 ? 45 : Math.asin(d / Rn)) * 180 / Math.PI));
            refresh(item);
        }
        canvas.addEventListener('pointerdown', function (ev) {
            dragging = true;
            canvas.setPointerCapture(ev.pointerId);
            calc(ev);
        });
        canvas.addEventListener('pointermove', function (ev) { if (dragging) calc(ev); });
        canvas.addEventListener('pointerup', function () { dragging = false; });
        canvas.addEventListener('pointercancel', function () { dragging = false; });
    }

    
    
    function bindLocalSliders() {
        SLIDER_IDS.forEach(function (id) {
            var input = document.getElementById(id);
            if (!input) return;
            var outId = 'slider-value' + id.replace('slider', '');
            input.addEventListener('input', function () {
                var out = document.getElementById(outId);
                if (out) out.textContent = input.value;
                onChange();
            });
        });
    }

    
    
    function setEditingUI(on) {
        document.body.classList.toggle('relight-editing', on);
    }

    function createBottomButtons() {
        var bar = document.querySelector('.sub-container.bottom');
        if (!bar || document.getElementById('relight-bottom-cancel-btn')) return;
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'header-buttons2';
        cancelBtn.id = 'relight-bottom-cancel-btn';
        cancelBtn.textContent = '取消';
        var applyBtn = document.createElement('button');
        applyBtn.className = 'header-buttons2';
        applyBtn.id = 'relight-bottom-apply-btn';
        applyBtn.style.background = '#0187ff';
        applyBtn.style.color = '#fff';
        applyBtn.textContent = '确认';
        bar.appendChild(cancelBtn);
        bar.appendChild(applyBtn);
    }

    
    function snapshot() {
        return {
            key:  { az: lights.key.az,  el: lights.key.el,  on: lights.key.on },
            fill: { az: lights.fill.az, el: lights.fill.el, on: lights.fill.on },
            rim:  { az: lights.rim.az,  el: lights.rim.el,  on: lights.rim.on },
            intensity: sliderVal('relight_intensity', 100),
            ambient:   sliderVal('relight_ambient', 12),
            blur:      sliderVal('relight_blur', 0),
            opacity:   sliderVal('relight_opacity', 75)
        };
    }

    function setSliderVal(id, v) {
        var el = document.getElementById(id);
        if (!el) return;
        el.value = v;
        var out = document.getElementById('slider-value' + id.replace('slider', ''));
        if (out) out.textContent = v;
    }

    
    function gaussianBlurKernel(sigma) {
        var radius = Math.max(1, Math.ceil(sigma * 3));
        var size = radius * 2 + 1;
        var kernel = new Float32Array(size);
        var sum = 0;
        for (var i = -radius; i <= radius; i++) {
            kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
            sum += kernel[i + radius];
        }
        for (var j = 0; j < size; j++) kernel[j] /= sum;
        return kernel;
    }

    
    function applyGaussianBlur(srcCanvas, sigma) {
        if (sigma <= 0) return srcCanvas;
        var w = srcCanvas.width, h = srcCanvas.height;
        var ctx = srcCanvas.getContext('2d');
        var imageData = ctx.getImageData(0, 0, w, h);
        var src = imageData.data;

        var kernel = gaussianBlurKernel(sigma);
        var tmp = new Uint8ClampedArray(w * h * 4); 

        
        var klen = kernel.length;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dstIdx = (y * w + x) * 4;
                var r = 0, g = 0, b = 0;
                for (var k = 0; k < klen; k++) {
                    var sx = x + k - (klen - 1) / 2;
                    if (sx < 0) sx = -sx;
                    else if (sx >= w) sx = 2 * w - 2 - sx;
                    var srcIdx = (y * w + sx) * 4;
                    r += src[srcIdx] * kernel[k];
                    g += src[srcIdx + 1] * kernel[k];
                    b += src[srcIdx + 2] * kernel[k];
                }
                tmp[dstIdx] = r;
                tmp[dstIdx + 1] = g;
                tmp[dstIdx + 2] = b;
                tmp[dstIdx + 3] = 255; 
            }
        }

        
        var result = ctx.createImageData(w, h);
        var dst = result.data;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dstIdx = (y * w + x) * 4;
                var r = 0, g = 0, b = 0;
                for (var k = 0; k < klen; k++) {
                    var sy = y + k - (klen - 1) / 2;
                    if (sy < 0) sy = -sy;
                    else if (sy >= h) sy = 2 * h - 2 - sy;
                    var srcIdx = (sy * w + x) * 4;
                    r += tmp[srcIdx] * kernel[k];
                    g += tmp[srcIdx + 1] * kernel[k];
                    b += tmp[srcIdx + 2] * kernel[k];
                }
                dst[dstIdx] = r;
                dst[dstIdx + 1] = g;
                dst[dstIdx + 2] = b;
                dst[dstIdx + 3] = 255;
            }
        }

        ctx.putImageData(result, 0, 0);
        return srcCanvas;
    }

    
    function gaussianBlurKernel(sigma) {
        var radius = Math.max(1, Math.ceil(sigma * 3));
        var size = radius * 2 + 1;
        var kernel = new Float32Array(size);
        var sum = 0;
        for (var i = -radius; i <= radius; i++) {
            kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
            sum += kernel[i + radius];
        }
        for (var j = 0; j < size; j++) kernel[j] /= sum;
        return kernel;
    }

    
    function applyGaussianBlur(srcCanvas, sigma) {
        if (sigma <= 0) return srcCanvas;
        var w = srcCanvas.width, h = srcCanvas.height;
        var ctx = srcCanvas.getContext('2d');
        var imageData = ctx.getImageData(0, 0, w, h);
        var src = imageData.data;

        var kernel = gaussianBlurKernel(sigma);
        var tmp = new Uint8ClampedArray(w * h * 4); 

        
        var klen = kernel.length;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dstIdx = (y * w + x) * 4;
                var r = 0, g = 0, b = 0;
                for (var k = 0; k < klen; k++) {
                    var sx = x + k - (klen - 1) / 2;
                    if (sx < 0) sx = -sx;
                    else if (sx >= w) sx = 2 * w - 2 - sx;
                    var srcIdx = (y * w + sx) * 4;
                    r += src[srcIdx] * kernel[k];
                    g += src[srcIdx + 1] * kernel[k];
                    b += src[srcIdx + 2] * kernel[k];
                }
                tmp[dstIdx] = r;
                tmp[dstIdx + 1] = g;
                tmp[dstIdx + 2] = b;
                tmp[dstIdx + 3] = 255; 
            }
        }

        
        var result = ctx.createImageData(w, h);
        var dst = result.data;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dstIdx = (y * w + x) * 4;
                var r = 0, g = 0, b = 0;
                for (var k = 0; k < klen; k++) {
                    var sy = y + k - (klen - 1) / 2;
                    if (sy < 0) sy = -sy;
                    else if (sy >= h) sy = 2 * h - 2 - sy;
                    var srcIdx = (sy * w + x) * 4;
                    r += tmp[srcIdx] * kernel[k];
                    g += tmp[srcIdx + 1] * kernel[k];
                    b += tmp[srcIdx + 2] * kernel[k];
                }
                dst[dstIdx] = r;
                dst[dstIdx + 1] = g;
                dst[dstIdx + 2] = b;
                dst[dstIdx + 3] = 255;
            }
        }

        ctx.putImageData(result, 0, 0);
        return srcCanvas;
    }

    function setSliderVal(id, v) {
        var el = document.getElementById(id);
        if (!el) return;
        el.value = v;
        var out = document.getElementById('slider-value' + id.replace('slider', ''));
        if (out) out.textContent = v;
    }

    function restore(s) {
        if (!s) return;
        ['key', 'fill', 'rim'].forEach(function (k) {
            lights[k].az = s[k].az;
            lights[k].el = s[k].el;
            if (s[k].on !== undefined) lights[k].on = s[k].on;
        });
        setSliderVal('relight_intensity', s.intensity);
        setSliderVal('relight_ambient', s.ambient);
        setSliderVal('relight_opacity', s.opacity);
        dialItems.forEach(function (it) { drawDial(it); updateDirText(it); updateSwitch(it); });
    }

    
    function enter() {
        if (editing) return;
        var img = currentImage();
        if (!img) { return; }
        editing = true;
        committed = snapshot();
        dirty = false;
        preview = null; savedCanvas = null;   
        setEditingUI(true);
        rlog('进入编辑态 imageId=' + img.id);
        ensureNormals(img);   
        ensureMask(img);      
    }

    
    function apply() {
        if (!editing) return;
        var img = currentImage();
        committed = snapshot();
        dirty = false;
        editing = false;
        setEditingUI(false);
        rlog('确认应用', committed);
        
        if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = 0; }
        preview = null; savedCanvas = null;
        if (img) commitLayer(img, committed);
    }

    
    function switchToBeauty() {
        var beautyBtn = document.getElementById('beauty-filter-group-box');
        if (beautyBtn) beautyBtn.click();
    }

    
    function currentImage() {
        if (typeof imageDataList !== 'undefined' && typeof currentImageIndex !== 'undefined'
            && currentImageIndex >= 0 && imageDataList[currentImageIndex]) {
            return imageDataList[currentImageIndex];
        }
        return null;
    }

    function relightState(img) {
        if (!img.relight) img.relight = { params: null, layerSaved: false, normal: null, loading: false };
        return img.relight;
    }

    
    var loadingOwned = false;
    function showRelightLoading(text) {
        var info = document.getElementById('requestInfo');
        if (!info) return;
        info.textContent = text;
        var sp = document.createElement('div');
        sp.className = 'loading-spinner';
        info.appendChild(sp);
        loadingOwned = true;
    }
    function hideRelightLoading() {
        if (!loadingOwned) return;   
        loadingOwned = false;
        var info = document.getElementById('requestInfo');
        if (!info) return;
        if (typeof showRequestInfoSize === 'function') showRequestInfoSize();
        else info.textContent = '';
    }

    
    async function ensureNormals(img) {
        var st = relightState(img);
        if (st.normal || st.loading) return;
        st.loading = true;
        rlog('ensureNormals 开始 imageId=' + img.id);
        try {
            var has = await iceaiNative.hasRelightNormal({ imageId: img.id });
            rlog('hasRelightNormal 返回', has);
            if (!has || !has.has) {
                
                showRelightLoading('正在进行光线追踪');
                var inf;
                try {
                    inf = await iceaiNative.inferRelightNormal({ imageId: img.id });
                } finally {
                    hideRelightLoading();
                }
                rlog('inferRelightNormal 返回', inf);
                if (!inf || !inf.success) throw new Error((inf && inf.error) || '法线推理失败');
            }
            var buf = await iceaiNative.getRelightNormal({ imageId: img.id });
            rlog('getRelightNormal 收到字节=' + (buf ? buf.byteLength : 0));
            st.normal = await decodePngImageData(buf);
            st.normalCanvas = imageDataToCanvas(st.normal);
            rlog('法线解码完成 ' + st.normal.width + 'x' + st.normal.height);
            await ensureBase(img);
            onChange();
        } catch (e) {
            console.error('[二次打光] 获取法线失败:', e);
        } finally {
            st.loading = false;
        }
    }

    
    
    async function ensureMask(img) {
        var st = relightState(img);
        if (st.maskCanvas || st.maskLoading) return;
        st.maskLoading = true;
        try {
            var buf = await iceaiNative.getRelightMask({ imageId: img.id });
            if (buf && buf.byteLength > 0) {
                var d = await decodePngImageData(buf);
                st.maskCanvas = imageDataToCanvas(d);
                rlog('遮罩已获取 ' + d.width + 'x' + d.height);
            }
        } catch (e) {
            console.warn('[二次打光] 获取遮罩失败，按全区域打光处理:', e);
        } finally {
            st.maskLoading = false;
        }
    }

    
    function refreshMask() {
        var img = currentImage();
        if (!img) return;
        relightState(img).maskCanvas = null;
        ensureMask(img).then(function () {
            if (!editing) return;
            preview = null;       
            schedulePreview();
        });
    }

    
    
    
    
    async function dumpLayer(maxSide) {
        var img = currentImage();
        if (!img) { console.warn('[二次打光] 无当前图片'); return null; }
        var st = relightState(img);
        if (!st.normal) await ensureNormals(img);
        if (!st.normal) { console.warn('[二次打光] 法线未就绪，无法生成图层'); return null; }
        var canvas = buildLayerCanvas(st.normal, true);
        if (maxSide && Math.max(canvas.width, canvas.height) > maxSide) {
            var s = maxSide / Math.max(canvas.width, canvas.height);
            var t = document.createElement('canvas');
            t.width = Math.max(1, Math.round(canvas.width * s));
            t.height = Math.max(1, Math.round(canvas.height * s));
            t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
            canvas = t;
        }
        var url = canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relight_layer_' + canvas.width + 'x' + canvas.height + '.png';
        a.click();
        rlog('dumpLayer 已导出 ' + canvas.width + 'x' + canvas.height);
        return url;
    }

    
    
    
    
    async function dumpNormal(maxSide) {
        var img = currentImage();
        if (!img) { console.warn('[二次打光] 无当前图片'); return null; }
        var st = relightState(img);
        if (!st.normal) await ensureNormals(img);
        if (!st.normal) { console.warn('[二次打光] 法线未就绪'); return null; }
        var canvas = st.normalCanvas || imageDataToCanvas(st.normal);
        if (maxSide && Math.max(canvas.width, canvas.height) > maxSide) {
            var s = maxSide / Math.max(canvas.width, canvas.height);
            var t = document.createElement('canvas');
            t.width = Math.max(1, Math.round(canvas.width * s));
            t.height = Math.max(1, Math.round(canvas.height * s));
            t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
            canvas = t;
        }
        var url = canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relight_normal_' + canvas.width + 'x' + canvas.height + '.png';
        a.click();
        rlog('dumpNormal 已导出 ' + canvas.width + 'x' + canvas.height);
        return url;
    }


    


    
    function decodePngImageData(buffer) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
            var im = new Image();
            im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('法线解码失败')); };
            im.onload = function () {
                var c = document.createElement('canvas');
                c.width = im.width; c.height = im.height;
                var cx = c.getContext('2d');
                cx.drawImage(im, 0, 0);
                var d = cx.getImageData(0, 0, im.width, im.height);
                URL.revokeObjectURL(url);
                resolve(d);
            };
            im.src = url;
        });
    }

    
    function lightDir(az, el) {
        var a = az * Math.PI / 180, e = el * Math.PI / 180;
        return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
    }

    
    function lightDirs(p) {
        return ['key', 'fill', 'rim']
            .filter(function (k) { return p[k].on !== false; })
            .map(function (k) { return lightDir(p[k].az, p[k].el); });
    }

    
    
    function buildLayerCanvas(normal, doBlur) {
        var w = normal.width, h = normal.height, src = normal.data;
        var p = snapshot();
        var amb = p.ambient / 100, inten = p.intensity / 100;
        var dirs = lightDirs(p);
        var out = document.createElement('canvas');
        out.width = w; out.height = h;
        var oc = out.getContext('2d');
        var im = oc.createImageData(w, h), o = im.data;
        for (var i = 0, q = 0; i < w * h; i++, q += 4) {
            var nx = src[q] / 127.5 - 1, ny = src[q + 1] / 127.5 - 1, nz = src[q + 2] / 127.5 - 1;
            var lam = 0;
            for (var d = 0; d < dirs.length; d++) {
                var t = nx * dirs[d][0] + ny * dirs[d][1] + nz * dirs[d][2];
                if (t > 0) lam += t;
            }
            var v = Math.round(Math.min(1, amb + lam * inten) * 255);
            o[q] = o[q + 1] = o[q + 2] = v; o[q + 3] = 255;
        }
        oc.putImageData(im, 0, 0);
        
        if (doBlur && p.blur > 0) {
            var sigma = p.blur / 6; 
            applyGaussianBlur(out, sigma);
        }
        return out;
    }

    
    
    var PREVIEW_MAX = 800;   
    var preview = null;      
    var previewRaf = 0;
    var savedCanvas = null;  

    function mainCanvas() { return document.querySelector('.browser-image'); }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    function schedulePreview() {
        if (previewRaf) return;
        previewRaf = requestAnimationFrame(renderPreview);
    }

    function imageDataToCanvas(im) {
        var c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        c.getContext('2d').putImageData(im, 0, 0);
        return c;
    }

    
    
    async function ensureBase(img) {
        var st = relightState(img);
        if (st.baseCanvas || st.baseLoading) return;
        st.baseLoading = true;
        try {
            var buf = await iceaiNative.getGroupImage({ image_id: img.id, group_id: 0 });
            if (buf && buf.length > 0 && typeof window.decodeBinaryResponse === 'function') {
                var d = await window.decodeBinaryResponse(buf);
                st.baseCanvas = imageDataToCanvas(d);
                rlog('基准原图已获取 ' + d.width + 'x' + d.height);
            }
        } catch (e) {
            console.warn('[二次打光] 获取基准原图失败，回退主画布:', e);
        } finally {
            st.baseLoading = false;
        }
    }

    
    function preparePreview() {
        var img = currentImage();
        var st = img ? relightState(img) : null;
        if (!st || !st.normal || !st.normalCanvas) return;
        var mc = mainCanvas();
        if (!mc || !mc.width || !mc.height) return;

        savedCanvas = document.createElement('canvas');
        savedCanvas.width = mc.width; savedCanvas.height = mc.height;
        savedCanvas.getContext('2d').drawImage(mc, 0, 0);

        var s = Math.min(1, PREVIEW_MAX / Math.max(mc.width, mc.height));
        var pw = Math.max(1, Math.round(mc.width * s));
        var ph = Math.max(1, Math.round(mc.height * s));

        
        
        var baseSrc = st.baseCanvas || mc;
        var pv = document.createElement('canvas'); pv.width = pw; pv.height = ph;
        var pvc = pv.getContext('2d', { willReadFrequently: true });
        pvc.drawImage(baseSrc, 0, 0, baseSrc.width, baseSrc.height, 0, 0, pw, ph);
        var baseData = pvc.getImageData(0, 0, pw, ph);

        
        var nv = document.createElement('canvas'); nv.width = pw; nv.height = ph;
        var nvc = nv.getContext('2d', { willReadFrequently: true });
        nvc.drawImage(st.normalCanvas, 0, 0, st.normal.width, st.normal.height, 0, 0, pw, ph);
        var nrm = nvc.getImageData(0, 0, pw, ph).data;

        preview = { pv: pv, pvc: pvc, baseData: baseData,
                    work: pvc.createImageData(pw, ph), nrm: nrm, pw: pw, ph: ph };

        
        if (st.maskCanvas) {
            var mvv = document.createElement('canvas'); mvv.width = pw; mvv.height = ph;
            var mvc = mvv.getContext('2d', { willReadFrequently: true });
            mvc.drawImage(st.maskCanvas, 0, 0, st.maskCanvas.width, st.maskCanvas.height, 0, 0, pw, ph);
            preview.msk = mvc.getImageData(0, 0, pw, ph).data;
        }
    }

    
    function renderPreview() {
        previewRaf = 0;
        if (!editing) return;
        if (!preview) preparePreview();
        if (!preview) return;
        var mc = mainCanvas();
        if (!mc) return;

        var p = snapshot();
        var amb = clamp01(p.ambient / 100), inten = p.intensity / 100, op = clamp01(p.opacity / 100);
        var blurPx = p.blur || 0;
        var dirs = lightDirs(p);

        
        var bW = preview.pw, bH = preview.ph;
        var bCanvas = document.createElement('canvas');
        bCanvas.width = bW; bCanvas.height = bH;
        var bc = bCanvas.getContext('2d', { willReadFrequently: true });
        var bd = bc.createImageData(bW, bH), bdata = bd.data;
        var nrm = preview.nrm;
        for (var i = 0, q = 0; i < bW * bH; i++, q += 4) {
            var nx = nrm[q] / 127.5 - 1, ny = nrm[q + 1] / 127.5 - 1, nz = nrm[q + 2] / 127.5 - 1;
            var lam = 0;
            for (var d = 0; d < dirs.length; d++) {
                var t = nx * dirs[d][0] + ny * dirs[d][1] + nz * dirs[d][2];
                if (t > 0) lam += t;
            }
            var b = Math.min(1, amb + lam * inten);
            bdata[q] = bdata[q + 1] = bdata[q + 2] = Math.round(b * 255);
            bdata[q + 3] = 255;
        }
        bc.putImageData(bd, 0, 0);

        
        if (blurPx > 0) {
            var sigma = blurPx / 6;
            var blurRadius = Math.max(0, Math.round(sigma * 2));
            if (typeof bCanvas.getContext('2d').filter === 'string') {
                
                var blurred = document.createElement('canvas');
                blurred.width = bW; blurred.height = bH;
                var blc = blurred.getContext('2d');
                blc.filter = 'blur(' + blurRadius + 'px)';
                blc.drawImage(bCanvas, 0, 0);
                bCanvas = blurred;
                bc = bCanvas.getContext('2d', { willReadFrequently: true });
            } else {
                
                applyGaussianBlur(bCanvas, sigma);
                bc = bCanvas.getContext('2d', { willReadFrequently: true });
            }
        }

        
        var bfield = bc.getImageData(0, 0, bW, bH).data;
        var o = preview.work.data;
        o.set(preview.baseData.data);   
        var msk = preview.msk || null;  
        for (var i = 0, q = 0; i < bW * bH; i++, q += 4) {
            var b = bfield[q] / 255;
            var opEff = msk ? op * (msk[q] / 255) : op;
            for (var c = 0; c < 3; c++) {
                var a = o[q + c] / 255;
                var sl = b < 0.5 ? (2 * a * b + a * a * (1 - 2 * b))
                                 : (2 * a * (1 - b) + Math.sqrt(a) * (2 * b - 1));
                var v = a * (1 - opEff) + sl * opEff;
                o[q + c] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
            }
        }
        preview.pvc.putImageData(preview.work, 0, 0);

        var c2 = mc.getContext('2d');
        c2.clearRect(0, 0, mc.width, mc.height);
        c2.drawImage(preview.pv, 0, 0, mc.width, mc.height);
    }

    
    function restoreMainCanvas() {
        if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = 0; }
        var mc = mainCanvas();
        if (mc && savedCanvas) {
            var c = mc.getContext('2d');
            c.clearRect(0, 0, mc.width, mc.height);
            c.drawImage(savedCanvas, 0, 0);
        }
        preview = null;
        savedCanvas = null;
    }

    
    async function commitLayer(img, params) {
        var st = relightState(img);
        rlog('commitLayer 开始 imageId=' + img.id + ' opacity=' + params.opacity);
        try {
            if (!st.normal) await ensureNormals(img);
            if (!st.normal) throw new Error('法线未就绪');
            var base64 = buildLayerCanvas(st.normal, true).toDataURL('image/png').split(',')[1];
            rlog('柔光图层已渲染 base64长度=' + base64.length);
            var r = await iceaiNative.saveRelightLayer({
                imageId: img.id,
                relightLayer: base64,
                opacity: params.opacity,
                snapshot: JSON.stringify(params)
            });
            rlog('saveRelightLayer 返回', r);
            if (!r || !r.success) throw new Error((r && r.error) || '保存光照图层失败');
            st.params = params;
            st.layerSaved = true;
            rlog('图层已保存，触发从 G1 重算');
            afterRelightSaved(img);
        } catch (e) {
            console.error('[二次打光] 保存失败:', e);
        }
    }

    
    function afterRelightSaved(imageData) {
        if (imageData.groupCache) {
            imageData.groupCache.isInitialized = false;
            for (var i = 1; i <= 21; i++) imageData.groupCache['group' + i] = null;
        }
        if (window.BackendCacheManager && BackendCacheManager.markGroupsForClearing) {
            BackendCacheManager.markGroupsForClearing([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]);
        }
        if (typeof notifyImageDataListUpdated === 'function') notifyImageDataListUpdated();
        document.dispatchEvent(new Event('imageChanged'));
        if (typeof sendRequest === 'function') sendRequest(imageData);
    }


    
    function cancel() {
        if (!editing) return;
        restore(committed);
        restoreMainCanvas();   
        dirty = false;
        editing = false;
        setEditingUI(false);
    }

    
    
    
    function reset() {
        ['key', 'fill', 'rim'].forEach(function (k) {
            var d = LIGHT_DEFAULTS[k];
            lights[k].az = d.az; lights[k].el = d.el; lights[k].on = d.on;
        });
        Object.keys(SLIDER_DEFAULTS).forEach(function (id) { setSliderVal(id, SLIDER_DEFAULTS[id]); });
        dialItems.forEach(function (it) { drawDial(it); updateDirText(it); updateSwitch(it); });

        if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = 0; }
        preview = null; savedCanvas = null;
        editing = false; dirty = false; committed = null;
        setEditingUI(false);

        var img = currentImage();
        if (!img) return Promise.resolve();
        var st = relightState(img);
        st.params = null;
        st.layerSaved = false;
        return iceaiNative.clearRelightLayer({ imageId: img.id })
            .then(function (r) { rlog('clearRelightLayer 返回', r); })
            .catch(function (e) { console.error('[二次打光] 清除图层失败:', e); });
    }

    
    function isAtDefaults() {
        var changed = false;
        ['key', 'fill', 'rim'].forEach(function (k) {
            var d = LIGHT_DEFAULTS[k], c = lights[k];
            if (c.az !== d.az || c.el !== d.el || (c.on !== false) !== d.on) changed = true;
        });
        SLIDER_IDS.forEach(function (id) {
            if (sliderVal(id, SLIDER_DEFAULTS[id]) !== SLIDER_DEFAULTS[id]) changed = true;
        });
        return !changed;
    }

    function refreshGroupResetBtn() {
        var btn = document.getElementById('relightGroup_reset_btn');
        if (btn) btn.style.display = isAtDefaults() ? 'none' : 'block';
    }

    function resetLocal() {
        ['key', 'fill', 'rim'].forEach(function (k) {
            var d = LIGHT_DEFAULTS[k];
            lights[k].az = d.az; lights[k].el = d.el; lights[k].on = d.on;
        });
        SLIDER_IDS.forEach(function (id) { setSliderVal(id, SLIDER_DEFAULTS[id]); });
        dialItems.forEach(function (it) { drawDial(it); updateDirText(it); updateSwitch(it); });
        if (editing) { dirty = true; schedulePreview(); }
        refreshGroupResetBtn();
    }

    function bindGroupReset() {
        var btn = document.getElementById('relightGroup_reset_btn');
        if (!btn) return;
        btn.style.display = 'none';
        btn.addEventListener('click', resetLocal);
        
        var lastIdx = -1;
        setInterval(function () {
            if (typeof currentImageIndex !== 'undefined' && currentImageIndex !== lastIdx) {
                lastIdx = currentImageIndex;
                refreshGroupResetBtn();
            }
        }, 200);
    }

    function init() {
        MAP.forEach(function (m) {
            var item = {
                key: m.key,
                size: m.size,
                canvasEl: document.getElementById(m.canvas),
                dirEl: document.getElementById(m.dir),
                swEl: m.sw ? document.getElementById(m.sw) : null
            };
            if (item.swEl) item.itemEl = item.swEl.closest('.relight-light-item');
            if (!item.canvasEl) return;
            dialItems.push(item);
            bindDial(item);
            bindSwitch(item);
            drawDial(item);
            updateDirText(item);
            updateSwitch(item);
        });
        bindLocalSliders();
        bindGroupReset();
        createBottomButtons();

        var cancelBtn = document.getElementById('relight-bottom-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', function () { cancel(); switchToBeauty(); });
        var applyBtn = document.getElementById('relight-bottom-apply-btn');
        if (applyBtn) applyBtn.addEventListener('click', function () { apply(); switchToBeauty(); });

        
        

        
        var toolBtn = document.getElementById('relight-group-box');
        if (toolBtn) toolBtn.addEventListener('click', enter);

        
        window.RelightPanel = {
            getParams: getParams,
            snapshot: snapshot,
            enter: enter,
            apply: apply,
            cancel: cancel,
            reset: reset,
            isEditing: function () { return editing; },
            isDirty: function () { return dirty; },
            setDebug: function (v) { RELIGHT_DEBUG = !!v; },
            ensureNormals: ensureNormals,
            refreshMask: refreshMask,
            buildLayerCanvas: buildLayerCanvas,
            dumpLayer: dumpLayer,
            dumpNormal: dumpNormal,
            redraw: function () { dialItems.forEach(function (it) { drawDial(it); updateDirText(it); updateSwitch(it); }); }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();