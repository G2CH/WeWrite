import React from 'react';
import { UserCog, Search, X, TrendingUp, Layout, CheckCircle2, Sparkles, Newspaper, ArrowRight } from 'lucide-react';
import { TopicCategory } from '../types';

interface StepTopicSearchProps {
  customTopic: string;
  setCustomTopic: (val: string) => void;
  selectedCategory: TopicCategory;
  setSelectedCategory: (cat: TopicCategory) => void;
  handleSearch: () => void;
}

export const StepTopicSearch: React.FC<StepTopicSearchProps> = ({
  customTopic,
  setCustomTopic,
  selectedCategory,
  setSelectedCategory,
  handleSearch
}) => {
  return (
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

        {/* Custom Search Input */}
        <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Search size={20} className={`transition-colors ${customTopic ? "text-emerald-500" : "text-gray-400 group-focus-within:text-emerald-500"}`}/>
                </div>
                <input 
                    type="text" 
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className={`w-full pl-12 pr-12 py-4 rounded-2xl border bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm text-lg ${
                        customTopic 
                        ? "border-emerald-500 ring-4 ring-emerald-500/10 text-gray-900" 
                        : "border-gray-200 focus:border-emerald-500 text-gray-700 placeholder-gray-400"
                    }`}
                    placeholder="输入任何感兴趣的主题 (例如：量子计算、咖啡文化、SpaceX)..." 
                />
                {customTopic && (
                    <button 
                        onClick={() => setCustomTopic("")}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>

        <div className="relative text-center">
            <span className="bg-slate-50/50 px-3 text-sm text-gray-400 relative z-10 font-medium">或选择热门分类</span>
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.values(TopicCategory).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                  setSelectedCategory(cat);
                  setCustomTopic(""); // Clear custom input when category selected
              }}
              className={`relative p-6 rounded-2xl border text-left transition-all duration-300 group hover:-translate-y-1 ${
                selectedCategory === cat && !customTopic
                  ? "border-emerald-500 bg-white shadow-xl shadow-emerald-100 ring-2 ring-emerald-500 ring-opacity-50" 
                  : "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-lg hover:shadow-gray-100"
              }`}
            >
              <div className={`w-10 h-10 rounded-full mb-4 flex items-center justify-center transition-colors ${
                selectedCategory === cat && !customTopic ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"
              }`}>
                {cat === TopicCategory.TECH && <TrendingUp size={20} />}
                {cat === TopicCategory.FINANCE && <Layout size={20} />}
                {cat === TopicCategory.LIFESTYLE && <CheckCircle2 size={20} />}
                {cat === TopicCategory.ENTERTAINMENT && <Sparkles size={20} />}
                {cat === TopicCategory.GENERAL && <Newspaper size={20} />}
              </div>
              <span className={`text-lg font-bold block mb-1 ${selectedCategory === cat && !customTopic ? "text-emerald-900" : "text-gray-700"}`}>
                {cat}
              </span>
              
              {selectedCategory === cat && !customTopic && (
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
            {customTopic ? `扫描 “${customTopic}”` : "开始全网扫描"}
            <ArrowRight size={20} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
          </button>
        </div>
      </div>
    </div>
  );
};