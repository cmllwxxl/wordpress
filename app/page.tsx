'use client';

import { AddSiteForm } from '@/components/add-site-form';
import { SiteCard } from '@/components/site-card';
import { SettingsModal } from '@/components/settings-modal';
import { AuthButton } from '@/components/auth-button';
import { useSiteStore } from '@/lib/store';
import { useWebmasterStore } from '@/lib/webmaster-store';
import axios from 'axios';
import { useEffect, useState, useMemo } from 'react';
import { LayoutDashboard, Bell, BarChart3, Database, AlertTriangle, Key, Globe, Tag, FilterX, Clock, RefreshCw, ExternalLink, Check, Plus, List, Search } from 'lucide-react';
import Link from 'next/link';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// DnD Kit
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from '@dnd-kit/sortable';

export default function Home() {
  const { sites, fetchSites, isLoading, setUser, error, reorderSites, addSite } = useSiteStore();
  const { bingApiKey } = useWebmasterStore();
  const [mounted, setMounted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Bing Importer State
  const [bingLoading, setBingLoading] = useState(false);
  const [bingError, setBingError] = useState<string | null>(null);
  const [showBingImporter, setShowBingImporter] = useState(false);
  const [bingSites, setBingSites] = useState<Array<{ url: string; name: string; type: 'wordpress' | 'custom'; added?: boolean }>>([]);

  const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');
  const existingSet = useMemo(() => new Set(sites.map(s => normalizeUrl(s.url))), [sites]);

  const fetchBingVerifiedSites = async () => {
    if (!bingApiKey) {
      setBingError('请先在 Webmaster Tools 中配置 Bing API Key');
      setShowBingImporter(true);
      return;
    }
    setBingLoading(true);
    setBingError(null);
    try {
      const res = await axios.post('/api/webmaster/bing', {
        apiKey: bingApiKey,
        action: 'GetUserSites'
      });
      const raw = res.data.d || res.data || [];
      if (!Array.isArray(raw)) {
        throw new Error('返回的数据格式不正确');
      }
      const items = raw
        .filter((s: any) => s.Url)
        .map((s: any) => {
          const url = s.Url as string;
          let formatted = url;
          if (!/^https?:\/\//.test(formatted)) formatted = `https://${formatted}`;
          let host = '';
          try { host = new URL(formatted).hostname; } catch { host = formatted; }
          return { url: formatted.replace(/\/+$/, '/'), name: host, type: 'wordpress' as const };
        });
      setBingSites(items);
      setShowBingImporter(true);
    } catch (e: any) {
      setBingError(e.response?.data?.message || e.message || '获取 Bing 站点失败');
    } finally {
      setBingLoading(false);
    }
  };

  const updateBingSiteType = (index: number, type: 'wordpress' | 'custom') => {
    setBingSites(prev => prev.map((it, i) => i === index ? { ...it, type } : it));
  };

  const addBingSite = async (index: number) => {
    const item = bingSites[index];
    if (!item) return;
    const norm = normalizeUrl(item.url);
    if (existingSet.has(norm)) {
      setBingSites(prev => prev.map((it, i) => i === index ? { ...it, added: true } : it));
      return;
    }
    await addSite({
      name: item.name,
      url: item.url.replace(/\/+$/, ''),
      type: item.type,
      tags: item.type === 'custom' ? ['自建站'] : []
    });
    setBingSites(prev => prev.map((it, i) => i === index ? { ...it, added: true } : it));
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (isSupabaseConfigured()) {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchSites();
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchSites();
            }
        });

        return () => subscription.unsubscribe();
    }
  }, []);

  const allTags = useMemo(() => {
      const tags = new Set<string>();
      sites.forEach(site => {
          (site.tags || []).forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
  }, [sites]);

  const filteredSites = useMemo(() => {
      if (!activeTag) return sites;
      return sites.filter(site => (site.tags || []).includes(activeTag));
  }, [sites, activeTag]);

  const handleDragStart = (event: any) => {
      setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = sites.findIndex((site) => site.id === active.id);
      const newIndex = sites.findIndex((site) => site.id === over.id);
      
      const newSites = arrayMove(sites, oldIndex, newIndex);
      reorderSites(newSites);
    }
    setActiveId(null);
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <LayoutDashboard className="w-8 h-8" />
              WordPress 管理平台
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
              一站式管理您的所有 WordPress 网站。
              {isSupabaseConfigured() && (
                <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                    <Database className="w-3 h-3" />
                    云同步已开启
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/credentials"
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="凭证管理"
            >
              <Key className="w-5 h-5" />
            </Link>
            <Link
              href="/analytics"
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="数据大屏"
            >
              <BarChart3 className="w-5 h-5" />
            </Link>
            <Link
              href="/webmaster"
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Webmaster Tools"
            >
              <Globe className="w-5 h-5" />
            </Link>
            <Link
              href="/webmaster/keywords"
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="关键词采集"
            >
              <Search className="w-5 h-5" />
            </Link>
            <Link
              href="/uptime-monitor"
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Uptime Monitor"
            >
              <Clock className="w-5 h-5" />
            </Link>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="通知设置"
            >
              <Bell className="w-5 h-5" />
            </button>
            {isSupabaseConfigured() && <AuthButton />}
            <button
              onClick={() => setShowBingImporter(true)}
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="从 Bing 拉取站点"
            >
              <List className="w-5 h-5" />
            </button>
            <AddSiteForm />
          </div>
        </header>

        {/* Bing Importer */}
        {showBingImporter && (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              <span className="font-medium">从 Bing 站长工具快捷添加网站</span>
              {bingLoading && <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchBingVerifiedSites}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                disabled={bingLoading}
                title="拉取 Bing 已验证站点"
              >
                拉取站点
              </button>
              <button
                onClick={() => setShowBingImporter(false)}
                className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                关闭
              </button>
            </div>
          </div>
          {bingError && (
            <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-2 rounded">
              {bingError}
            </div>
          )}
          {showBingImporter && bingSites.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-3 py-2 text-left">站点</th>
                    <th className="px-3 py-2 text-left">类型</th>
                    <th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {bingSites.map((s, i) => {
                    const exists = existingSet.has(normalizeUrl(s.url));
                    return (
                      <tr key={s.url} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            {s.name}
                            <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-blue-600 flex items-center gap-1">
                              {s.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={s.type}
                            onChange={(e) => updateBingSiteType(i, e.target.value as any)}
                            className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
                          >
                            <option value="wordpress">WordPress</option>
                            <option value="custom">自建站/其他</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {exists || s.added ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs"><Check className="w-3 h-3" /> 已添加</span>
                          ) : (
                            <button
                              onClick={() => addBingSite(i)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> 添加
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-medium text-red-900 dark:text-red-300">数据同步错误</h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                    {error.includes('relation') && error.includes('does not exist') && (
                        <p className="text-sm text-red-700 dark:text-red-400 mt-2">
                            提示：您的 Supabase 数据库可能尚未初始化。请在 Supabase SQL 编辑器中运行项目提供的初始化脚本。
                        </p>
                    )}
                </div>
            </div>
        )}

        {/* Tag Filters */}
        {allTags.length > 0 && (
            <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                <button
                    onClick={() => setActiveTag(null)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        activeTag === null
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    全部
                </button>
                {allTags.map(tag => (
                    <button
                        key={tag}
                        onClick={() => setActiveTag(tag)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                            activeTag === tag
                                ? "bg-blue-600 text-white"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        }`}
                    >
                        <Tag className="w-3.5 h-3.5" />
                        {tag}
                    </button>
                ))}
                {activeTag && (
                    <button 
                        onClick={() => setActiveTag(null)}
                        className="ml-auto text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
                    >
                        <FilterX className="w-3 h-3" />
                        清除筛选
                    </button>
                )}
            </div>
        )}

        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-white dark:bg-zinc-900 rounded-lg animate-pulse" />
                ))}
            </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800">
            <div className="max-w-sm mx-auto text-zinc-500">
              <p className="text-lg mb-2">尚未连接任何网站。</p>
              <p className="text-sm">添加您的第一个 WordPress 网站以开始使用。</p>
            </div>
          </div>
        ) : (
            <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <SortableContext 
                    items={filteredSites.map(s => s.id)}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSites.map((site) => (
                            <SiteCard key={site.id} site={site} />
                        ))}
                    </div>
                </SortableContext>
                
                {/* Drag Overlay for smoother visual feedback */}
                <DragOverlay>
                    {activeId ? (
                        <div className="opacity-80">
                             <SiteCard site={sites.find(s => s.id === activeId)!} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        )}

        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </div>
    </main>
  );
}
