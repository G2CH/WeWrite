import React, { useState, useEffect } from 'react';
import { AppStep, TopicCategory, SearchResult, GeneratedArticle, ArticleStyle, AISettings, AIProvider } from './types';
import * as GeminiService from './services/geminiService';
import { LoadingOverlay } from './components/LoadingOverlay';

// Import New Modular Components
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { StepTopicSearch } from './components/StepTopicSearch';
import { StepTopicSelection } from './components/StepTopicSelection';
import { StepEditor } from './components/StepEditor';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.TOPIC_SEARCH);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  
  // Data State
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory>(TopicCategory.TECH);
  const [customTopic, setCustomTopic] = useState<string>(""); 
  const [activeCategory, setActiveCategory] = useState<string>(""); 
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  
  // Selection State (Multi-select)
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<ArticleStyle>(ArticleStyle.PROFESSIONAL);
  
  const [customInstructions, setCustomInstructions] = useState<string>("");
  
  // History / Articles State
  const [history, setHistory] = useState<GeneratedArticle[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [viewingArticleId, setViewingArticleId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<number>(0);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: AIProvider.GOOGLE,
    writerModel: "gemini-3-pro-preview",
    customBaseUrl: "https://api.deepseek.com/v1",
    customApiKey: "",
    customModel: "deepseek-chat",
    creativity: 0.7,
    globalRules: ""
  });

  // Derived state for current viewing article
  const currentArticle = history.find(a => a.id === viewingArticleId) || null;

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('wechat_writer_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    const savedSettings = localStorage.getItem('wechat_writer_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setAiSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('wechat_writer_history', JSON.stringify(history));
    }
  }, [history]);

  useEffect(() => {
    localStorage.setItem('wechat_writer_settings', JSON.stringify(aiSettings));
  }, [aiSettings]);

  // Handlers
  const handleSearch = async () => {
    const query = customTopic.trim() ? customTopic.trim() : selectedCategory;
    setActiveCategory(query);

    setLoading(true);
    setLoadingMessage(`正在全网（含今日头条）扫描 “${query}” 的 10 个热门话题...`);
    try {
      const result = await GeminiService.searchTrendingTopics(query);
      setSearchResult(result);
      setSelectedTopicIds([]); 
      setCurrentStep(AppStep.TOPIC_SELECTION);
    } catch (e) {
      alert("获取话题失败。请检查控制台或 API Key。");
    } finally {
      setLoading(false);
    }
  };

  const toggleTopicSelection = (id: number) => {
    setSelectedTopicIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!searchResult) return;
    if (selectedTopicIds.length === searchResult.topics.length) {
      setSelectedTopicIds([]);
    } else {
      setSelectedTopicIds(searchResult.topics.map(t => t.id));
    }
  };

  const handleBatchGenerate = async () => {
    if (selectedTopicIds.length === 0 || !searchResult) {
        alert("请至少选择一个话题");
        return;
    }

    setLoading(true);
    const total = selectedTopicIds.length;
    let completedCount = 0;
    const newArticles: GeneratedArticle[] = [];

    const topicsToProcess = searchResult.topics.filter(t => selectedTopicIds.includes(t.id));

    try {
      for (const topic of topicsToProcess) {
        completedCount++;
        const prefix = `[${completedCount}/${total}] “${topic.title}”\n`;
        
        try {
          // Agent 1: Editor
          setLoadingMessage(`${prefix}🤵 首席主编正在策划选题角度...`);
          const plan = await GeminiService.runEditorAgent(topic.title, topic.description, customInstructions, selectedStyle, aiSettings);
          
          // Agent 2: Writer
          setLoadingMessage(`${prefix}✍️ 资深笔杆子正在撰写正文 (角度: ${plan.angle})...`);
          const draft = await GeminiService.runWriterAgent(topic.title, topic.description, plan, aiSettings);

          // Agent 3: Visual Director
          setLoadingMessage(`${prefix}🎨 视觉总监正在挑选配图...`);
          const visual = await GeminiService.runVisualAgent(draft.title, draft.content, aiSettings);
          
          // Tool: Search
          let imageUrl = "";
          try {
             imageUrl = await GeminiService.searchRelatedImage(visual.imageSearchQuery);
          } catch (imgErr) {
             imageUrl = ""; 
          }

          const newArticle: GeneratedArticle = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            createdAt: Date.now(),
            title: draft.title,
            summary: draft.summary,
            content: draft.content,
            imageSearchQuery: visual.imageSearchQuery,
            imageUrl,
            originalTopic: topic.title,
            category: activeCategory, 
            agentLog: {
              angle: plan.angle,
              tone: plan.tone,
              style: selectedStyle
            }
          };

          newArticles.push(newArticle);
          
        } catch (err) {
          console.error(`Failed to generate article for topic ${topic.id}`, err);
        }
      }

      if (newArticles.length > 0) {
        setHistory(prev => [...newArticles, ...prev]);
        setViewingArticleId(newArticles[0].id);
        setCurrentStep(AppStep.REVIEW_AND_EXPORT);
      } else {
        alert("生成失败，请重试。如果使用自定义 AI，请检查配置是否正确。");
      }

    } catch (e) {
      console.error(e);
      alert("批量生成过程中发生错误。");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateArticle = (updatedArticle: GeneratedArticle) => {
    setHistory(prev => prev.map(a => a.id === updatedArticle.id ? updatedArticle : a));
    setLastSaved(Date.now());
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {loading && <LoadingOverlay message={loadingMessage} />}

      <Sidebar 
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        history={history}
        historyFilter={historyFilter}
        setHistoryFilter={setHistoryFilter}
        viewingArticleId={viewingArticleId}
        setViewingArticleId={setViewingArticleId}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        
        {currentStep === AppStep.TOPIC_SEARCH && (
          <StepTopicSearch 
            customTopic={customTopic}
            setCustomTopic={setCustomTopic}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            handleSearch={handleSearch}
          />
        )}

        {currentStep === AppStep.TOPIC_SELECTION && searchResult && (
          <StepTopicSelection 
            searchResult={searchResult}
            activeCategory={activeCategory}
            loading={loading}
            handleSearch={handleSearch}
            setCurrentStep={setCurrentStep}
            selectedTopicIds={selectedTopicIds}
            toggleTopicSelection={toggleTopicSelection}
            toggleSelectAll={toggleSelectAll}
            selectedStyle={selectedStyle}
            setSelectedStyle={setSelectedStyle}
            customInstructions={customInstructions}
            setCustomInstructions={setCustomInstructions}
            handleBatchGenerate={handleBatchGenerate}
          />
        )}

        {currentStep === AppStep.REVIEW_AND_EXPORT && (
          <StepEditor 
            key={viewingArticleId} // Force remount to reset editor state when article changes
            currentArticle={currentArticle}
            onBack={() => {
                setCurrentStep(AppStep.TOPIC_SEARCH);
                setSearchResult(null);
            }}
            onUpdateArticle={handleUpdateArticle}
            lastSaved={lastSaved}
          />
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        aiSettings={aiSettings}
        setAiSettings={setAiSettings}
      />
    </div>
  );
};

export default App;