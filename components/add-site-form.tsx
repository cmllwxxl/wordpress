'use client';

import { useSiteStore } from '@/lib/store';
import { useState } from 'react';
import { Plus, List, Type } from 'lucide-react';
import { clsx } from 'clsx';

export function AddSiteForm() {
  const { addSite, addSites } = useSiteStore();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'wordpress' | 'custom'>('wordpress');
  const [batchUrls, setBatchUrls] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const formatUrl = (inputUrl: string) => {
    let formatted = inputUrl.trim();
    if (!formatted) return '';
    if (!formatted.startsWith('http')) {
      formatted = `https://${formatted}`;
    }
    return formatted;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'single') {
      if (!url) return;
      const formattedUrl = formatUrl(url);
      addSite({
        name: name || new URL(formattedUrl).hostname,
        url: formattedUrl,
        type: type,
        tags: type === 'custom' ? ['自建站'] : []
      });
    } else {
      if (!batchUrls) return;
      const urls = batchUrls.split('\n').filter(u => u.trim());
      const sitesToAdd = urls.map(u => {
        const formatted = formatUrl(u);
        return {
          name: new URL(formatted).hostname,
          url: formatted,
          type: type,
          tags: type === 'custom' ? ['自建站'] : []
        };
      });
      addSites(sitesToAdd);
    }
    
    // Reset form
    setUrl('');
    setName('');
    setBatchUrls('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
      >
        <Plus className="w-4 h-4" />
        添加新网站
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-4 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={clsx(
            "text-sm font-medium flex items-center gap-2 pb-2 -mb-2.5 border-b-2 transition-colors",
            mode === 'single' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          <Type className="w-4 h-4" />
          单个添加
        </button>
        <button
          type="button"
          onClick={() => setMode('batch')}
          className={clsx(
            "text-sm font-medium flex items-center gap-2 pb-2 -mb-2.5 border-b-2 transition-colors",
            mode === 'batch' 
              ? "border-blue-600 text-blue-600" 
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          )}
        >
          <List className="w-4 h-4" />
          批量导入
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">网站类型</label>
            <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="radio" 
                        name="siteType" 
                        value="wordpress" 
                        checked={type === 'wordpress'} 
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">WordPress</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="radio" 
                        name="siteType" 
                        value="custom" 
                        checked={type === 'custom'} 
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">自建站/其他</span>
                </label>
            </div>
        </div>

        {mode === 'single' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">网站地址 (URL)</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">网站名称 (可选)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="我的博客"
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              批量输入网址 (每行一个)
            </label>
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder="https://site1.com&#10;https://site2.com&#10;example.org"
              className="w-full px-3 py-2 h-32 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              required
            />
            <p className="text-xs text-zinc-500 mt-1">系统将自动获取域名作为网站名称</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {mode === 'single' ? '添加网站' : '批量导入'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
