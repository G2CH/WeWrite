import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const html = useMemo(() => {
    // Configure marked
    marked.setOptions({
      breaks: true, // Enable GFM line breaks
      gfm: true,
    });
    
    // Parse
    let parsed = marked.parse(content || "");
    
    // Safety check since parse can return Promise in async mode (though default is sync)
    if (typeof parsed !== 'string') return "";
    
    return parsed;
  }, [content]);

  return (
    <div 
      className="wx-article"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};