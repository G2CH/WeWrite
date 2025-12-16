import React from 'react';
import { Newspaper, PenTool, Filter, Settings } from 'lucide-react';
import { AppStep, GeneratedArticle, TopicCategory } from '../types';

interface SidebarProps {
  currentStep: AppStep;
  setCurrentStep: (step: AppStep) => void;
  history: GeneratedArticle[];
  historyFilter: string;
  setHistoryFilter: (filter: string) => void;
  viewingArticleId: string | null;
  setViewingArticleId: (id: string | null) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  setCurrentStep,
  history,
  historyFilter,
  setHistoryFilter,
  viewingArticleId,
  setViewingArticleId,
  isSettingsOpen,
  setIsSettingsOpen
}) => {
  
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-20">
      <div className="p-6 pb-2">
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
            onClick={() => {
                setCurrentStep(AppStep.TOPIC_SEARCH);
                setViewingArticleId(null);
            }} 
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

          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-320px)] no-scrollbar">
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

      {/* Sidebar Footer - Settings */}
      <div className="mt-auto p-6 border-t border-gray-100">
          <SidebarItem 
            label="AI 设置" 
            icon={Settings} 
            active={isSettingsOpen}
            onClick={() => setIsSettingsOpen(true)} 
          />
      </div>
    </aside>
  );
};