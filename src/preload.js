const { ipcRenderer } = require('electron');window.electronAPI = {getAppPath: () => ipcRenderer.invoke('get-app-path'),checkServerStatus: () => ipcRenderer.invoke('check-server-status'),restartServer: () => ipcRenderer.invoke('restart-server'),selectFile: () => ipcRenderer.invoke('select-file'),startTerminal: () => ipcRenderer.invoke('start-terminal'),writeTerminal: (data) => ipcRenderer.invoke('write-terminal', data),stopTerminal: () => ipcRenderer.invoke('stop-terminal'),openFolder: (path) => ipcRenderer.invoke('open-folder', path),downloadUpdateFile: (url, fileName) => ipcRenderer.invoke('download-update-file', url, fileName),runUpdater: () => ipcRenderer.invoke('run-updater'),getLatestVersion: () => ipcRenderer.invoke('get-latest-version'),onServerStatusChange: (callback) => {ipcRenderer.on('server-status-changed', callback);},onTerminalOutput: (callback) => {ipcRenderer.on('terminal-output', callback);},onTerminalExit: (callback) => {ipcRenderer.on('terminal-exit', callback);},onDownloadProgress: (callback) => {ipcRenderer.on('download-progress', callback);},listDesktopIceai: () => ipcRenderer.invoke('list-desktop-iceai'),getDesktopPath: () => ipcRenderer.invoke('get-desktop-path'),selectIceaiFile: () => ipcRenderer.invoke('select-iceai-file'),writePreviewFile: (payload) => ipcRenderer.invoke('write-preview-file', payload),renameIceaiFile: (payload) => ipcRenderer.invoke('rename-iceai-file', payload),deleteIceaiFile: (payload) => ipcRenderer.invoke('delete-iceai-file', payload),selectExportFolder: () => ipcRenderer.invoke('select-export-folder'),saveImageBuffers: (payload) => ipcRenderer.invoke('save-image-buffers', payload),diagnoseNativeModule: () => ipcRenderer.invoke('diagnose-native-module'),showErrorLog: (errorLog) => ipcRenderer.invoke('show-error-log', errorLog),};window.appUtils = {isElectron: () => true,getPlatform: () => process.platform,showNotification: (title, body) => {if (Notification.permission === 'granted') {new Notification(title, { body });}}};
window.tokenGate = {
  verifyToken: (t) => ipcRenderer.invoke('verify-token', t),
  hasTokenConfig: () => ipcRenderer.invoke('has-token-config'),
  adminLogin: (p) => ipcRenderer.invoke('admin-login', p),
  adminListTokens: () => ipcRenderer.invoke('admin-list-tokens'),
  adminGenerateToken: (o) => ipcRenderer.invoke('admin-generate-token', o),
  adminRevokeToken: (o) => ipcRenderer.invoke('admin-revoke-token', o),
};

window.updateAPI = {
  check: () => ipcRenderer.invoke('update-check'),
  download: (url) => ipcRenderer.invoke('update-download', url),
  apply: () => ipcRenderer.invoke('update-apply'),
  prepareRelease: (o) => ipcRenderer.invoke('admin-prepare-release', o),
};
