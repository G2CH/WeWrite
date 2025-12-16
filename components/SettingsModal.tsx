import React from 'react';
import { Settings, X, BrainCircuit, Globe, Key, Database, Zap, SlidersHorizontal } from 'lucide-react';
import { AISettings, AIProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiSettings: AISettings;
  setAiSettings: (settings: AISettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiSettings,
  setAiSettings
}) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
    >
        <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Settings size={18} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">AI 配置中心</h2>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto">
                {/* Provider Selection */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 block">AI 服务商</label>
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setAiSettings({...aiSettings, provider: AIProvider.GOOGLE})}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                            aiSettings.provider === AIProvider.GOOGLE
                            ? "bg-white text-emerald-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Google Gemini (默认)
                    </button>
                    <button
                        onClick={() => setAiSettings({...aiSettings, provider: AIProvider.CUSTOM})}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                            aiSettings.provider === AIProvider.CUSTOM
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        自定义 (OpenAI 协议)
                    </button>
                    </div>
                </div>

                {/* Provider Specific Settings */}
                {aiSettings.provider === AIProvider.GOOGLE ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-4">
                        <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <BrainCircuit size={16} className="text-emerald-500"/>
                            写作模型 (Gemini)
                        </label>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            {aiSettings.writerModel.includes('pro') ? '高智商' : '高速度'}
                        </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setAiSettings({...aiSettings, writerModel: "gemini-3-pro-preview"})}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                aiSettings.writerModel === "gemini-3-pro-preview"
                                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                                : "border-gray-200 hover:border-emerald-300"
                            }`}
                        >
                            <div className="font-bold text-sm text-gray-800 mb-1">Gemini 3 Pro</div>
                            <div className="text-xs text-gray-500 leading-tight">深度长文，逻辑强。</div>
                        </button>
                        <button
                            onClick={() => setAiSettings({...aiSettings, writerModel: "gemini-2.5-flash"})}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                aiSettings.writerModel === "gemini-2.5-flash"
                                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                                : "border-gray-200 hover:border-emerald-300"
                            }`}
                        >
                            <div className="font-bold text-sm text-gray-800 mb-1">Gemini 2.5 Flash</div>
                            <div className="text-xs text-gray-500 leading-tight">速度极快，成本低。</div>
                        </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Globe size={12}/> Base URL (Endpoint)
                        </label>
                        <input 
                            type="text"
                            value={aiSettings.customBaseUrl}
                            onChange={(e) => setAiSettings({...aiSettings, customBaseUrl: e.target.value})}
                            className="w-full text-sm p-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                            placeholder="https://api.deepseek.com"
                        />
                        <p className="text-[10px] text-gray-400">支持 DeepSeek, Moonshot, LocalAI (Ollama) 等遵循 OpenAI 接口的平台。</p>
                        </div>

                        <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Key size={12}/> API Key
                        </label>
                        <input 
                            type="password"
                            value={aiSettings.customApiKey}
                            onChange={(e) => setAiSettings({...aiSettings, customApiKey: e.target.value})}
                            className="w-full text-sm p-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                            placeholder="sk-..."
                        />
                        </div>

                        <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Database size={12}/> Model ID
                        </label>
                        <input 
                            type="text"
                            value={aiSettings.customModel}
                            onChange={(e) => setAiSettings({...aiSettings, customModel: e.target.value})}
                            className="w-full text-sm p-2 rounded-lg border border-gray-200 focus:border-blue-400 outline-none"
                            placeholder="例如: deepseek-chat, moonshot-v1-8k"
                        />
                        </div>
                        
                        <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                        注意：热点搜索（Topic Search）仍将使用内置 Google 服务。自定义 AI 仅用于文章策划和撰写。
                        </div>
                    </div>
                )}

                {/* Creativity Slider */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Zap size={16} className="text-orange-500"/>
                        创意程度 (Creativity)
                    </label>
                    <span className="text-xs font-mono text-gray-500">{aiSettings.creativity}</span>
                    </div>
                    <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1"
                    value={aiSettings.creativity}
                    onChange={(e) => setAiSettings({...aiSettings, creativity: parseFloat(e.target.value)})}
                    className="w-full accent-emerald-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Global Rules */}
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-blue-500"/>
                    全局规则 (Global Rules)
                    </label>
                    <p className="text-xs text-gray-500">这些规则将强制应用于所有智能体（主编、写手）。</p>
                    <textarea
                    value={aiSettings.globalRules}
                    onChange={(e) => setAiSettings({...aiSettings, globalRules: e.target.value})}
                    className="w-full h-24 p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none"
                    placeholder="例如：所有文章必须包含“点击关注”引导；禁止使用任何负面词汇；永远保持客观中立..."
                    />
                </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                >
                    完成设置
                </button>
            </div>
        </div>
    </div>
  );
};