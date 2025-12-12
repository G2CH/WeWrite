// Define content generation stages
export enum AppStep {
  TOPIC_SEARCH = 0,
  TOPIC_SELECTION = 1,
  GENERATING_CONTENT = 2, // Internal state, usually covered by loading
  REVIEW_AND_EXPORT = 3
}

export interface NewsSource {
  title: string;
  uri: string;
}

export interface Topic {
  id: number;
  title: string;
  description: string;
}

export interface SearchResult {
  rawSummary: string;
  topics: Topic[];
  sources: NewsSource[];
}

// Intermediate output from the Editor Agent
export interface ArticlePlan {
  angle: string; // The angle/perspective of the article
  tone: string; // The emotional tone
  outline: string[]; // List of section headers or key points
  targetAudience: string;
}

export interface GeneratedArticle {
  id: string;
  createdAt: number;
  title: string;
  summary: string;
  content: string; // Markdown or HTML string
  imageSearchQuery?: string;
  imageUrl?: string;
  originalTopic?: string;
  // Metadata about the agents
  agentLog?: {
    angle: string;
    tone: string;
  }
}

export enum TopicCategory {
  TECH = "科技与AI",
  FINANCE = "金融与市场",
  LIFESTYLE = "生活与健康",
  ENTERTAINMENT = "娱乐八卦",
  GENERAL = "综合热点"
}