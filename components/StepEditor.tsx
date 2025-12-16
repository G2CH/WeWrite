import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Save, Copy, Send, Bold, Italic, Strikethrough, Heading2, Heading3, 
  Quote, List, ListOrdered, CheckSquare, Code, Link2, Table as TableIcon, Minus, 
  Maximize2, ImageIcon, Palette, Loader2, Search, Ban, PlusCircle, X, Layout 
} from 'lucide-react';
import { marked } from 'marked'; // Import marked for raw processing
import { GeneratedArticle, AppStep } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import * as GeminiService from '../services/geminiService';

interface StepEditorProps {
  currentArticle: GeneratedArticle | null;
  onBack: () => void;
  onUpdateArticle: (article: GeneratedArticle) => void;
  lastSaved: number;
}

// --- Rich WeChat Theme (Doocs Style) ---
const WX_THEME: Record<string, string> = {
  // Global Container
  container: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.75; color: #3f3f3f; text-align: justify; overflow-wrap: break-word; letter-spacing: 0.5px;",
  
  // Headers
  h1: "font-size: 22px; font-weight: bold; margin-top: 30px; margin-bottom: 20px; text-align: center; color: #333; line-height: 1.4;",
  h2: "display: block; font-size: 18px; font-weight: bold; margin-top: 40px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #07c160; color: #333; text-align: center;",
  h3: "display: block; font-size: 16px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #07c160; color: #333; line-height: 1.4;",
  
  // Text Elements
  p: "margin-bottom: 16px; line-height: 1.75; color: #3f3f3f;",
  strong: "color: #07c160; font-weight: bold;",
  em: "font-style: italic; color: #666; padding-right: 2px;",
  blockquote: "margin: 20px 0; padding: 16px; background: #f8f9fa; border-left: 4px solid #07c160; border-radius: 4px; color: #555; font-size: 15px; line-height: 1.6; box-shadow: 2px 2px 6px rgba(0,0,0,0.05);",
  
  // Lists
  ul: "margin-bottom: 16px; padding-left: 20px; list-style-type: disc; color: #3f3f3f;",
  ol: "margin-bottom: 16px; padding-left: 20px; list-style-type: decimal; color: #3f3f3f;",
  li: "margin-bottom: 6px; line-height: 1.6;",
  
  // Code
  code_inline: "font-family: Menlo, Monaco, Consolas, monospace; background-color: #fff5f5; color: #ff502c; padding: 2px 5px; border-radius: 4px; font-size: 14px; margin: 0 3px;",
  pre: "display: block; background-color: #282c34; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);",
  code_block: "font-family: Menlo, Monaco, Consolas, monospace; background-color: transparent; color: #abb2bf; font-size: 13px; line-height: 1.5; white-space: pre;",
  
  // Media & Links
  img: "display: block; max-width: 100% !important; height: auto !important; margin: 20px auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);",
  a: "color: #07c160; text-decoration: none; border-bottom: 1px dashed #07c160; font-weight: 500; margin: 0 2px;",
  hr: "border: none; border-top: 1px dashed #ddd; margin: 30px 0;",
  
  // Tables
  table: "width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; border: 1px solid #eee;",
  th: "border: 1px solid #dfdfdf; padding: 10px; background-color: #f8f8f8; font-weight: bold; color: #333; text-align: left;",
  td: "border: 1px solid #dfdfdf; padding: 10px; color: #3f3f3f;",
  
  // Article Meta Components
  wx_title: "font-size: 24px; font-weight: bold; color: #333; line-height: 1.4; margin-bottom: 10px;",
  wx_meta: "display: flex; align-items: center; font-size: 14px; color: rgba(0,0,0,0.4); margin-bottom: 24px;",
  wx_summary: "margin-bottom: 30px; padding: 16px; background-color: #f5f6f7; font-size: 15px; color: #555; line-height: 1.6; border-radius: 6px; border: 1px solid #eee;",
  wx_footer: "margin-top: 40px; padding-top: 20px; border-top: 1px dashed #eee; text-align: center; font-size: 12px; color: #999;",
};

