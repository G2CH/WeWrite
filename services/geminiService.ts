import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedArticle, SearchResult, NewsSource, Topic, ArticlePlan, AISettings, AIProvider } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- WeChat Compliance Rules ---
const WECHAT_COMPLIANCE_PROMPT = `
【重要：微信公众号合规性红线】
你必须严格遵守《微信公众号和服务号推荐运营规范》，触犯以下规则的内容将被视为违规：
1. **真实性原则**：严禁捏造或歪曲事实。禁止传播未经证实的传言、伪科学（如无依据的养生偏方、食物相克）或过时信息。
2. **拒绝标题党**：标题必须准确反映内容。严禁使用夸大严重程度（如“震惊”、“吓人”）、断章取义、无中生有或故意隐藏关键信息的标题诱导点击。
3. **内容健康**：严禁色情低俗（含擦边球暗示）、暴力恐怖、引发生理不适（如密集恐惧、血腥）的内容。
4. **价值观导向**：严禁宣扬拜金主义、性别对立、煽动极端情绪或网络暴力。
5. **高质量原创**：拒绝简单的洗稿、拼凑、重复堆砌。内容应提供信息增量、深度观点或审美价值。
6. **营销规范**：严禁生成纯广告营销内容，严禁诱导关注或诱导分享。
`;

// --- Anti-AI / Humanization Rules ---
const ANTI_AI_DETECTION_PROMPT = `
【核心指令：去 AI 化/拟人化写作】
为了降低“AI 特征占比”，必须彻底模拟人类专家写作，具体要求：
1. **彻底摒弃 AI 惯用语**：
   - **严禁使用**：“总而言之”、“综上所述”、“值得注意的是”、“一方面...另一方面”、“不仅...而且”、“让我们拭目以待”。
   - **严禁使用**：教科书式的平铺直叙、没有任何感情色彩的说明文语调。
2. **增加文本的“爆发度”（Burstiness）**：
   - **长短句交替**：不要让每句话长度都差不多。要有极短的句子（如“这就离谱。”）和结构复杂的长句交替出现，形成呼吸感。
   - **情绪波动**：文章要有情绪起伏，不要全程平淡。
3. **增加“困惑度”（Perplexity）**：
   - 使用非常规的形容词、地道的俚语、成语或巧妙的比喻。
   - 观点要犀利独特，不要总是四平八稳的“既要又要”。
4. **沉浸式叙述（对话感）**：
   - 像在和朋友在咖啡馆聊天，而不是在写报告。
   - 多用“我觉得”、“大家有没有发现”、“试想一下”等第一/第二人称视角。
5. **展现“不完美”的真实**：
   - AI 通常逻辑太完美。人类写作会有跳跃，会有强烈的主观偏见，会有感叹。请展示这种“人味”。
`;

/**
 * Helper: Call Custom OpenAI-compatible API
 */
