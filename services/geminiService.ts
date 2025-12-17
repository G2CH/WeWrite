import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedArticle, SearchResult, NewsSource, Topic, ArticlePlan, AISettings, AIProvider } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: Retry Logic for 429 Errors ---
const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // Check for 429 (Resource Exhausted) or 503 (Service Unavailable)
    if (retries > 0 && (error?.status === 429 || error?.code === 429 || error?.message?.includes('429') || error?.status === 503)) {
      console.warn(`API Rate Limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Exponential backoff: 2s -> 4s -> 8s
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// --- WeChat Compliance Rules (Updated for stricter audit) ---
const WECHAT_COMPLIANCE_PROMPT = `
【重要：微信公众号推荐规范 - 绝对红线】
你必须严格遵守《微信公众号推荐运营规范》，为了确保文章能被系统“助推”，必须避免被判定为“低质营销号”或“标题党”。

1. **拒绝“震惊体”与“夸张标题”**：
   - 严禁使用“吓人”、“惊了”、“出大事了”、“该死的”、“哭了”等过度情绪化的词汇作为标题。
   - 标题必须客观反映内容，不能断章取义。
   - 错误示例：“成龙都70岁了还在过家家，我那该死的焦虑治愈了” (判定为营销号标题)
   - 正确示例：“70岁成龙的片场日常：为何我们依然需要这种‘笨拙’的敬业精神？” (有深度，有观点)

2. **拒绝“情绪宣泄”与“废话堆砌”**：
   - 文章必须有**信息增量**（Fact/Insight）。不要只发泄情绪，要提供价值。
   - 严禁车轱辘话来回说。逻辑要严密。

3. **价值观导向**：
   - 严禁制造年龄焦虑、性别对立或阶级矛盾来博取流量。
   - 保持客观、理性、温暖的基调。
`;

// --- Anti-AI / Humanization Rules ---
const ANTI_AI_DETECTION_PROMPT = `
【核心指令：去 AI 化写作】
1. **拒绝 AI 腔**：严禁使用“总而言之”、“综上所述”、“值得注意的是”、“不仅...而且”。
2. **语言风格**：
   - 使用短句，节奏感要强。
   - 像一个**有见地的行业观察者**在分析问题，而不是像一个情绪化的路人在发牢骚。
3. **结构要求**：
   - 多用数据、案例支撑观点，而不仅是形容词。
   - 观点要犀利但逻辑自洽。
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

  let endpoint = settings.customBaseUrl.trim();
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = endpoint.replace(/\/+$/, "");
    endpoint = `${endpoint}/chat/completions`;
  }

  return retryWithBackoff(async () => {
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
        response_format: jsonMode ? { type: "json_object" } : undefined 
      })
    });

    if (!response.ok) {
      const err = await response.text();
      // Throw object with status for retry logic
      throw { status: response.status, message: err }; 
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  });
};

/**
 * Step 1: Search for trending topics using Google Search Grounding.
 */
export const searchTrendingTopics = async (category: string): Promise<SearchResult> => {
  const searchModel = "gemini-2.5-flash";
  const searchPrompt = `
    请全网扫描关于“${category}”的最新热门内容。
    【重点搜索来源】今日头条、腾讯新闻、36Kr、虎嗅、百度热搜。
    请找出 10 个具有**深度讨论价值**的话题。不要找那种纯粹的娱乐八卦或低俗新闻。
  `;

  let rawSummary = "";
  let sources: NewsSource[] = [];

  try {
    const searchResponse = await retryWithBackoff(() => ai.models.generateContent({
      model: searchModel,
      contents: searchPrompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3, 
      },
    }));

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
    throw new Error("搜索话题失败，请检查 API 配额或网络。");
  }

  try {
    const parsePrompt = `
      你是一个新闻编辑助理。请根据搜索摘要，提取 10 个高质量的新闻话题。
      摘要：${rawSummary}
      要求：返回 JSON 数组，每项包含 id, title, description。
    `;

    const parseResponse = await retryWithBackoff(() => ai.models.generateContent({
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
    }));

    const topics = JSON.parse(parseResponse.text || "[]") as Topic[];
    return { rawSummary, sources, topics };

  } catch (error) {
    console.error("Topic parsing failed:", error);
    return { rawSummary, sources, topics: [] };
  }
};

/**
 * Agent 1: Chief Editor
 */
export const runEditorAgent = async (
  topicTitle: string, 
  topicDescription: string, 
  userInstructions: string,
  style: string,
  settings?: AISettings
): Promise<ArticlePlan> => {
  const systemPrompt = `你是一个【微信公众号资深主编】。你极其重视“内容合规性”和“信息深度”。
  全局设定：${settings?.globalRules || "无"}
  ${WECHAT_COMPLIANCE_PROMPT}`;
  
  const prompt = `
    热点：${topicTitle}
    背景：${topicDescription}
    风格：${style}
    指令：${userInstructions || "无"}

    请策划一篇**能通过微信严格审核**且有传播力的文章。
    1. 切入点：要有深度，避免流于表面或情绪发泄。
    2. 基调：${style}（但必须保持理性底色）。
    3. 目标受众：有思考能力的读者。
    4. 大纲：逻辑清晰，层层递进。
    
    以 JSON 返回。
  `;

  try {
    let responseText = "";

    if (settings?.provider === AIProvider.CUSTOM) {
      responseText = await callCustomAI(prompt, systemPrompt, settings, true);
    } else {
      const response = await retryWithBackoff(() => ai.models.generateContent({
        model: "gemini-2.5-flash", // Use Flash for logic to save Pro quota, usually sufficient for outline
        contents: `${systemPrompt}\n${prompt}`,
        config: {
          temperature: settings?.creativity ?? 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              angle: { type: Type.STRING },
              tone: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              outline: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }
              }
            },
            required: ["angle", "tone", "outline"]
          }
        }
      }));
      responseText = response.text || "{}";
    }
    
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(responseText) as ArticlePlan;
  } catch (e) {
    console.error("Editor Agent failed", e);
    throw new Error("主编策划失败: " + (e as Error).message);
  }
};

