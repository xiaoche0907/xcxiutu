// 本地令牌门禁 + 管理员签发系统
// 令牌文件: resources/token.key  每行一个令牌，# 注释
// 管理员密码: resources/admin.key  单行 sha256（由 setup_admin.py 生成）
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function resourcesDir() {
  try {
    const appPath = app.getAppPath();
    if (appPath.endsWith('.asar')) return path.dirname(appPath);
  } catch (e) { /* fallthrough */ }
  return __dirname ? path.join(__dirname, '..') : process.cwd();
}

function tokenFile() { return path.join(resourcesDir(), 'token.key'); }
function adminFile() { return path.join(resourcesDir(), 'admin.key'); }

function loadTokenHashes() {
  try {
    if (fs.existsSync(tokenFile())) {
      return fs.readFileSync(tokenFile(), 'utf-8')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => (/^[0-9a-f]{64}$/i.test(l) ? l.toLowerCase() : sha256(l)));
    }
  } catch (e) { /* ignore */ }
  return [];
}

function saveTokenHashes(hashes) {
  const body = [
    '# 小彻工坊 访问令牌列表（每行一个 sha256，# 为注释）',
    ...hashes,
    '',
  ].join('\n');
  fs.writeFileSync(tokenFile(), body, 'utf-8');
}

ipcMain.handle('verify-token', (_e, token) => {
  const t = String(token || '');
  // 管理员密码可直接在令牌框登录（最高权限标识由登录页写入 sessionStorage）
  try {
    if (fs.existsSync(adminFile())) {
      const expect = fs.readFileSync(adminFile(), 'utf-8').trim().toLowerCase();
      if (sha256(t) === expect) return { ok: true, admin: true };
    }
  } catch (e) { /* fallthrough */ }
  const list = loadTokenHashes();
  if (!list.length) return { ok: false, error: '令牌文件缺失或为空，请联系管理员' };
  return { ok: list.includes(sha256(t)) };
});

ipcMain.handle('has-token-config', () => loadTokenHashes().length > 0);

// ===== 管理员 =====
ipcMain.handle('admin-login', (_e, password) => {
  try {
    if (!fs.existsSync(adminFile())) return { ok: false, error: '管理员未配置' };
    const expect = fs.readFileSync(adminFile(), 'utf-8').trim().toLowerCase();
    return { ok: sha256(String(password || '')) === expect };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('admin-list-tokens', () => {
  return { tokens: loadTokenHashes() };
});

ipcMain.handle('admin-generate-token', (_e, { password, count }) => {
  try {
    if (!fs.existsSync(adminFile())) return { ok: false, error: '管理员未配置' };
    const expect = fs.readFileSync(adminFile(), 'utf-8').trim().toLowerCase();
    if (sha256(String(password || '')) !== expect) return { ok: false, error: '管理员密码错误' };
    const n = Math.max(1, Math.min(50, Number(count) || 1));
    const list = loadTokenHashes();
    const plain = [];
    for (let i = 0; i < n; i++) {
      const t = 'XC-' + crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, '').slice(0, 14).toUpperCase();
      plain.push(t);
      list.push(sha256(t));
    }
    saveTokenHashes(list);
    return { ok: true, tokens: plain };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('admin-revoke-token', (_e, { password, hash }) => {
  try {
    if (!fs.existsSync(adminFile())) return { ok: false, error: '管理员未配置' };
    const expect = fs.readFileSync(adminFile(), 'utf-8').trim().toLowerCase();
    if (sha256(String(password || '')) !== expect) return { ok: false, error: '管理员密码错误' };
    const list = loadTokenHashes().filter(h => h !== String(hash || '').toLowerCase());
    saveTokenHashes(list);
    return { ok: true, remaining: list.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
