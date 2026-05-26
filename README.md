<div align="center">

<img src="resources/icon-128.png" width="96" alt="框译" />

# 框译 · Kuangyi

**屏幕截图英文一键翻译,按 `Ctrl+J` 框选 → 译文就在原文旁边弹出来。**

OCR 在本机跑(自带模型,离线可用),翻译走你自己的 LLM API,数据不经任何第三方服务器。

<br />

[**⬇ 下载最新版**](https://github.com/Aphlim/screenshot-translator/releases/latest) · [问题反馈](https://github.com/Aphlim/screenshot-translator/issues) · [从源码构建](#从源码构建)

</div>

---

## 适合谁

- 看英文文档 / 论文 / 报错信息 / 游戏剧情,**不想离开当前窗口**去复制粘贴翻译
- 想用 **自己的 API key**(DeepSeek 几分钱一次,可控)而不是某些工具的内置额度
- 不想让任何第三方扫描你的剪贴板和屏幕

## 快速上手(3 步)

### ① 下载安装

去 [Releases](https://github.com/Aphlim/screenshot-translator/releases/latest) 下载 `Kuangyi-Setup-0.1.0-x64.exe`,双击安装。

> ⚠️ Windows 会弹「未识别的应用」警告 → 这是因为我没买代码签名证书(几百刀一年,个人开发者跳过)。点 **「更多信息」→「仍要运行」** 即可。**源码全部开源,你可以自己审计或编译。**

安装完会自动启动,系统托盘出现橘色 T 图标。**第一次启动会自动弹设置页**。

### ② 填 LLM API key

设置页里填你的 LLM 服务。推荐 **DeepSeek**(便宜、国内速度快):

| 字段 | 填什么 |
| --- | --- |
| `Base URL` | `https://api.deepseek.com` |
| `Model` | `deepseek-chat` |
| `API Key` | 在 [platform.deepseek.com](https://platform.deepseek.com) 注册后申请 |

> 其他服务(OpenAI / Moonshot / SiliconFlow 等)在设置页有**预设按钮**,点一下自动填好,只要补 key。

填完点 **「测试连接」**,看到绿色成功提示就行。**保存并关闭设置页。**

### ③ 开始用

把鼠标放到任意有英文的地方,按 **`Ctrl+J`**,屏幕变暗 → 框选英文区域 → 等 1-3 秒 → **译文窗口在你框选位置旁边弹出**。

## 主要功能

| | |
| --- | --- |
| 🔥 全局快捷键 | 默认 `Ctrl+J`,可在设置页改成任意组合 |
| 📸 自带 OCR | PaddleOCR(英 / 中,自带模型)+ Tesseract(日 / 韩,按需下载) |
| 🌍 多语言互译 | 简中 ↔ 繁中 ↔ 英 ↔ 日 ↔ 韩 |
| 🎨 4 种翻译风格 | 通用 / 学术 / 代码 / 口语,也支持完全自定义 system prompt |
| 🔌 OpenAI 兼容 | DeepSeek、Moonshot、SiliconFlow、OpenAI 等都能用 |
| 📜 翻译历史 | 本地保存最近 100 条,可搜索 / 复制 / 删除 |
| 🔒 BYOK + 本地优先 | API key 只存在本机,OCR 不联网,只有翻译时把识别到的文字发给**你自己**的 LLM |

## 常见问题

<details>
<summary><b>Q:Windows 装的时候弹「未识别的应用」/「Windows 已保护你的电脑」?</b></summary>

正常。我没买代码签名证书(便宜的 OV 证书也要 ¥1500/年起),所以 Windows SmartScreen 会警告。
点蓝字 **「更多信息」**,然后点 **「仍要运行」** 就行。
不放心可以从源码自己编译,见 [从源码构建](#从源码构建)。
</details>

<details>
<summary><b>Q:为什么要我填 API key?能不能直接用?</b></summary>

翻译质量好的 LLM 都是付费 API。如果我内置 key 帮所有人付钱,这工具就跑不起来(每次几分钱,人多了就破产)。

让你自己填 key 的好处:**便宜可控**(DeepSeek 一次翻译几乎 ≈ 0.001 元)、**没有额度限制**、**没人偷看你的数据**。
DeepSeek 注册送几块钱免费额度,够用一个月没问题。
</details>

<details>
<summary><b>Q:`Ctrl+J` 跟我的其他软件冲突了?</b></summary>

设置页里有「快捷键」一栏,点上去按任意你想用的组合就行(比如 `Ctrl+Shift+T`、`Alt+Space` 等),保存即生效。
</details>

<details>
<summary><b>Q:翻译效果不好 / 太呆板?</b></summary>

试试设置页里换 **prompt 预设**:
- **学术**:严谨、保留专业术语,适合论文
- **口语**:像说人话,适合聊天/字幕
- **代码**:对代码片段更友好

还不行就直接写自定义 system prompt,告诉模型「你要怎么翻」。
</details>

<details>
<summary><b>Q:OCR 识别错怎么办?</b></summary>

框选时尽量贴紧文字、别把背景图标也框进去。
中英文用自带的 PaddleOCR(精度不错),日韩用 Tesseract(首次会下载语言包)。
如果某段文字结构复杂(比如代码截图),可以截清楚一点再试。
</details>

## 隐私 / 数据

- **API key**:只存在你本机的 `%APPDATA%\kuangyi\config.json`,**不上传任何服务器**
- **翻译历史**:也只在本地,你可以随时在历史窗口里删
- **OCR**:全程本机进行(PaddleOCR / Tesseract),**不联网**
- **唯一会出公网的**:翻译时把识别到的文字发给你配置的 LLM(走的是 **你自己的** API key)

## 从源码构建

需要 Node.js 18+ 和 Windows 10/11(其他平台没测过):

```powershell
git clone https://github.com/Aphlim/screenshot-translator.git
cd screenshot-translator
npm install
npm run dev          # 开发模式(带热重载)
npm run dist:win     # 打 Windows 安装包到 release/
```

> 💡 如果 `npm run dist:win` 报 **「Cannot create symbolic link」**,去 Windows 设置 → 隐私和安全性 → 开发者选项 → 打开「**开发人员模式**」,然后重跑就好。

<details>
<summary><b>项目结构</b></summary>

```
src/
├── main/         Electron 主进程(系统能力)
│   ├── capture/  截屏 + 裁剪 + 图像预处理
│   ├── ocr/      OCR 引擎路由(paddle / tesseract)
│   ├── translate/ LLM 翻译 provider
│   ├── windows/  主进程管理的窗口(selector / popup / settings / history)
│   ├── config/   electron-store 持久化
│   └── ...
├── preload/      主-渲染进程之间的桥
├── renderer/     UI(React,4 个独立窗口入口)
└── shared/       共享类型 + IPC 通道
```
</details>

## 致谢

- [@gutenye/ocr-node](https://www.npmjs.com/package/@gutenye/ocr-node) — PaddleOCR 的 Node 封装
- [tesseract.js](https://github.com/naptha/tesseract.js) — 多语言 OCR 后备
- [electron-vite](https://electron-vite.org) — 现代 Electron + Vite 脚手架
- UI 设计灵感:Brutalist Swiss style,Gemini 协助起稿

## License

[MIT](LICENSE) © 2026 Aphlim
