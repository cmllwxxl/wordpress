'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSiteStore } from '@/lib/store';
import { useWebmasterStore } from '@/lib/webmaster-store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import axios from 'axios';
import { BarChart2, RefreshCw, Globe, Check, AlertCircle, Layout, Filter, ChevronDown, ChevronUp, MousePointer2, Eye, Hash, ArrowLeft, LineChart } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';

export default function KeywordsCollectorPage() {
  const { sites } = useSiteStore();
  const { googleJson, googleProxy, bingApiKey } = useWebmasterStore();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [useGoogle, setUseGoogle] = useState(true);
  const [useBing, setUseBing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords'>('overview');
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'impressions' | 'clicks' | 'ctr' | 'position'>('impressions');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterSite, setFilterSite] = useState<string>('');

  const normalizeUrl = (url: string) => url.toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '');

  const canSync = isSupabaseConfigured();

  const fetchData = async () => {
    if (!canSync) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.warn('User not authenticated, skipping fetch');
        return;
      }

      const { data, error } = await supabase
        .from('search_queries')
        .select('*')
        .eq('user_id', session.user.id)
        .order('impressions', { ascending: false });

      if (error) throw error;

      if (data) {
        setRows(data);
      }
    } catch (e: any) {
      console.error('Failed to fetch keywords:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 监听认证状态变化，确保 session 恢复后重新获取数据
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        fetchData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const collectAndSync = async () => {
    setLoading(true);
    setError(null);
    let syncCount = 0;
    let historyCount = 0;

    try {
      let bingMap: Record<string, string> = {};
      if (useBing && bingApiKey) {
        try {
          const res = await axios.post('/api/webmaster/bing', { apiKey: bingApiKey, action: 'GetUserSites' });
          const list = res.data.d || res.data || [];
          if (Array.isArray(list)) {
            list.forEach((s: any) => {
              if (s.Url) bingMap[normalizeUrl(s.Url)] = s.Url;
            });
          }
        } catch (e) {
          console.warn('Bing sites fetch failed:', e);
        }
      }

      const out: any[] = [];

      for (const site of sites) {
        if (useGoogle && googleJson) {
          try {
            const g = await axios.post('/api/webmaster/google', {
              serviceAccountJson: googleJson,
              siteUrl: site.url,
              startDate,
              endDate,
              dimensions: ['query'],
              proxyUrl: googleProxy
            });
            const rows = g.data.rows || [];
            rows.forEach((r: any) => {
              out.push({
                site_id: site.id,
                site_name: site.name,
                source: 'google',
                query: r.keys[0],
                impressions: r.impressions || 0,
                clicks: r.clicks || 0,
                ctr: r.ctr || 0,
                position: r.position || null
              });
            });
          } catch (e: any) {
            console.warn(`Google fetch failed for ${site.name}:`, e);
          }
        }

        if (useBing && bingApiKey) {
          const norm = normalizeUrl(site.url);
          const bingUrl = bingMap[norm];
          if (bingUrl) {
            try {
              const b = await axios.post('/api/webmaster/bing', {
                apiKey: bingApiKey,
                siteUrl: bingUrl,
                action: 'GetQueryStats'
              });
              const rows = b.data.d || b.data || [];
              if (Array.isArray(rows)) {
                rows.forEach((r: any) => {
                  out.push({
                    site_id: site.id,
                    site_name: site.name,
                    source: 'bing',
                    query: r.Query,
                    impressions: r.Impressions || 0,
                    clicks: r.Clicks || 0,
                    ctr: null,
                    position: r.AvgImpressionPosition || null
                  });
                });
              }
            } catch (e: any) {
              console.warn(`Bing fetch failed for ${site.name}:`, e);
            }
          }
        }
      }

      const dedup: Record<string, any> = {};
      out.forEach((r) => {
        const key = `${r.site_id}|${r.source}|${r.query}`;
        const prev = dedup[key];
        if (!prev) dedup[key] = r;
        else dedup[key] = r.impressions > prev.impressions ? r : prev;
      });

      const sorted = Object.values(dedup).sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0));

      setRows(sorted as any[]);

      if (canSync && sorted.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          console.warn('User not authenticated, skipping Supabase sync');
        } else {
          const BATCH_SIZE = 500;
          for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
            const chunk = sorted.slice(i, i + BATCH_SIZE);
            const payload = chunk.map((r: any) => ({
              site_id: r.site_id,
              source: r.source,
              query: r.query,
              impressions: r.impressions,
              clicks: r.clicks,
              ctr: r.ctr,
              position: r.position,
              last_seen: endDate,
              user_id: session.user.id,
              updated_at: new Date().toISOString() // Force update even if stats are same
            }));

            const { error: upsertError, data: upsertData } = await supabase.from('search_queries').upsert(payload, {
              onConflict: 'user_id,site_id,source,query',
              ignoreDuplicates: false
            }).select(); // Select to confirm return

            if (upsertError) {
              console.error('Sync error:', upsertError);
              throw new Error(`数据库同步失败: ${upsertError.message}`);
            } else {
              console.log(`Upsert success: scanned ${chunk.length} rows`);
            }
            syncCount += chunk.length;
          }

          // Also sync to ranking history for tracked keywords
          try {
            const { data: trackedKws } = await supabase
              .from('tracked_keywords')
              .select('site_id, keyword, source');

            if (trackedKws && trackedKws.length > 0) {
              const today = new Date().toISOString().split('T')[0];
              const historyPayload = sorted
                .filter((r: any) => trackedKws.some((tk: any) =>
                  tk.site_id === r.site_id &&
                  tk.source === r.source &&
                  (tk.keyword === r.query || tk.keyword.toLowerCase().trim() === r.query.toLowerCase().trim())
                ))
                .map((r: any) => {
                  return {
                    site_id: r.site_id,
                    keyword: r.query,
                    source: r.source,
                    position: r.position,
                    impressions: r.impressions,
                    clicks: r.clicks,
                    recorded_date: today,
                    user_id: session.user.id
                  };
                });

              if (historyPayload.length > 0) {
                const { error: historyError } = await supabase
                  .from('keyword_ranking_history')
                  .upsert(historyPayload, {
                    onConflict: 'user_id,site_id,source,keyword,recorded_date',
                    ignoreDuplicates: false
                  });

                if (historyError) {
                  console.error('Ranking history sync error:', historyError);
                } else {
                  historyCount = historyPayload.length;
                }
              }
            }
          } catch (e) {
            console.error('Failed to sync ranking history:', e);
          }
        }
      }

      if (canSync) {
        alert(`采集完成！\n同步搜索词: ${syncCount} 条\n同步排名历史: ${historyCount} 条`);
      } else {
        alert('采集完成 (未配置数据库，仅本地显示)');
      }

    } catch (e: any) {
      setError(e.message || '采集失败');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSite = (siteId: string) => {
    const newSet = new Set(expandedSites);
    if (newSet.has(siteId)) newSet.delete(siteId);
    else newSet.add(siteId);
    setExpandedSites(newSet);
  };

  const stats = useMemo(() => {
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalKeywords = rows.length;
    rows.forEach(r => {
      totalImpressions += r.impressions;
      totalClicks += r.clicks;
    });
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    return { totalImpressions, totalClicks, totalKeywords, avgCtr };
  }, [rows]);

  const grouped = useMemo(() => {
    const m: Record<string, { name: string, keywords: any[], totalImp: number, totalClicks: number }> = {};
    rows.forEach((r) => {
      if (!m[r.site_id]) {
        const s = sites.find(site => site.id === r.site_id);
        m[r.site_id] = { name: s?.name || r.site_name || '未知站点', keywords: [], totalImp: 0, totalClicks: 0 };
      }
      m[r.site_id].keywords.push(r);
      m[r.site_id].totalImp += r.impressions;
      m[r.site_id].totalClicks += r.clicks;
    });
    return Object.entries(m).sort((a, b) => b[1].totalImp - a[1].totalImp);
  }, [rows, sites]);

  const filteredAndSortedRows = useMemo(() => {
    let res = [...rows];
    if (filterSite) {
      res = res.filter(r => r.site_id === filterSite);
    }
    res.sort((a, b) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return res;
  }, [rows, sortBy, sortOrder, filterSite]);

  const handleSort = (key: 'impressions' | 'clicks' | 'ctr' | 'position') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <Link href="/webmaster" className="p-1 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <BarChart2 className="w-7 h-7" />
              关键词采集
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 ml-9 text-sm">
              采集全站搜索词，洞察流量来源与 SEO 机会
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 shadow-sm">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sm outline-none w-28 text-zinc-600 dark:text-zinc-300" />
              <span className="text-zinc-400">-</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sm outline-none w-28 text-zinc-600 dark:text-zinc-300" />
            </div>
            <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={useGoogle} onChange={(e) => setUseGoogle(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                Google
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={useBing} onChange={(e) => setUseBing(e.target.checked)} className="rounded text-blue-600 focus:ring-0" />
                Bing
              </label>
            </div>
            <button
              onClick={collectAndSync}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              采集并同步
            </button>
            <Link
              href="/webmaster/keywords/ranking"
              className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-2 shadow-sm transition-colors"
            >
              <LineChart className="w-4 h-4" />
              排名追踪
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="text-zinc-500 text-xs font-medium mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> 关键词总数</div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalKeywords.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="text-zinc-500 text-xs font-medium mb-1 flex items-center gap-1"><Eye className="w-3 h-3" /> 总展示量</div>
              <div className="text-2xl font-bold text-blue-600">{stats.totalImpressions.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="text-zinc-500 text-xs font-medium mb-1 flex items-center gap-1"><MousePointer2 className="w-3 h-3" /> 总点击量</div>
              <div className="text-2xl font-bold text-green-600">{stats.totalClicks.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="text-zinc-500 text-xs font-medium mb-1 flex items-center gap-1"><BarChart2 className="w-3 h-3" /> 平均 CTR</div>
              <div className="text-2xl font-bold text-purple-600">{(stats.avgCtr * 100).toFixed(2)}%</div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {rows.length > 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'overview' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  <Layout className="w-4 h-4" /> 概览分组
                </button>
                <button
                  onClick={() => setActiveTab('keywords')}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'keywords' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  <Filter className="w-4 h-4" /> 所有关键词
                </button>
              </div>

              {activeTab === 'keywords' && (
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={filterSite}
                    onChange={(e) => setFilterSite(e.target.value)}
                    className="bg-transparent text-sm border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">所有站点</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {activeTab === 'overview' ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {grouped.map(([siteId, data]) => (
                  <div key={siteId} className="group">
                    <button
                      onClick={() => toggleSite(siteId)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1 rounded transition-transform duration-200 ${expandedSites.has(siteId) ? 'rotate-90' : ''}`}>
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">{data.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {data.keywords.length} 个关键词 · {data.totalImp.toLocaleString()} 展示 · {data.totalClicks.toLocaleString()} 点击
                          </div>
                        </div>
                      </div>
                      <div className="text-zinc-400 group-hover:text-blue-600 transition-colors">
                        {expandedSites.has(siteId) ? '收起' : '展开'}
                      </div>
                    </button>

                    {expandedSites.has(siteId) && (
                      <div className="bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 px-6 py-4 animate-in fade-in slide-in-from-top-1">
                        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                              <tr>
                                <th className="px-4 py-2 font-medium text-zinc-500 w-[40%]">关键词</th>
                                <th className="px-4 py-2 font-medium text-zinc-500 text-right">展示量</th>
                                <th className="px-4 py-2 font-medium text-zinc-500 text-right">点击量</th>
                                <th className="px-4 py-2 font-medium text-zinc-500 text-right">CTR</th>
                                <th className="px-4 py-2 font-medium text-zinc-500 text-right">排名</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {data.keywords.slice(0, 50).map((r, i) => (
                                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                  <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-200">{r.query}</td>
                                  <td className="px-4 py-2 text-right text-zinc-600">{r.impressions}</td>
                                  <td className="px-4 py-2 text-right text-zinc-600">{r.clicks}</td>
                                  <td className="px-4 py-2 text-right text-zinc-600">{r.ctr != null ? `${(r.ctr * 100).toFixed(1)}%` : '-'}</td>
                                  <td className="px-4 py-2 text-right text-zinc-600">{r.position != null ? Number(r.position).toFixed(1) : '-'}</td>
                                </tr>
                              ))}
                              {data.keywords.length > 50 && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-2 text-center text-xs text-zinc-400 italic">
                                    仅显示前 50 个关键词，更多请切换至“所有关键词”视图查看。
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-3 font-medium text-zinc-500">站点</th>
                      <th className="px-6 py-3 font-medium text-zinc-500 w-[30%]">关键词</th>
                      <th onClick={() => handleSort('impressions')} className="px-6 py-3 font-medium text-zinc-500 text-right cursor-pointer hover:text-zinc-800 select-none">展示量 {sortBy === 'impressions' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th onClick={() => handleSort('clicks')} className="px-6 py-3 font-medium text-zinc-500 text-right cursor-pointer hover:text-zinc-800 select-none">点击量 {sortBy === 'clicks' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th onClick={() => handleSort('ctr')} className="px-6 py-3 font-medium text-zinc-500 text-right cursor-pointer hover:text-zinc-800 select-none">CTR {sortBy === 'ctr' && (sortOrder === 'desc' ? '↓' : '↑')}</th>
                      <th onClick={() => handleSort('position')} className="px-6 py-3 font-medium text-zinc-500 text-right cursor-pointer hover:text-zinc-800 select-none">排名 {sortBy === 'position' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th className="px-6 py-3 font-medium text-zinc-500 text-right">来源</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredAndSortedRows.slice(0, 1000).map((r, i) => (
                      <tr key={`${r.site_id}-${r.source}-${r.query}-${i}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">
                          {sites.find(s => s.id === r.site_id)?.name || r.site_name || '未知站点'}
                        </td>
                        <td className="px-6 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.query}</td>
                        <td className="px-6 py-3 text-right font-mono">{r.impressions}</td>
                        <td className="px-6 py-3 text-right font-mono">{r.clicks}</td>
                        <td className="px-6 py-3 text-right font-mono">{r.ctr != null ? `${(r.ctr * 100).toFixed(2)}%` : '-'}</td>
                        <td className="px-6 py-3 text-right font-mono">{r.position != null ? Number(r.position).toFixed(1) : '-'}</td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${r.source === 'google' ? 'bg-blue-50 text-blue-600' : 'bg-cyan-50 text-cyan-600'}`}>
                            {r.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-32 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800">
            <Globe className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">暂无关键词数据</h3>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
              点击上方“采集并同步”按钮，从 Google Search Console 和 Bing Webmaster Tools 获取最新的搜索词数据。
            </p>
            <button onClick={collectAndSync} disabled={loading} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2 transition-colors shadow-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              开始采集
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
