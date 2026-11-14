// REA 更新系统 v1
// 发布端：管理员在应用内发布新版本 → 写 version.json + app.asar 到 GitHub 仓库（由 upload 脚本完成）
// 用户端：系统设置检查更新 → 下载 → 替换 asar → 重启
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const REPO_RAW = 'https://raw.githubusercontent.com/xiaoche0907/xcxiutu/main';
const CURRENT_VERSION = '4.2.0';

function resourcesDir() {
  // app.asar 的真实磁盘路径（resources 目录），不能用 asar 虚拟路径
  const candidates = [
    process.resourcesPath,                      // .../resources（打包后）
    path.join(__dirname, '..'),                 // 开发态：app/ 的上级
  ];
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(path.join(c, 'app.asar'))) return c;
    } catch (e) { /* continue */ }
  }
  try { return path.dirname(app.getAppPath()); } catch (e) {}
  return path.join(__dirname, '..');
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
  });
}

// 用户端：检查最新版本
ipcMain.handle('update-check', async () => {
  try {
    const buf = await fetchUrl(REPO_RAW + '/version.json');
    const info = JSON.parse(buf.toString('utf-8'));
    return {
      ok: true,
      current: CURRENT_VERSION,
      latest: info.version,
      notes: info.notes || '',
      publishedAt: info.publishedAt || '',
      hasUpdate: info.version !== CURRENT_VERSION,
      asarUrl: info.asarUrl || (REPO_RAW + '/app-' + info.version + '.asar'),
    };
  } catch (e) {
    return { ok: false, error: '无法连接更新服务器: ' + e.message };
  }
});

// 用户端：下载新 asar 到临时位置
ipcMain.handle('update-download', async (e, url) => {
  try {
    const buf = await fetchUrl(url);
    const tmp = path.join(resourcesDir(), 'app-update.asar.tmp');
    fs.writeFileSync(tmp, buf);
    return { ok: true, size: buf.length, tmp };
  } catch (e) {
    return { ok: false, error: '下载失败: ' + e.message };
  }
});

// 用户端：应用更新（替换 asar 后由用户手动重启 / 或自动退出提示）
ipcMain.handle('update-apply', async () => {
  try {
    const dir = resourcesDir();
    const tmp = path.join(dir, 'app-update.asar.tmp');
    const dst = path.join(dir, 'app.asar');
    const backup = path.join(dir, 'app.asar.backup');
    if (!fs.existsSync(tmp)) return { ok: false, error: '未找到下载的更新包' };
    if (fs.existsSync(dst)) fs.copyFileSync(dst, backup); // 备份
    // 覆盖写（目标可能被 deny-rename 锁定，用流覆盖）；绕过 asar 虚拟路径
    const wasNoAsar = process.noAsar;
    process.noAsar = true;
    try {
    const data = fs.readFileSync(tmp);
    const fd = fs.openSync(dst, 'r+');
    fs.writeSync(fd, data, 0, data.length, 0);
    fs.ftruncateSync(fd, data.length);
    fs.closeSync(fd);
    fs.unlinkSync(tmp);
    } finally {
      process.noAsar = wasNoAsar;
    }
    return { ok: true, needRestart: true };
  } catch (e) {
    return { ok: false, error: '应用更新失败: ' + e.message };
  }
});

// 管理员端：生成本地发布包（version.json 内容 + asar 复制到发布目录）
ipcMain.handle('admin-prepare-release', async (e, { password, version, notes }) => {
  try {
    if (!password) return { ok: false, error: '需要管理员密码' };
    // 验证管理员
    const adminFile = path.join(resourcesDir(), 'admin.key');
    const crypto = require('crypto');
    const expect = fs.readFileSync(adminFile, 'utf-8').trim().toLowerCase();
    if (crypto.createHash('sha256').update(String(password)).digest('hex') !== expect) {
      return { ok: false, error: '管理员密码错误' };
    }
    if (!/^\d+\.\d+\.\d+$/.test(String(version || ''))) return { ok: false, error: '版本号格式应为 x.y.z' };
    const dir = resourcesDir();
    const asarSrc = path.join(dir, 'app.asar');
    if (!fs.existsSync(asarSrc)) return { ok: false, error: '找不到 app.asar' };
    // 发布暂存目录（供 upload 脚本推送 GitHub）
    const outDir = path.join(dir, 'release');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    // 关键：绕过 Electron 的 asar 虚拟文件系统，按真实磁盘文件复制
    const wasNoAsar = process.noAsar;
    process.noAsar = true;
    try {
      fs.copyFileSync(asarSrc, path.join(outDir, 'app-' + version + '.asar'));
    } finally {
      process.noAsar = wasNoAsar;
    }
    const meta = {
      version: String(version),
      notes: String(notes || ''),
      publishedAt: new Date().toISOString(),
      asarUrl: 'https://raw.githubusercontent.com/xiaoche0907/xcxiutu/main/app-' + version + '.asar',
    };
    fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify(meta, null, 2), 'utf-8');
    // 也写一份 upload 指引
    return { ok: true, outDir, meta };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