/**
 * Agent 2: Senior Writer
 */
export const runWriterAgent = async (
  topicTitle: string,
  topicDescription: string,
  plan: ArticlePlan,
  settings?: AISettings
): Promise<{ title: string; summary: string; content: string }> => {
  const systemPrompt = `你是一个【资深专栏作家】。你的文字有质感、有逻辑、有温度，拒绝廉价的情绪煽动。
  全局设定：${settings?.globalRules || "无"}
  ${WECHAT_COMPLIANCE_PROMPT}
  ${ANTI_AI_DETECTION_PROMPT}`;
  
  const prompt = `
    话题：${topicTitle}
    策划案：${JSON.stringify(plan)}

    请撰写正文。
    【关键要求】
    1. **标题**：必须**稳重且吸引人**。
       - 🚫 拒绝：震惊！XXX竟然...（营销号）
       - ✅ 提倡：从XXX看XXX：为什么我们需要...（深度文）
    2. **正文**：
       - 每一段都要有实质内容。
       - 使用 Markdown 排版（**加粗关键句**，> 引用金句，列表整理要点）。
       - 避免使用任何可能导致审核不通过的敏感词或极端言论。
    3. **摘要**：客观概括文章核心价值。

    以 JSON 返回。
  `;

  try {
    let responseText = "";

    if (settings?.provider === AIProvider.CUSTOM) {
      responseText = await callCustomAI(prompt, systemPrompt, settings, true);
    } else {
      const response = await retryWithBackoff(() => ai.models.generateContent({
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
              content: { type: Type.STRING }
            },
            required: ["title", "summary", "content"]
          }
        }
      }));
      responseText = response.text || "{}";
    }

    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(responseText);

  } catch (e) {
    console.error("Writer Agent failed", e);
    throw new Error("撰稿失败: " + (e as Error).message);
  }
};

/**
 * Agent 3: Visual Director
 */
export const runVisualAgent = async (
  title: string,
  content: string,
  settings?: AISettings
): Promise<{ imageSearchQuery: string }> => {
  const systemPrompt = "你是一个【视觉艺术总监】。";
  const prompt = `文章：${title}。请提供一个最佳的英文图片搜索关键词（Image Query），用于寻找封面图。返回 JSON: { "imageSearchQuery": "..." }`;

  try {
    let responseText = "";
    if (settings?.provider === AIProvider.CUSTOM) {
       responseText = await callCustomAI(prompt, systemPrompt, settings, true);
    } else {
       const response = await retryWithBackoff(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${systemPrompt}\n${prompt}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { imageSearchQuery: { type: Type.STRING } },
            required: ["imageSearchQuery"]
          }
        }
      }));
      responseText = response.text || "{}";
    }
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(responseText);
  } catch (e) {
    return { imageSearchQuery: title };
  }
};

// ... existing image search functions (getRobustFallbackImages, searchRelatedImage, searchImageOptions) ...
const getRobustFallbackImages = (query: string, exclude: string = ""): string[] => {
  const baseQuery = exclude ? `${query} -${exclude}` : query;
  const q = encodeURIComponent(baseQuery);
  return [
    `https://tse1.mm.bing.net/th?q=${q}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse2.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " photography")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse3.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " illustration")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse4.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " wallpaper")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse1.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " abstract")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse2.mm.bing.net/th?q=${encodeURIComponent(baseQuery + " concept art")}&w=800&h=450&c=7&rs=1&p=0`,
  ];
};

export const searchRelatedImage = async (query: string, exclude: string = ""): Promise<string> => {
  const candidates = await searchImageOptions(query, exclude);
  return candidates[0] || getRobustFallbackImages(query, exclude)[0];
};

export const searchImageOptions = async (query: string, exclude: string = ""): Promise<string[]> => {
  const directMatches = getRobustFallbackImages(query, exclude);
  const model = "gemini-2.5-flash";
  const prompt = `Give me 3 distinct keywords related to: "${query}". Return JSON list string.`;

  try {
     const response = await retryWithBackoff(() => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
           responseMimeType: "application/json",
           responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
           }
        }
     }));

     const keywords = JSON.parse(response.text || "[]") as string[];
     const extendedUrls = keywords.flatMap(k => getRobustFallbackImages(k, exclude));
     return Array.from(new Set([...directMatches, ...extendedUrls])).slice(0, 10);

  } catch (e) {
     return directMatches;
  }
};