const callCustomAI = async (
  prompt: string,
  systemInstruction: string,
  settings: AISettings,
  jsonMode: boolean = false
): Promise<string> => {
  if (!settings.customBaseUrl || !settings.customApiKey) {
    throw new Error("请在设置中配置自定义 AI 的 Base URL 和 API Key");
  }

  // Ensure Base URL ends correctly for chat completions if user didn't provide full path
  let endpoint = settings.customBaseUrl.trim();
  if (!endpoint.endsWith('/chat/completions')) {
    // Basic normalization: remove trailing slash, ensure v1 if needed, append chat/completions
    // Assumption: User provides base like "https://api.deepseek.com" or "https://api.deepseek.com/v1"
    endpoint = endpoint.replace(/\/+$/, "");
    endpoint = `${endpoint}/chat/completions`;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.customApiKey}`
      },
      body: JSON.stringify({
        model: settings.customModel || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: settings.creativity,
        // Only enable json_object if supported by the provider, but many compatible APIs crash with it if not strictly supported.
        // We rely on the prompt asking for JSON.
        response_format: jsonMode ? { type: "json_object" } : undefined 
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Custom AI Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
    console.error("Custom AI Call Failed:", error);
    // Fallback or re-throw? Re-throw to let UI handle it.
    throw new Error(error.message || "Custom AI calling failed");
  }
};

/**
 * Step 1: Search for trending topics using Google Search Grounding.
 * NOTE: This ALWAYS uses Gemini because of the Google Search tool capability.
 */
export const searchTrendingTopics = async (category: string): Promise<SearchResult> => {
  const searchModel = "gemini-2.5-flash";
  const searchPrompt = `
    请全网扫描关于“${category}”的最新热门内容。
    
    【重点搜索来源】
    1. **今日头条 (Toutiao)**：请特别关注今日头条的热榜、推荐频道或高热度文章。
    2. **微博热搜 & 百度风云榜**：辅助确认话题的全网讨论度。
    3. 主流新闻门户（如腾讯新闻、澎湃新闻等）。

    请找出当前在这些平台（尤其是今日头条）上讨论度最高、最火的 10 个话题或事件。
    如果是特定领域（如“${category}”），请专注于该领域的深度内容或最新进展。
    请详细列出这些内容，确保具有时效性和讨论价值。
  `;

  let rawSummary = "";
  let sources: NewsSource[] = [];

  try {
    const searchResponse = await ai.models.generateContent({
      model: searchModel,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3, 
      },
    });

    rawSummary = searchResponse.text || "未找到相关结果。";
    
    const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    chunks.forEach((chunk) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "来源",
          uri: chunk.web.uri || "#"
        });
      }
    });

  } catch (error) {
    console.error("Search failed:", error);
    throw new Error("搜索话题失败，请检查您的 API Key。");
  }

  try {
    const parsePrompt = `
      你是一个新闻编辑助理。请根据以下的新闻搜索摘要，提取出 10 个独立的、有价值的新闻话题。
      
      搜索摘要内容：
      ${rawSummary}

      要求：
      1. 返回一个 JSON 数组。
      2. 每个元素包含：
         - id (数字)
         - title (简练的中文标题)
         - description (50字以内的中文简介)
      3. 必须刚好提取 10 个。
    `;

    const parseResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: parsePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["id", "title", "description"]
          }
        }
      }
    });

    const topics = JSON.parse(parseResponse.text || "[]") as Topic[];

    return { rawSummary, sources, topics };

  } catch (error) {
    console.error("Topic parsing failed:", error);
    return { rawSummary, sources, topics: [] };
  }
};

/**
 * Agent 1: Chief Editor (主编)
 * Responsibilities: Analyze topic, determine angle/tone, create outline.
 */
export const runEditorAgent = async (
  topicTitle: string, 
  topicDescription: string, 
  userInstructions: string,
  style: string,
  settings?: AISettings
): Promise<ArticlePlan> => {
  const systemPrompt = `你是一个拥有20年经验的【微信公众号首席主编】。你对内容的嗅觉极其敏锐，极其讨厌平庸和套路。
  全局设定：${settings?.globalRules || "无"}
  ${WECHAT_COMPLIANCE_PROMPT}`;
  
  const prompt = `
    当前热点话题：${topicTitle}
    背景信息：${topicDescription}
    【重要】指定文章风格：${style}
    用户特别指令：${userInstructions || "无"}

    任务：请策划一篇高质量、**具有强烈人类作者个人风格**的公众号文章结构。
    
    请思考：
    1. 寻找一个独特的切入点（Angle）：**拒绝四平八稳的“大路货”观点**。要找痛点、爽点或痒点。严格符合“${style}”风格，且必须符合合规性要求。
    2. 确定文章的情感基调（Tone）：情绪要饱满，拒绝机械冷漠。
    3. 制定目标受众（Target Audience）。
    4. 列出文章大纲（Outline），包含 4-6 个小标题。小标题要吸引人，不要像论文目录。

    请以 JSON 格式返回 (不要包含 Markdown 代码块标记，只返回纯 JSON)。
  `;

  try {
    let responseText = "";

    if (settings?.provider === AIProvider.CUSTOM) {
      responseText = await callCustomAI(prompt, systemPrompt, settings, true);
    } else {
      // Default Google
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${systemPrompt}\n${prompt}`,
        config: {
          temperature: settings?.creativity ?? 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              angle: { type: Type.STRING, description: "文章切入点" },
              tone: { type: Type.STRING, description: "情感基调" },
              targetAudience: { type: Type.STRING, description: "目标读者画像" },
              outline: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "文章大纲小标题列表" 
              }
            },
            required: ["angle", "tone", "outline"]
          }
        }
      });
      responseText = response.text || "{}";
    }
    
    // Clean up potential markdown code blocks if custom provider returns them
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(responseText) as ArticlePlan;
  } catch (e) {
    console.error("Editor Agent failed", e);
    throw new Error("主编策划失败: " + (e as Error).message);
  }
};

