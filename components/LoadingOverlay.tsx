import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-emerald-200 rounded-full blur-lg opacity-50 animate-pulse"></div>
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin relative z-10" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">AI 思考中...</h3>
        <p className="text-gray-500 text-center">{message}</p>
      </div>
    </div>
  );
};