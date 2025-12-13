import React, { useState, useEffect, useRef } from 'react';
import { 
  Newspaper, 
  Sparkles, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Circle,
  Image as ImageIcon,
  Copy,
  ChevronLeft,
  Square,
  PenTool,
  TrendingUp,
  Layout,
  ArrowRight,
  UserCog,
  Palette,
  Loader2,
  Save,
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Link2,
  Table as TableIcon,
  Minus,
  Maximize2,
  Send,
  X,
  Filter
} from 'lucide-react';
import { AppStep, TopicCategory, SearchResult, GeneratedArticle, Topic, ArticleStyle } from './types';
import * as GeminiService from './services/geminiService';
import { LoadingOverlay } from './components/LoadingOverlay';
import { MarkdownRenderer } from './components/MarkdownRenderer';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.TOPIC_SEARCH);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  
  // Data State
  const [selectedCategory, setSelectedCategory] = useState<TopicCategory>(TopicCategory.TECH);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  
  // Selection State (Multi-select)
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<ArticleStyle>(ArticleStyle.PROFESSIONAL);
  
  const [customInstructions, setCustomInstructions] = useState<string>("");
  
  // History / Articles State
  const [history, setHistory] = useState<GeneratedArticle[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [viewingArticleId, setViewingArticleId] = useState<string | null>(null);

  // Derived state for current viewing article
  const currentArticle = history.find(a => a.id === viewingArticleId) || null;

  // Editor State
  const [editedContent, setEditedContent] = useState<string>("");
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedSummary, setEditedSummary] = useState<string>(""); 
  const [lastSaved, setLastSaved] = useState<number>(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Image Editor State
  const [editingImageQuery, setEditingImageQuery] = useState<string>("");
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState<boolean>(false);
  
  // Image Preview Modal State
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

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
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('wechat_writer_history', JSON.stringify(history));
    }
  }, [history]);

  // Sync editing query when article changes
  useEffect(() => {
    if (currentArticle) {
        setEditingImageQuery(currentArticle.imageSearchQuery || currentArticle.title);
        setImageCandidates([]); // Clear previous candidates
        // Reset editor state
        setEditedContent(currentArticle.content);
        setEditedTitle(currentArticle.title);
        setEditedSummary(currentArticle.summary); 
    }
  }, [currentArticle?.id]);

  // Handlers
  const handleSearch = async () => {
    setLoading(true);
    setLoadingMessage(`正在全网扫描关于 ${selectedCategory} 的 10 个热门话题...`);
    try {
      const result = await GeminiService.searchTrendingTopics(selectedCategory);
      setSearchResult(result);
      setSelectedTopicIds([]); // Reset selection on new search
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
        
        // --- Multi-Agent Workflow ---
        try {
          // Agent 1: Editor
          setLoadingMessage(`${prefix}🤵 首席主编正在策划选题角度 (${selectedStyle})...`);
          const plan = await GeminiService.runEditorAgent(topic.title, topic.description, customInstructions, selectedStyle);
          
          // Agent 2: Writer
          setLoadingMessage(`${prefix}✍️ 资深笔杆子正在撰写正文 (角度: ${plan.angle})...`);
          const draft = await GeminiService.runWriterAgent(topic.title, topic.description, plan);

          // Agent 3: Visual Director
          setLoadingMessage(`${prefix}🎨 视觉总监正在挑选配图...`);
          const visual = await GeminiService.runVisualAgent(draft.title, draft.content);
          
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
            category: selectedCategory,
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
        alert("生成失败，请重试。");
      }

    } catch (e) {
      console.error(e);
      alert("批量生成过程中发生错误。");
    } finally {
      setLoading(false);
    }
  };

  const handleImageSearch = async () => {
    if (!editingImageQuery.trim()) return;
    setIsSearchingImages(true);
    setImageCandidates([]);
    try {
        const urls = await GeminiService.searchImageOptions(editingImageQuery);
        setImageCandidates(urls);
    } catch (error) {
        console.error("Manual image search failed", error);
    } finally {
        setIsSearchingImages(false);
    }
  };

  const handleSelectImage = (url: string) => {
      if (!currentArticle) return;
      
      const updatedArticle = { ...currentArticle, imageUrl: url, imageSearchQuery: editingImageQuery };
      setHistory(prev => prev.map(a => a.id === currentArticle.id ? updatedArticle : a));
  };

  const saveContentChanges = () => {
    if (!currentArticle) return;
    const updatedArticle = { 
        ...currentArticle, 
        title: editedTitle, 
        content: editedContent,
        summary: editedSummary
    };
    setHistory(prev => prev.map(a => a.id === currentArticle.id ? updatedArticle : a));
    setLastSaved(Date.now());
  };

  const copyMarkdown = () => {
    if (!currentArticle) return;
    const textToCopy = `# ${editedTitle}\n\n> ${editedSummary}\n\n${editedContent}`;
    navigator.clipboard.writeText(textToCopy);
    alert("Markdown 源码已复制！");
  };

  const copyToWeChat = () => {
    const element = document.getElementById('wx-article-preview');
    if (!element) return;

    // Use Selection and Range API to copy formatted HTML
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);

    try {
        document.execCommand('copy');
        // Visual feedback via button text (hacky but effective without extra state)
        const btn = document.getElementById('copy-wx-btn');
        const originalHTML = btn?.innerHTML;
        if(btn && originalHTML) {
            btn.innerHTML = `已复制 ✅`;
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        }
    } catch (e) {
        console.error(e);
        alert("复制失败，请尝试手动全选复制。");
    }
    selection?.removeAllRanges();
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800&auto=format&fit=crop"; 
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // --- EDITOR TOOLBAR ACTIONS ---
  const insertText = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editedContent;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    setEditedContent(newText);
    
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const ToolbarButton = ({ icon: Icon, onClick, title }: { icon: any, onClick: () => void, title: string }) => (
    <button 
      onClick={onClick} 
      className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors" 
      title={title}
    >
      <Icon size={16}/>
    </button>
  );

  const ToolbarDivider = () => <div className="w-px h-4 bg-gray-300 mx-1"></div>;

  // --- SUB-COMPONENTS for Layout ---
  const SidebarItem = ({ 
    active, 
    icon: Icon, 
    label, 
    onClick, 
    badge 
  }: { active?: boolean; icon: any; label: string; onClick: () => void; badge?: number }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
        active 
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <Icon size={18} className={active ? "text-white" : "text-gray-400 group-hover:text-gray-600"} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className={`px-2 py-0.5 rounded-full text-xs ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {loading && <LoadingOverlay message={loadingMessage} />}

      {/* --- LEFT SIDEBAR --- */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-20">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg">
              <Newspaper size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">AI 自动号主</span>
          </div>

          <nav className="space-y-2">
            <SidebarItem 
              label="开始创作" 
              icon={PenTool} 
              active={currentStep === AppStep.TOPIC_SEARCH || currentStep === AppStep.TOPIC_SELECTION}
              onClick={() => setCurrentStep(AppStep.TOPIC_SEARCH)} 
            />
            
            <div className="flex items-center justify-between px-4 pt-6 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">历史记录</p>
              
              <div className="relative group">
                 <div className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer hover:text-emerald-600 transition-colors">
                    <Filter size={12} />
                    <span className="max-w-[60px] truncate">{historyFilter === 'ALL' ? '筛选' : historyFilter}</span>
                 </div>
                 <select 
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 >
                    <option value="ALL">全部显示</option>
                    {Object.values(TopicCategory).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                 </select>
              </div>
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-250px)] no-scrollbar">
              {history.filter(item => historyFilter === 'ALL' || item.category === historyFilter).length === 0 && (
                <div className="px-4 text-xs text-gray-400 italic py-2">
                    {historyFilter === 'ALL' ? '暂无历史记录' : '该分类下无记录'}
                </div>
              )}
              {history
                .filter(item => historyFilter === 'ALL' || item.category === historyFilter)
                .map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setViewingArticleId(item.id);
                    setCurrentStep(AppStep.REVIEW_AND_EXPORT);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors group flex items-start gap-2 ${
                    viewingArticleId === item.id && currentStep === AppStep.REVIEW_AND_EXPORT
                      ? "bg-emerald-50 text-emerald-800 font-medium" 
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Newspaper size={14} className={`mt-0.5 shrink-0 ${viewingArticleId === item.id ? "text-emerald-500" : "text-gray-300"}`} />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* STEP 1: DASHBOARD SEARCH */}
        {currentStep === AppStep.TOPIC_SEARCH && (
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 flex flex-col items-center justify-center bg-slate-50/50">
            <div className="max-w-3xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100">
                  <UserCog size={14} /> 
                  <span>多智能体（Multi-Agent）编辑部已就位</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                  今天要写点什么？
                </h1>
                <p className="text-lg text-slate-500 max-w-xl mx-auto">
                  选择一个领域，由主编、资深写手和视觉总监组成的 AI 团队将为您完成一切。
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.values(TopicCategory).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`relative p-6 rounded-2xl border text-left transition-all duration-300 group hover:-translate-y-1 ${
                      selectedCategory === cat 
                        ? "border-emerald-500 bg-white shadow-xl shadow-emerald-100 ring-2 ring-emerald-500 ring-opacity-50" 
                        : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-lg hover:shadow-gray-100"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full mb-4 flex items-center justify-center transition-colors ${
                      selectedCategory === cat ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"
                    }`}>
                      {cat === TopicCategory.TECH && <TrendingUp size={20} />}
                      {cat === TopicCategory.FINANCE && <Layout size={20} />}
                      {cat === TopicCategory.LIFESTYLE && <CheckCircle2 size={20} />}
                      {cat === TopicCategory.ENTERTAINMENT && <Sparkles size={20} />}
                      {cat === TopicCategory.GENERAL && <Newspaper size={20} />}
                    </div>
                    <span className={`text-lg font-bold block mb-1 ${selectedCategory === cat ? "text-emerald-900" : "text-gray-700"}`}>
                      {cat}
                    </span>
                    <span className="text-xs text-gray-400">点击选中</span>
                    
                    {selectedCategory === cat && (
                      <div className="absolute top-4 right-4 text-emerald-500 animate-in zoom-in duration-300">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-4 flex justify-center">
                <button 
                  onClick={handleSearch}
                  className="px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-lg shadow-xl shadow-emerald-200 transition-all flex items-center gap-3 transform active:scale-95 group"
                >
                  <Search size={22} className="group-hover:scale-110 transition-transform"/>
                  开始全网扫描
                  <ArrowRight size={20} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TOPIC SELECTION */}
        {currentStep === AppStep.TOPIC_SELECTION && searchResult && (
          <div className="flex-1 flex overflow-hidden animate-in fade-in duration-500">
            {/* Left: Content List */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              <div className="max-w-3xl mx-auto">
                <button 
                  onClick={() => setCurrentStep(AppStep.TOPIC_SEARCH)}
                  className="mb-6 flex items-center text-gray-400 hover:text-gray-700 transition-colors text-sm font-medium"
                >
                  <ChevronLeft size={16} className="mr-1"/> 返回分类选择
                </button>

                <div className="flex items-center justify-between mb-6">
                  <div>
                     <h2 className="text-2xl font-bold text-gray-900">精选热点</h2>
                     <p className="text-gray-500 text-sm mt-1">从全网 {searchResult.sources.length} 个来源中提取了 {searchResult.topics.length} 个话题</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button 
                        onClick={handleSearch}
                        className="text-sm font-medium text-gray-600 hover:text-emerald-600 bg-white border border-gray-200 hover:border-emerald-200 px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                        title="重新获取热点话题"
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
                        换一换
                    </button>
                    
                    <button 
                        onClick={toggleSelectAll}
                        className="text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {selectedTopicIds.length === searchResult.topics.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                        {selectedTopicIds.length === searchResult.topics.length ? "取消全选" : "全选"}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {searchResult.topics.map((topic) => {
                    const isSelected = selectedTopicIds.includes(topic.id);
                    return (
                      <div
                        key={topic.id}
                        onClick={() => toggleTopicSelection(topic.id)}
                        className={`group relative p-5 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-emerald-500 bg-white shadow-md ring-1 ring-emerald-500"
                            : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-lg"
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className={`mt-1 transition-colors ${isSelected ? "text-emerald-600" : "text-gray-300 group-hover:text-emerald-400"}`}>
                            {isSelected ? <CheckSquare size={24} /> : <Square size={24} />}
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg mb-2 ${isSelected ? "text-gray-900" : "text-gray-800"}`}>
                              {topic.title}
                            </h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{topic.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Action Panel */}
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col p-6 z-10 shadow-xl">
               <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                 <UserCog size={20} className="text-emerald-600"/>
                 编辑部指令
               </h3>

               <div className="flex-1 space-y-6 overflow-y-auto">
                 <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">已选话题</label>
                   <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 min-h-[100px] max-h-[200px] overflow-y-auto">
                     {selectedTopicIds.length === 0 ? (
                       <p className="text-gray-400 text-sm italic text-center py-4">请在左侧选择话题</p>
                     ) : (
                       <ul className="space-y-2">
                         {searchResult.topics
                           .filter(t => selectedTopicIds.includes(t.id))
                           .map(t => (
                             <li key={t.id} className="text-sm text-emerald-800 flex items-start gap-2">
                               <CheckCircle2 size={14} className="mt-0.5 shrink-0"/>
                               {t.title}
                             </li>
                           ))
                         }
                       </ul>
                     )}
                   </div>
                 </div>

                 {/* Article Style Selector */}
                 <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">文章风格</label>
                   <div className="grid grid-cols-2 gap-2">
                     {Object.values(ArticleStyle).map((style) => (
                       <button
                         key={style}
                         onClick={() => setSelectedStyle(style)}
                         className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                           selectedStyle === style 
                           ? "bg-emerald-50 border-emerald-500 text-emerald-700 font-bold" 
                           : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300"
                         }`}
                       >
                         {style}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">给主编的特殊指令 (可选)</label>
                   <textarea
                     value={customInstructions}
                     onChange={(e) => setCustomInstructions(e.target.value)}
                     placeholder="例如：文章风格要犀利一点，强调对普通人的影响..."
                     className="w-full h-24 p-3 rounded-lg bg-white border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none"
                   />
                 </div>
               </div>

               <div className="mt-6 pt-6 border-t border-gray-100 shrink-0">
                 <button
                   onClick={handleBatchGenerate}
                   disabled={selectedTopicIds.length === 0}
                   className={`w-full py-4 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                     selectedTopicIds.length > 0
                     ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 hover:-translate-y-1" 
                     : "bg-gray-300 cursor-not-allowed"
                   }`}
                 >
                   <Sparkles size={20} />
                   启动多智能体生成 ({selectedTopicIds.length})
                 </button>
               </div>
            </div>
          </div>
        )}

        {/* STEP 3: EDITOR & EXPORT */}
        {currentStep === AppStep.REVIEW_AND_EXPORT && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            
            {/* --- TOP ACTION BAR --- */}
            {currentArticle && (
              <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0 z-30">
                  <div className="flex items-center gap-4">
                      <button
                          onClick={() => {
                              setCurrentStep(AppStep.TOPIC_SEARCH);
                              setSearchResult(null);
                          }}
                          className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                          <ChevronLeft size={16} />
                          返回创作中心
                      </button>
                      <div className="h-6 w-px bg-gray-300"></div>
                      <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                          {currentArticle.category || "未分类"}
                      </span>
                      <span className="text-sm font-medium text-gray-600 max-w-[300px] truncate" title={currentArticle.title}>
                          {currentArticle.title}
                      </span>
                  </div>

                  <div className="flex items-center gap-3">
                      {lastSaved > 0 && <span className="text-xs text-gray-400 mr-2">已保存 {formatDate(lastSaved)}</span>}
                      
                      <button
                         onClick={saveContentChanges}
                         className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                      >
                         <Save size={16} />
                         保存
                      </button>

                      <button
                          onClick={copyMarkdown}
                          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                      >
                          <Copy size={16} />
                          复制 MD
                      </button>

                      <button
                          id="copy-wx-btn"
                          onClick={copyToWeChat}
                          className="px-4 py-2 bg-[#07c160] hover:bg-[#06ad56] text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-emerald-100"
                      >
                          <Send size={16} />
                          复制到公众号
                      </button>
                  </div>
              </header>
            )}

            <div className="flex-1 flex overflow-hidden">
                {currentArticle ? (
                  <>
                    {/* 1. EDITOR PANE */}
                    <div className="flex-1 flex flex-col border-r border-gray-200 min-w-[320px] max-w-[50%] bg-white z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                        
                        {/* Toolbar */}
                        <div className="px-4 py-2 border-b border-gray-200 bg-[#f9f9f9] flex flex-wrap gap-1 items-center z-20">
                            <ToolbarButton icon={Bold} onClick={() => insertText("**", "**")} title="加粗 (Ctrl+B)" />
                            <ToolbarButton icon={Italic} onClick={() => insertText("*", "*")} title="斜体 (Ctrl+I)" />
                            <ToolbarButton icon={Strikethrough} onClick={() => insertText("~~", "~~")} title="删除线 (Ctrl+D)" />
                            
                            <ToolbarDivider />
                            
                            <ToolbarButton icon={Heading2} onClick={() => insertText("## ")} title="二级标题" />
                            <ToolbarButton icon={Heading3} onClick={() => insertText("### ")} title="三级标题" />
                            
                            <ToolbarDivider />
                            
                            <ToolbarButton icon={Quote} onClick={() => insertText("> ")} title="引用" />
                            <ToolbarButton icon={List} onClick={() => insertText("- ")} title="无序列表" />
                            <ToolbarButton icon={ListOrdered} onClick={() => insertText("1. ")} title="有序列表" />
                            <ToolbarButton icon={CheckSquare} onClick={() => insertText("- [ ] ")} title="任务列表" />
                            
                            <ToolbarDivider />
                            
                            <ToolbarButton icon={Code} onClick={() => insertText("```\n", "\n```")} title="代码块" />
                            <ToolbarButton icon={Link2} onClick={() => insertText("[链接文字](", ")")} title="链接" />
                            <ToolbarButton icon={TableIcon} onClick={() => insertText("| 标题1 | 标题2 |\n| --- | --- |\n| 内容1 | 内容2 |")} title="表格" />
                            <ToolbarButton icon={Minus} onClick={() => insertText("\n---\n")} title="分割线" />
                        </div>

                        {/* Metadata Inputs (Title & Summary) */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-white space-y-3">
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="w-full text-xl font-bold text-gray-800 outline-none bg-transparent placeholder-gray-300"
                                placeholder="文章标题"
                            />
                            <input
                                type="text"
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                                className="w-full text-sm text-gray-500 outline-none bg-transparent placeholder-gray-300 border-b border-dashed border-gray-200 focus:border-emerald-400 pb-1 transition-colors"
                                placeholder="摘要（显示在封面卡片）"
                            />
                        </div>

                        {/* Editor Textarea */}
                        <textarea
                            ref={textareaRef}
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="flex-1 w-full resize-none p-6 outline-none font-mono text-[14px] leading-relaxed text-gray-700 bg-white"
                            spellCheck={false}
                            placeholder="在此输入 Markdown 内容..."
                        />
                    </div>

                    {/* 2. PREVIEW PANE (WeChat Style) */}
                    <div className="flex-1 bg-[#f0f2f5] overflow-y-auto relative flex flex-col items-center p-8">
                        <div 
                            id="wx-article-preview"
                            className="w-full max-w-[480px] bg-white min-h-[calc(100%-2rem)] shadow-sm flex-shrink-0 flex flex-col"
                        >
                            
                            {/* Preview Header */}
                            <div className="px-5 pt-8 pb-6 flex-1">
                                <h1 className="text-[22px] font-bold text-[#333] leading-[1.4] mb-4">
                                  {editedTitle || "无标题"}
                                </h1>
                                <div className="flex items-center gap-2 text-[15px] text-[rgba(0,0,0,0.3)] mb-6">
                                    <span className="text-[#576b95] font-medium cursor-pointer">AI 编辑部</span>
                                    <span className="text-[rgba(0,0,0,0.3)]">{formatDate(currentArticle.createdAt)}</span>
                                </div>

                                {/* Cover Image */}
                                <div 
                                  className="mb-6 rounded-[4px] overflow-hidden aspect-[2.35/1] relative bg-gray-100 group cursor-zoom-in" 
                                  onClick={() => currentArticle.imageUrl && setIsImageModalOpen(true)}
                                >
                                    {currentArticle.imageUrl ? (
                                        <>
                                            <img 
                                                src={currentArticle.imageUrl} 
                                                onError={handleImageError}
                                                alt="Cover" 
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Maximize2 className="text-white drop-shadow-md" size={32} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-300 flex-col gap-2">
                                            <ImageIcon size={24}/>
                                            <span className="text-xs">无封面图</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Summary Block */}
                                {editedSummary && (
                                    <section className="mb-8 p-4 bg-[#f7f7f7] text-[14px] text-[#666] leading-6 rounded-[4px] border border-[#eee]">
                                        <span className="font-bold text-[#333] mr-2">摘要</span>
                                        {editedSummary}
                                    </section>
                                )}
                                
                                {/* Main Content Render */}
                                <MarkdownRenderer content={editedContent} />
                            </div>
                        </div>
                        <div className="pb-8 pt-4 text-xs text-gray-400">
                            预览效果尽可能还原微信样式
                        </div>
                    </div>

                    {/* 3. RIGHT SIDEBAR (Image Management Only) */}
                    <div className="w-80 bg-white border-l border-gray-200 flex flex-col z-20 overflow-y-auto shrink-0">
                         <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                 <Palette size={16} className="text-emerald-600"/> 配图管理
                            </h3>
                         </div>
                         
                         <div className="p-4 space-y-6">
                            {/* Image Search Section */}
                            <div className="space-y-3">
                               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">搜索封面图</label>
                               <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={editingImageQuery}
                                    onChange={(e) => setEditingImageQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleImageSearch()}
                                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="输入关键词..."
                                  />
                                  <button 
                                     onClick={handleImageSearch}
                                     disabled={isSearchingImages}
                                     className="bg-emerald-50 text-emerald-600 p-2 rounded-lg hover:bg-emerald-100 transition-colors"
                                  >
                                     {isSearchingImages ? <Loader2 size={16} className="animate-spin"/> : <Search size={16}/>}
                                  </button>
                               </div>

                               {imageCandidates.length > 0 ? (
                                   <div className="grid grid-cols-2 gap-2 mt-2">
                                       {imageCandidates.map((url, idx) => (
                                           <button 
                                             key={idx}
                                             onClick={() => handleSelectImage(url)}
                                             className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                                                 currentArticle.imageUrl === url ? "border-emerald-500 ring-2 ring-emerald-200" : "border-transparent hover:border-gray-300"
                                             }`}
                                           >
                                               <img src={url} alt="Candidate" className="w-full h-full object-cover"/>
                                               {currentArticle.imageUrl === url && (
                                                   <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                                       <CheckCircle2 size={16} className="text-white drop-shadow-md"/>
                                                   </div>
                                               )}
                                           </button>
                                       ))}
                                   </div>
                               ) : (
                                  <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                      <ImageIcon size={24} className="mx-auto mb-2 opacity-30"/>
                                      <span className="text-xs">输入关键词并回车搜索</span>
                                  </div>
                               )}
                            </div>
                         </div>
                    </div>
                  </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                            <Layout size={24} className="text-gray-300"/>
                        </div>
                        <p className="text-sm">请从左侧选择文章</p>
                    </div>
                )}
            </div>
          </div>
        )}

      </main>

      {/* Image Modal */}
      {isImageModalOpen && currentArticle?.imageUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsImageModalOpen(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsImageModalOpen(false);
            }}
          >
            <X size={32} />
          </button>
          <img 
            src={currentArticle.imageUrl} 
            alt="Full View" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
};

export default App;