/**
 * Agent 2: Senior Writer (资深笔杆子)
 * Responsibilities: Write the full content based on the Editor's plan.
 */
export const runWriterAgent = async (
  topicTitle: string,
  topicDescription: string,
  plan: ArticlePlan,
  settings?: AISettings
): Promise<{ title: string; summary: string; content: string }> => {
  const systemPrompt = `你是一个【资深新媒体撰稿人】（人类）。你痛恨“AI味”，你的文字充满烟火气、情绪张力和个人偏见（在合规范围内）。
  全局设定：${settings?.globalRules || "无"}
  ${WECHAT_COMPLIANCE_PROMPT}
  ${ANTI_AI_DETECTION_PROMPT}`;
  
  const prompt = `
    请根据主编的策划案，撰写一篇 **完全看不出是 AI 写** 的公众号文章。

    话题：${topicTitle}
    
    【主编策划案】
    - 切入角度：${plan.angle}
    - 情感基调：${plan.tone}
    - 目标读者：${plan.targetAudience}
    - 文章大纲：${plan.outline.join(' -> ')}

    【写作要求】
    1. 标题（Title）：**极具吸引力，准确反映内容，拒绝震惊体，拒绝AI生成感的标题。**
    2. 摘要（Digest）：120字以内，像朋友推荐一样介绍这篇文章。
    3. 正文（Content）：
       - **拟人化程度 MAX**：想象你正在给闺蜜或兄弟讲这个事。用词要辣，节奏要快。
       - **拒绝逻辑连接词**：把“首先/其次/最后”全部删掉，用逻辑本身的流转来推进。
       - **情绪穿透力**：如果是“犀利痛快”风，就要骂得痛快；如果是“温情走心”，就要暖到流泪。
       - **口语化**：多用短句。多用反问。多用“我”。
       - **开篇即炸场**：不要写废话背景介绍，直接抛出冲突、悬念或金句。
       - **结构化但自然**：使用 Markdown，但不要让结构显得僵硬。
       - **结尾互动**：不要生硬地“欢迎留言”，而是用一个发人深省的问题引发讨论。

    请以 JSON 格式返回 (不要包含 Markdown 代码块标记，只返回纯 JSON)。
  `;

  try {
    let responseText = "";

    if (settings?.provider === AIProvider.CUSTOM) {
      responseText = await callCustomAI(prompt, systemPrompt, settings, true);
    } else {
      // Default Google
      const response = await ai.models.generateContent({
        model: settings?.writerModel || "gemini-3-pro-preview",
        contents: `${systemPrompt}\n${prompt}`,
        config: {
          temperature: settings?.creativity ?? 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              content: { type: Type.STRING, description: "Markdown content" }
            },
            required: ["title", "summary", "content"]
          }
        }
      });
      responseText = response.text || "{}";
    }

    // Clean up potential markdown code blocks
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(responseText);

  } catch (e) {
    console.error("Writer Agent failed", e);
    throw new Error("撰稿失败: " + (e as Error).message);
  }
};

/**
 * Agent 3: Visual Director (视觉总监)
 * Responsibilities: Analyze the written article and decide on the best image search query.
 */
