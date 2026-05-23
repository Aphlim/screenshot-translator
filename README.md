# FuckEnglish

> 桌面级英文截图翻译工具:按下 `Ctrl+T` → 框选屏幕区域 → 在临近位置弹出中文译文,保留原文段落 / 换行结构。

## 当前进度

- [x] 阶段 0:Electron + Vite + React + TypeScript 脚手架
- [ ] 阶段 1:常驻系统托盘 + 全局快捷键 `Ctrl+T`
- [ ] 阶段 2:截图 + 框选窗
- [ ] 阶段 3:Tesseract.js OCR
- [ ] 阶段 4:OpenAI 兼容 LLM 翻译
- [ ] 阶段 5:翻译结果弹窗
- [ ] 阶段 6:设置页 + 持久化配置
- [ ] 阶段 7:`electron-builder` 打包

完整设计文档:`C:\Users\12946\.claude\plans\ctrl-t-zany-fog.md`

## 开发

```powershell
npm install         # 首次或依赖变动时
npm run dev         # 启动开发模式(热重载)
npm run typecheck   # TypeScript 类型检查
npm run build       # 生产构建
```

## 项目结构

```
src/
├── main/        Electron 主进程(系统能力:快捷键、截屏、窗口管理)
├── preload/     主进程与渲染进程之间的桥
├── renderer/    UI(React),后续会有多个窗口入口
└── shared/      主 / 渲染共享的 TS 类型 + IPC 通道常量
```

## API Key 策略

应用从不内置任何 API key。每个使用者在设置页填入自己的 OpenAI 兼容服务凭证
(`baseURL` / `apiKey` / `model`),保存在本机的 `%APPDATA%\FuckEnglish\config.json`。
推荐 [DeepSeek](https://platform.deepseek.com)(便宜)或 [SiliconFlow](https://siliconflow.cn)。