export const StepEditor: React.FC<StepEditorProps> = ({
  currentArticle,
  onBack,
  onUpdateArticle,
  lastSaved
}) => {
  const [editedContent, setEditedContent] = useState<string>("");
  const [editedTitle, setEditedTitle] = useState<string>("");
  const [editedSummary, setEditedSummary] = useState<string>("");
  
  const [editingImageQuery, setEditingImageQuery] = useState<string>("");
  const [negativeImageQuery, setNegativeImageQuery] = useState<string>("");
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentArticle) {
      setEditedContent(currentArticle.content);
      setEditedTitle(currentArticle.title);
      setEditedSummary(currentArticle.summary);
      setEditingImageQuery(currentArticle.imageSearchQuery || currentArticle.title);
      setNegativeImageQuery("");
      setImageCandidates([]);
    }
  }, [currentArticle?.id]);

  const handleSave = () => {
    if (!currentArticle) return;
    onUpdateArticle({
      ...currentArticle,
      title: editedTitle,
      content: editedContent,
      summary: editedSummary
    });
  };

  const handleCopyMarkdown = () => {
    const textToCopy = `# ${editedTitle}\n\n> ${editedSummary}\n\n${editedContent}`;
    navigator.clipboard.writeText(textToCopy);
    alert("Markdown 源码已复制！");
  };

  /**
   * Core Logic: Copy to WeChat
   * 1. Generates pure HTML from Markdown.
   * 2. Creates a temporary DOM to manipulate.
   * 3. Manually injects styles into every element.
   * 4. Uses Clipboard API to write text/html.
   */
  const handleCopyToWeChat = async () => {
    if (!currentArticle) return;

    try {
        // 1. Generate HTML from Markdown
        // Configure marked to match renderer settings
        // @ts-ignore
        const rawHtml = marked.parse(editedContent, { breaks: true, gfm: true });

        // 2. Build the full HTML structure including header
        const parser = new DOMParser();
        const doc = parser.parseFromString(`
            <div id="wx-root">
                <!-- Header -->
                <h1 id="wx-title">${editedTitle}</h1>
                <div id="wx-meta">
                    <span style="margin-right: 10px; color: #576b95; font-weight: bold;">AI 编辑部</span>
                    <span style="color: rgba(0,0,0,0.3);">${new Date().toLocaleDateString()}</span>
                </div>
                
                ${currentArticle.imageUrl ? `
                <div id="wx-cover" style="margin-bottom: 24px; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                    <img src="${currentArticle.imageUrl}" style="display: block; width: 100%; height: auto !important;" />
                </div>` : ''}

                ${editedSummary ? `
                <section id="wx-summary">
                    <span style="font-weight: bold; color: #333; margin-right: 8px;">摘要</span>
                    ${editedSummary}
                </section>` : ''}

                <!-- Content -->
                <div id="wx-content">
                    ${rawHtml}
                </div>

                <!-- Footer (Simple Sig) -->
                <div id="wx-footer">
                    本文由 AI 自动号主辅助生成<br/>内容仅供参考
                </div>
            </div>
        `, 'text/html');

        const root = doc.getElementById('wx-root');
        if (!root) throw new Error("Failed to parse HTML");

        // 3. Apply Inline Styles (Recursively)
        // Root Container Style
        root.setAttribute('style', WX_THEME.container);

        // Header Styles
        const titleEl = doc.getElementById('wx-title');
        if(titleEl) titleEl.setAttribute('style', WX_THEME.wx_title);
        
        const metaEl = doc.getElementById('wx-meta');
        if(metaEl) metaEl.setAttribute('style', WX_THEME.wx_meta);

        const summaryEl = doc.getElementById('wx-summary');
        if(summaryEl) summaryEl.setAttribute('style', WX_THEME.wx_summary);
        
        const footerEl = doc.getElementById('wx-footer');
        if(footerEl) footerEl.setAttribute('style', WX_THEME.wx_footer);

        // Content Styles Traversal
        const contentDiv = doc.getElementById('wx-content');
        if (contentDiv) {
            // Helper to set styles
            const setStyle = (selector: string, style: string) => {
                contentDiv.querySelectorAll(selector).forEach(el => {
                    // Append to existing styles if any
                    const existing = el.getAttribute('style') || '';
                    el.setAttribute('style', existing + style);
                });
            };

            // Standard Tags
            setStyle('p', WX_THEME.p);
            setStyle('h1', WX_THEME.h1); 
            setStyle('h2', WX_THEME.h2);
            setStyle('h3', WX_THEME.h3);
            setStyle('h4', WX_THEME.h3); 
            setStyle('blockquote', WX_THEME.blockquote);
            setStyle('ul', WX_THEME.ul);
            setStyle('ol', WX_THEME.ol);
            setStyle('li', WX_THEME.li);
            setStyle('img', WX_THEME.img);
            setStyle('hr', WX_THEME.hr);
            setStyle('a', WX_THEME.a);
            setStyle('strong', WX_THEME.strong);
            setStyle('b', WX_THEME.strong);
            setStyle('em', WX_THEME.em);
            setStyle('table', WX_THEME.table);
            setStyle('th', WX_THEME.th);
            setStyle('td', WX_THEME.td);

            // Special handling for Code
            // 1. Pre blocks
            contentDiv.querySelectorAll('pre').forEach(pre => {
                pre.setAttribute('style', WX_THEME.pre);
                // Find code inside pre
                const code = pre.querySelector('code');
                if (code) {
                    code.setAttribute('style', WX_THEME.code_block);
                }
            });

            // 2. Inline Code (code not inside pre)
            contentDiv.querySelectorAll('code').forEach(code => {
                if (code.parentElement?.tagName !== 'PRE') {
                    code.setAttribute('style', WX_THEME.code_inline);
                }
            });
            
            // 3. Table Rows Stripes
            contentDiv.querySelectorAll('tr').forEach((tr, index) => {
                // nth-child emulation for striping
                if (index % 2 === 1) { // 0-indexed, so 1 is the 2nd row
                    const current = tr.getAttribute('style') || '';
                    tr.setAttribute('style', current + 'background-color: #fafafa;');
                }
            });

            // Cleanups
            // Remove margin from last paragraph in blockquote/list item to tighten layout
            contentDiv.querySelectorAll('blockquote p, li p').forEach(p => {
                const current = p.getAttribute('style') || '';
                // Override margin-bottom only
                p.setAttribute('style', current + 'margin-bottom: 0 !important;');
            });
        }

        // 4. Copy to Clipboard using Blob/ClipboardItem (Modern Way)
        const finalHtml = root.outerHTML;
        
        // Use the Clipboard API if available (Chrome 66+, Safari 13.1+, Firefox 63+)
        if (navigator.clipboard && navigator.clipboard.write) {
            const type = "text/html";
            const blob = new Blob([finalHtml], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            
            await navigator.clipboard.write(data);
            
            // Visual Feedback
            const btn = document.getElementById('copy-wx-btn');
            const originalHTML = btn?.innerHTML;
            if(btn && originalHTML) {
                btn.innerHTML = `已复制 ✅`;
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 2000);
            }
        } else {
             throw new Error("Clipboard API not supported");
        }

    } catch (e) {
        console.error("Copy failed:", e);
        // Fallback: Select and ExecCommand (Legacy)
        // This is less reliable for styles but works on older browsers
        alert("自动复制失败，请尝试全选预览区域手动复制。");
    }
  };

  const handleImageSearch = async () => {
    if (!editingImageQuery.trim()) return;
    setIsSearchingImages(true);
    setImageCandidates([]);
    try {
        const urls = await GeminiService.searchImageOptions(editingImageQuery, negativeImageQuery);
        setImageCandidates(urls);
    } catch (error) {
        console.error("Manual image search failed", error);
    } finally {
        setIsSearchingImages(false);
    }
  };

  const handleSelectImage = (url: string) => {
    if (!currentArticle) return;
    onUpdateArticle({
        ...currentArticle,
        imageUrl: url,
        imageSearchQuery: editingImageQuery
    });
  };

  const handleInsertImageToContent = (url: string) => {
    const markdown = `\n![](${url})\n`;
    insertText(markdown);
  };

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

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* --- TOP ACTION BAR --- */}
      {currentArticle && (
        <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0 z-30">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
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
                    onClick={handleSave}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                    <Save size={16} />
                    保存
                </button>

                <button
                    onClick={handleCopyMarkdown}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                    <Copy size={16} />
                    复制 MD
                </button>

                <button
                    id="copy-wx-btn"
                    onClick={handleCopyToWeChat}
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
                          {/* Title with 'wx-title' class */}
                          <h1 className="text-[22px] font-bold text-[#333] leading-[1.4] mb-4 wx-title">
                            {editedTitle || "无标题"}
                          </h1>
                          
                          {/* Metadata with 'wx-meta' class */}
                          <div className="flex items-center gap-2 text-[15px] text-[rgba(0,0,0,0.3)] mb-6 wx-meta">
                              <span className="text-[#576b95] font-medium cursor-pointer wx-meta-item">AI 编辑部</span>
                              <span className="text-[rgba(0,0,0,0.3)] wx-meta-item">{formatDate(currentArticle.createdAt)}</span>
                          </div>

                          {/* Cover Image with 'wx-cover' class */}
                          <div 
                            className="mb-6 rounded-[4px] overflow-hidden aspect-[2.35/1] relative bg-gray-100 group cursor-zoom-in wx-cover" 
                            onClick={() => currentArticle.imageUrl && setIsImageModalOpen(true)}
                          >
                              {currentArticle.imageUrl ? (
                                  <>
                                      <img 
                                          src={currentArticle.imageUrl} 
                                          alt="Cover" 
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 ui-overlay">
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
                          
                          {/* Summary Block with 'wx-summary' class */}
                          {editedSummary && (
                              <section className="mb-8 p-4 bg-[#f7f7f7] text-[14px] text-[#666] leading-6 rounded-[4px] border border-[#eee] wx-summary">
                                  <span className="font-bold text-[#333] mr-2 wx-summary-title">摘要</span>
                                  {editedSummary}
                              </section>
                          )}
                          
                          {/* Main Content Render with wrapper class */}
                          <div className="wx-article-content">
                             <MarkdownRenderer content={editedContent} />
                          </div>
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
                          <div className="space-y-2">
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
                            <div className="relative">
                                <Ban size={12} className="absolute top-2.5 left-2 text-red-300"/>
                                <input 
                                  type="text" 
                                  value={negativeImageQuery}
                                  onChange={(e) => setNegativeImageQuery(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleImageSearch()}
                                  className="w-full text-xs border border-gray-200 rounded-lg pl-6 pr-2 py-2 outline-none focus:border-red-400 transition-colors text-gray-600 placeholder-gray-400"
                                  placeholder="排除关键词 (例如: 模糊, 水印)..."
                                />
                            </div>
                          </div>

                          {imageCandidates.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                  {imageCandidates.map((url, idx) => (
                                      <div 
                                        key={idx}
                                        className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                                            currentArticle.imageUrl === url ? "border-emerald-500 ring-2 ring-emerald-200" : "border-transparent hover:border-gray-300"
                                        }`}
                                      >
                                          <img src={url} alt="Candidate" className="w-full h-full object-cover"/>
                                          
                                          {/* Current Cover Badge */}
                                          {currentArticle.imageUrl === url && (
                                              <div className="absolute top-1 left-1 bg-emerald-500/90 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm z-10 backdrop-blur-sm">
                                                  封面
                                              </div>
                                          )}

                                          {/* Hover Actions */}
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                                              <button 
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleSelectImage(url);
                                                  }}
                                                  className={`w-full py-1 text-xs font-bold rounded shadow-sm transition-colors ${
                                                      currentArticle.imageUrl === url 
                                                      ? "bg-emerald-100 text-emerald-700 cursor-default"
                                                      : "bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-600"
                                                  }`}
                                                  disabled={currentArticle.imageUrl === url}
                                              >
                                                  {currentArticle.imageUrl === url ? "当前封面" : "设为封面"}
                                              </button>
                                              <button 
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleInsertImageToContent(url);
                                                  }}
                                                  className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow-sm transition-colors flex items-center justify-center gap-1"
                                              >
                                                  <PlusCircle size={10} /> 插入正文
                                              </button>
                                          </div>
                                      </div>
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