export const runVisualAgent = async (
  title: string,
  content: string,
  settings?: AISettings
): Promise<{ imageSearchQuery: string }> => {
  const systemPrompt = "你是一个【视觉艺术总监】。";
  const prompt = `
    请阅读这篇刚刚写好的文章，为它挑选一张最合适的封面图。

    文章标题：${title}
    文章片段：${content.substring(0, 500)}...

    任务：
    请提取一个最适合在搜索引擎中查找图片的关键词（Query）。
    - 关键词可以是中文或英文（英文通常搜索结果质量更高）。
    - 不要只用标题，要提取核心视觉元素。
    - 例如文章是关于“AI取代程序员”，关键词不仅是“AI”，而应该是“Robot coding futuristic cyberpunk style”或“程序员 焦虑 办公室”。
    
    请以 JSON 格式返回 (不要包含 Markdown 代码块标记，只返回纯 JSON)。
  `;

  try {
    let responseText = "";
    
    // Visual agent is simple, we can use custom AI if selected, but Gemini Flash is free and fast. 
    // We'll respect the provider setting anyway.
    if (settings?.provider === AIProvider.CUSTOM) {
       responseText = await callCustomAI(prompt, systemPrompt, settings, true);
    } else {
       const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${systemPrompt}\n${prompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              imageSearchQuery: { type: Type.STRING }
            },
            required: ["imageSearchQuery"]
          }
        }
      });
      responseText = response.text || "{}";
    }
    
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(responseText);
  } catch (e) {
    // Fallback to title if agent fails
    return { imageSearchQuery: title };
  }
};

/**
 * Helper to generate a robust list of fallback image URLs.
 * Using multiple query variations ensures we get different images even from the same proxy.
 * Supports exclusions via "-" operator.
 */
const getRobustFallbackImages = (query: string, exclude: string = ""): string[] => {
  // Construct a base query string that includes the exclusion logic
  const baseQuery = exclude ? `${query} -${exclude}` : query;
  
  // Important: We encode the full query string (including space and minus)
  const q = encodeURIComponent(baseQuery);
  
  return [
    `https://tse1.mm.bing.net/th?q=${q}&w=800&h=450&c=7&rs=1&p=0`,
    // Variations: append suffix to the query. 
    // Example: query="cat -dog", suffix="photography" -> "cat -dog photography"
    // This typically works in search engines as (cat) AND (NOT dog) AND (photography)
    `https://tse2.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " photography")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse3.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " illustration")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse4.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " wallpaper")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse1.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " abstract")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse2.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " concept art")}&w=800&h=450&c=7&rs=1&p=0`,
  ];
};

/**
 * Tool: Search for the image using the query provided by Visual Agent.
 */
export const searchRelatedImage = async (query: string, exclude: string = ""): Promise<string> => {
  const candidates = await searchImageOptions(query, exclude);
  return candidates[0] || getRobustFallbackImages(query, exclude)[0];
};

/**
 * Enhanced Tool: Search for multiple image options.
 * Uses AI to expand keywords, then generates reliable search proxies.
 */
export const searchImageOptions = async (query: string, exclude: string = ""): Promise<string[]> => {
  // 1. Direct matches (Fastest)
  const directMatches = getRobustFallbackImages(query, exclude);
  
  // 2. AI Keyword Expansion for Variety (Uses default Gemini Flash for speed/cost, regardless of provider setting, as it's a small utility task)
  const model = "gemini-2.5-flash";
  const prompt = `
    Give me 3 distinct, visually descriptive short keywords related to: "${query}".
    ${exclude ? `Avoid concepts related to: "${exclude}".` : ""}
    Example: for "AI", give ["Futuristic Robot", "Neural Network Glowing", "Cyberpunk City"].
    Return ONLY a JSON array of strings.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      }
    });

    const keywords = JSON.parse(response.text || "[]") as string[];
    
    // Generate urls for related keywords, applying the exclusion to them as well
    const relatedImages = keywords.flatMap(k => getRobustFallbackImages(k, exclude).slice(0, 2));
    
    // Combine unique URLs
    const all = [...directMatches, ...relatedImages];
    return Array.from(new Set(all));
    
  } catch (e) {
    console.warn("Image search keyword expansion failed, falling back to direct matches", e);
    return directMatches;
  }
};