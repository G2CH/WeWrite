import React from 'react';
import { ChevronLeft, RefreshCw, Square, CheckSquare, UserCog, CheckCircle2, Sparkles } from 'lucide-react';
import { SearchResult, ArticleStyle, AppStep } from '../types';

interface StepTopicSelectionProps {
  searchResult: SearchResult;
  activeCategory: string;
  loading: boolean;
  handleSearch: () => void;
  setCurrentStep: (step: AppStep) => void;
  selectedTopicIds: number[];
  toggleTopicSelection: (id: number) => void;
  toggleSelectAll: () => void;
  selectedStyle: ArticleStyle;
  setSelectedStyle: (style: ArticleStyle) => void;
  customInstructions: string;
  setCustomInstructions: (text: string) => void;
  handleBatchGenerate: () => void;
}

export const StepTopicSelection: React.FC<StepTopicSelectionProps> = ({
  searchResult,
  activeCategory,
  loading,
  handleSearch,
  setCurrentStep,
  selectedTopicIds,
  toggleTopicSelection,
  toggleSelectAll,
  selectedStyle,
  setSelectedStyle,
  customInstructions,
  setCustomInstructions,
  handleBatchGenerate
}) => {
  return (
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
                <h2 className="text-2xl font-bold text-gray-900">“{activeCategory}” 检索结果</h2>
                <p className="text-gray-500 text-sm mt-1">AI 筛选整理了 {searchResult.topics.length} 个相关话题</p>
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
  );
};