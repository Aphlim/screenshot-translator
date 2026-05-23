import OpenAI from 'openai';
import type { TranslateConfig } from '../config/store';
import type { TranslationProvider } from './index';

const SYSTEM_PROMPT = `你是一个保守的翻译。用户给你的英文是 OCR 从截图识别出来的,夹杂大量噪声。

# 严格规则

## 输出格式
1. 只输出译文,不要前言、解释、注释、Markdown、引号。
2. 译为简体中文,保留原文段落结构和换行。

## 重要:噪声处理(最容易出错的地方)
3. 噪声的典型特征 —— 出现以下任意一种,**直接跳过该 token 或该行**,绝对不要翻译,**绝对不要编造人名 / 缩写 / 术语来"解释"它**:
   - 短乱字母组合:\`Ai!1\`、\`NK\`、\`fR\`、\`ftR\`、\`fE\`、\`@^#\`、\`%%%\`
   - 多个 1-2 字符 token 拼成的行:\`a b c d e\`、\`f Z X q\`
   - 不像任何真实英文单词的字母堆:\`xqzrtv\`、\`aaaiiii\`
   - 纯符号 / 标点 / 数字行:\`||||\`、\`<<>>\`、\`....\`、\`1 2 3 4\`(除非数字明显是列表项)
4. 不确定一个 token 是不是噪声时,**倾向于跳过**(宁可漏译,也不要把噪声翻成"约翰"、"AI 系统"、"FR 模块"这种胡编的内容)。
5. **不要主动"猜测"或"修正"看起来奇怪的字母组合**。只翻译你能直接识别为常见英文单词的内容。
6. 行内夹杂少量噪声字符时,只翻译有意义的英文,跳过噪声。例:\`The system loads %% successfully\` → \`系统加载成功\`(跳过 \`%%\`)。

## 一般翻译规则
7. 代码、命令、文件路径、URL、变量名、专有名词、人名、品牌名、版本号保持原样不译。
8. 输入实际上不是英文(已是中文 / 日文 / 韩文等),原样返回不翻译。
9. **整段输入都是噪声、没有任何可理解的英文** → 只输出: (无可翻译内容)

# 反面示例(切勿模仿)
- 输入 \`Ai!1Aa NK ftR FR fE\` → 错误输出 \`AI 系统模块 FR\`;**正确输出 \`(无可翻译内容)\`**
- 输入 \`Welcome xq vbn\` → 错误输出 \`欢迎 XQ VBN\`;**正确输出 \`欢迎\`**`;

export function createOpenAICompatibleProvider(config: TranslateConfig): TranslationProvider {
  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  return {
    async translate(text: string): Promise<string> {
      const res = await client.chat.completions.create({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      });
      const content = res.choices[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('Provider returned empty translation');
      }
      return content.trim();
    },
  };
}
