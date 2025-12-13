import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedArticle, SearchResult, NewsSource, Topic, ArticlePlan } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Step 1: Search for trending topics using Google Search Grounding.
 */
export const searchTrendingTopics = async (category: string): Promise<SearchResult> => {
  const searchModel = "gemini-2.5-flash";
  const searchPrompt = `
    查找今天关于“${category}”的 10 个最重要和热门的新闻故事。
    请详细列出这些新闻，确保覆盖面广，包含具体事件。
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
  style: string
): Promise<ArticlePlan> => {
  const model = "gemini-2.5-flash"; // Flash is fast and good enough for planning

  const prompt = `
    你是一个拥有20年经验的【微信公众号首席主编】。
    
    当前热点话题：${topicTitle}
    背景信息：${topicDescription}
    【重要】指定文章风格：${style}
    用户特别指令：${userInstructions || "无"}

    任务：请策划一篇能产生“爆款”潜质的文章结构。
    
    请思考：
    1. 寻找一个独特的切入点（Angle），必须严格符合“${style}”的风格设定。
    2. 确定文章的情感基调（Tone），例如：${style}。
    3. 制定目标受众（Target Audience）。
    4. 列出文章大纲（Outline），包含 4-6 个小标题。

    请以 JSON 格式返回。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
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
    
    return JSON.parse(response.text || "{}") as ArticlePlan;
  } catch (e) {
    console.error("Editor Agent failed", e);
    throw new Error("主编策划失败");
  }
};

/**
 * Agent 2: Senior Writer (资深笔杆子)
 * Responsibilities: Write the full content based on the Editor's plan.
 */
export const runWriterAgent = async (
  topicTitle: string,
  topicDescription: string,
  plan: ArticlePlan
): Promise<{ title: string; summary: string; content: string }> => {
  // Use Pro model for high-quality writing
  const model = "gemini-3-pro-preview"; 

  const prompt = `
    你是一个【资深新媒体撰稿人】。请根据主编的策划案，撰写一篇完整的公众号文章。

    话题：${topicTitle}
    
    【主编策划案】
    - 切入角度：${plan.angle}
    - 情感基调：${plan.tone}
    - 目标读者：${plan.targetAudience}
    - 文章大纲：${plan.outline.join(' -> ')}

    【写作要求】
    1. 标题（Title）：必须极具吸引力，甚至可以适当使用“震惊体”或“悬念体”，但不能虚假。
    2. 摘要（Digest）：120字以内，作为封面卡片摘要。
    3. 正文（Content）：
       - 使用 Markdown 格式。
       - 严格按照大纲结构展开。
       - 适当使用 Emoji 和加粗来优化阅读体验。
       - 每一段不要太长，适合手机阅读。
       - 必须包含金句。
       - 结尾要有互动引导。

    请以 JSON 格式返回。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
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

    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Writer Agent failed", e);
    throw new Error("撰稿失败");
  }
};

/**
 * Agent 3: Visual Director (视觉总监)
 * Responsibilities: Analyze the written article and decide on the best image search query.
 */
export const runVisualAgent = async (
  title: string,
  content: string
): Promise<{ imageSearchQuery: string }> => {
  const model = "gemini-2.5-flash"; // Fast model

  const prompt = `
    你是一个【视觉艺术总监】。请阅读这篇刚刚写好的文章，为它挑选一张最合适的封面图。

    文章标题：${title}
    文章片段：${content.substring(0, 500)}...

    任务：
    请提取一个最适合在搜索引擎中查找图片的关键词（Query）。
    - 关键词可以是中文或英文（英文通常搜索结果质量更高）。
    - 不要只用标题，要提取核心视觉元素。
    - 例如文章是关于“AI取代程序员”，关键词不仅是“AI”，而应该是“Robot coding futuristic cyberpunk style”或“程序员 焦虑 办公室”。
    
    请以 JSON 格式返回。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
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

    return JSON.parse(response.text || "{}");
  } catch (e) {
    // Fallback to title if agent fails
    return { imageSearchQuery: title };
  }
};

/**
 * Helper to generate a robust list of fallback image URLs.
 * Using multiple query variations ensures we get different images even from the same proxy.
 */
const getRobustFallbackImages = (query: string): string[] => {
  const q = encodeURIComponent(query);
  return [
    `https://tse1.mm.bing.net/th?q=${q}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse2.mm.bing.net/th?q=${encodeURIComponent(query + " photography")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse3.mm.bing.net/th?q=${encodeURIComponent(query + " illustration")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse4.mm.bing.net/th?q=${encodeURIComponent(query + " wallpaper")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse1.mm.bing.net/th?q=${encodeURIComponent(query + " abstract")}&w=800&h=450&c=7&rs=1&p=0`,
    `https://tse2.mm.bing.net/th?q=${encodeURIComponent(query + " concept art")}&w=800&h=450&c=7&rs=1&p=0`,
  ];
};

/**
 * Tool: Search for the image using the query provided by Visual Agent.
 */
export const searchRelatedImage = async (query: string): Promise<string> => {
  const candidates = await searchImageOptions(query);
  return candidates[0] || getRobustFallbackImages(query)[0];
};

/**
 * Enhanced Tool: Search for multiple image options.
 * Uses AI to expand keywords, then generates reliable search proxies.
 */
export const searchImageOptions = async (query: string): Promise<string[]> => {
  // 1. Direct matches (Fastest)
  const directMatches = getRobustFallbackImages(query);
  
  // 2. AI Keyword Expansion for Variety
  const model = "gemini-2.5-flash";
  const prompt = `
    Give me 3 distinct, visually descriptive short keywords related to: "${query}".
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
    
    // Generate urls for related keywords
    const relatedImages = keywords.flatMap(k => getRobustFallbackImages(k).slice(0, 2));
    
    // Combine unique URLs
    const all = [...directMatches, ...relatedImages];
    return Array.from(new Set(all));
    
  } catch (e) {
    console.warn("Image search keyword expansion failed, falling back to direct matches", e);
    return directMatches;
  }
};