# 小彻工坊 (XiaoChe Workshop)

面向摄影师的 AI 修图工作台。集 AI 人像精修、RAW 解码、调色预设、联机拍摄于一体的 Windows 桌面应用。

![logo](docs/logo.png)

## ✨ 功能特性

- **AI 精修**：人像磨皮、祛痘祛皱、五官重塑、皮肤调整（进程内 ONNX 推理，无需联网）
- **RAW 支持**：内置 dcraw 引擎，直接解码相机 RAW 格式
- **调色预设**：内置 100+ 专业 .cube 调色预设，支持导入自定义 LUT
- **AI 创意**：文生图工作流（支持接入自有模型服务）
- **本地项目管理**：.iceai 项目格式，自动保存与恢复
- **令牌授权**：本地令牌签发与校验，离线可用

## 📦 下载安装

前往 [Releases](https://github.com/xiaoche0907/xcxiutu/releases) 页面下载最新版本安装包。

## 🔄 更新机制

应用内置更新系统：**系统设置 → 软件更新 → 检查更新**。
新版本发布后，客户端会自动检测并提示，一键完成更新。

## 🗂 仓库结构

```
├── src/            # 应用源码（Electron 主进程 + 渲染层）
│   ├── main.js         # 主进程入口
│   ├── token_gate.js   # 令牌授权系统
│   ├── update_system.js# 更新系统
│   ├── js/             # 渲染层脚本
│   └── ...
├── docs/           # 文档
├── scripts/        # 构建与发布脚本
├── build/          # 打包配置
└── version.json    # 当前版本元数据（更新源）
```

## 🛠 技术栈

Electron · ONNX Runtime · OpenCV · WebGPU · cpp-httplib

## 📄 License

MIT © 小彻工坊
