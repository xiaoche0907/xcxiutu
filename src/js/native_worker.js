;

let native = null;

function getTransferable(result) {
    if (result instanceof ArrayBuffer) return [result];
    if (ArrayBuffer.isView(result)) return [result.buffer];
    return [];
}

self.onmessage = (e) => {
    const msg = e.data || {};

    if (msg.type === '__init__') {
        const nativePath = msg.nativePath;
        try {
            const path = require('path');
            const fs = require('fs');
            if (msg.resourcesPath) {
                const chdirPath = path.resolve(nativePath, '..', '..');
                try { process.chdir(chdirPath); } catch (err) { console.warn('[Worker] chdir 失败:', err.message); }
            }
            ;
            native = require(nativePath);
            ;
            self.postMessage({ type: '__ready__', ok: true });
        } catch (err) {
            console.error('[Worker] 原生模块加载失败:', err);
            self.postMessage({ type: '__ready__', ok: false, error: err.message || String(err) });
        }
        return;
    }

    if (!native) {
        self.postMessage({ callId: msg.callId, error: { message: '原生模块未初始化' } });
        return;
    }

    const { callId, method, args } = msg;
    try {
        const fn = native[method];
        if (typeof fn !== 'function') {
            self.postMessage({ callId, error: { message: '原生模块无此方法: ' + method } });
            return;
        }
        const result = fn.apply(native, args || []);
        self.postMessage({ callId, result }, getTransferable(result));
    } catch (err) {
        self.postMessage({ callId, error: { message: err.message || String(err) } });
    }
};
