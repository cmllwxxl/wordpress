'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSiteStore } from '@/lib/store';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ArrowLeft, LineChart, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, Minus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TrackedKeyword {
    id: string;
    site_id: string;
    keyword: string;
    source: string;
    created_at: string;
}

interface RankingHistory {
    site_id: string;
    keyword: string;
    source: string;
    position: number;
    impressions: number;
    clicks: number;
    recorded_date: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function KeywordRankingPage() {
    const { sites } = useSiteStore();
    const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
    const [rankingHistory, setRankingHistory] = useState<RankingHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

    // Filters
    const [filterSite, setFilterSite] = useState<string>('');
    const [filterSource, setFilterSource] = useState<string>('');
    const [dateRange, setDateRange] = useState(30); // days

    // Add keyword modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [newSiteId, setNewSiteId] = useState('');
    const [newSource, setNewSource] = useState<'google' | 'bing'>('google');
    const [addLoading, setAddLoading] = useState(false);

    // Search suggestions
    const [existingKeywords, setExistingKeywords] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const canSync = isSupabaseConfigured();

    // Fetch tracked keywords
    const fetchTrackedKeywords = async () => {
        if (!canSync) return;
        try {
            const { data, error } = await supabase
                .from('tracked_keywords')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setTrackedKeywords(data);
                // Auto-select first 5 for chart
                const initial = new Set(data.slice(0, 5).map((k: TrackedKeyword) => k.id));
                setSelectedKeywords(initial);
            }
        } catch (e) {
            console.error('Failed to fetch tracked keywords:', e);
        }
    };

    // Fetch ranking history for tracked keywords
    const fetchRankingHistory = async () => {
        if (!canSync || trackedKeywords.length === 0) return;
        setLoading(true);
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - dateRange);

            const { data, error } = await supabase
                .from('keyword_ranking_history')
                .select('*')
                .gte('recorded_date', startDate.toISOString().split('T')[0])
                .order('recorded_date', { ascending: true });

            if (error) throw error;
            if (data) setRankingHistory(data);
        } catch (e) {
            console.error('Failed to fetch ranking history:', e);
        } finally {
            setLoading(false);
        }
    };

    // Fetch existing keywords from search_queries for suggestions
    const fetchExistingKeywords = async () => {
        if (!canSync) return;
        try {
            const { data, error } = await supabase
                .from('search_queries')
                .select('site_id, source, query, position, impressions')
                .order('impressions', { ascending: false })
                .limit(500);

            if (error) throw error;
            if (data) setExistingKeywords(data);
        } catch (e) {
            console.error('Failed to fetch existing keywords:', e);
        }
    };

    useEffect(() => {
        fetchTrackedKeywords();
        fetchExistingKeywords();
    }, []);

    useEffect(() => {
        if (trackedKeywords.length > 0) {
            fetchRankingHistory();
        }
    }, [trackedKeywords, dateRange]);

    // Add tracked keyword
    const addTrackedKeyword = async () => {
        if (!newKeyword.trim() || !newSiteId) return;
        setAddLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                alert('请先登录');
                return;
            }

            const { error } = await supabase
                .from('tracked_keywords')
                .insert({
                    site_id: newSiteId,
                    keyword: newKeyword.trim(),
                    source: newSource,
                    user_id: session.user.id
                });

            if (error) {
                if (error.code === '23505') {
                    alert('该关键词已在追踪列表中');
                } else {
                    throw error;
                }
            } else {
                await fetchTrackedKeywords();
                setNewKeyword('');
                setShowAddModal(false);
            }
        } catch (e: any) {
            console.error('Failed to add keyword:', e);
            alert('添加失败: ' + e.message);
        } finally {
            setAddLoading(false);
        }
    };

    // Delete tracked keyword
    const deleteTrackedKeyword = async (id: string) => {
        if (!confirm('确定要停止追踪此关键词吗？')) return;
        try {
            const { error } = await supabase
                .from('tracked_keywords')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTrackedKeywords(prev => prev.filter(k => k.id !== id));
            setSelectedKeywords(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (e) {
            console.error('Failed to delete keyword:', e);
        }
    };

    // Toggle keyword selection for chart
    const toggleKeywordSelection = (id: string) => {
        setSelectedKeywords(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Prepare chart data
    const chartData = useMemo(() => {
        const selectedKws = trackedKeywords.filter(k => selectedKeywords.has(k.id));
        if (selectedKws.length === 0) return [];

        // Group by date
        const dateMap: Record<string, any> = {};

        rankingHistory.forEach(h => {
            const kw = selectedKws.find(k =>
                k.site_id === h.site_id &&
                k.keyword === h.keyword &&
                k.source === h.source
            );
            if (!kw) return;

            if (!dateMap[h.recorded_date]) {
                dateMap[h.recorded_date] = { date: h.recorded_date };
            }
            dateMap[h.recorded_date][kw.id] = h.position;
        });

        return Object.values(dateMap).sort((a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [trackedKeywords, rankingHistory, selectedKeywords]);

    // Calculate ranking change
    const getRankingChange = (keyword: TrackedKeyword) => {
        const history = rankingHistory.filter(h =>
            h.site_id === keyword.site_id &&
            h.keyword === keyword.keyword &&
            h.source === keyword.source
        ).sort((a, b) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime());

        if (history.length < 2) return null;

        const current = history[0]?.position;
        const previous = history[1]?.position;
        if (current == null || previous == null) return null;

        return previous - current; // Positive = improved (lower rank number is better)
    };

    // Get current position
    const getCurrentPosition = (keyword: TrackedKeyword) => {
        const history = rankingHistory.filter(h =>
            h.site_id === keyword.site_id &&
            h.keyword === keyword.keyword &&
            h.source === keyword.source
        ).sort((a, b) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime());

        return history[0]?.position;
    };

    // Filter suggestions
    const filteredSuggestions = useMemo(() => {
        if (!newKeyword.trim()) return [];
        const term = newKeyword.toLowerCase();
        return existingKeywords
            .filter(k => k.query.toLowerCase().includes(term))
            .filter(k => !newSiteId || k.site_id === newSiteId)
            .slice(0, 10);
    }, [existingKeywords, newKeyword, newSiteId]);

    // Filtered tracked keywords
    const filteredTrackedKeywords = useMemo(() => {
        return trackedKeywords.filter(k => {
            if (filterSite && k.site_id !== filterSite) return false;
            if (filterSource && k.source !== filterSource) return false;
            return true;
        });
    }, [trackedKeywords, filterSite, filterSource]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/webmaster/keywords"
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                                <LineChart className="w-7 h-7" />
                                关键词排名追踪
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                                追踪关键词排名变化趋势
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(Number(e.target.value))}
                            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm"
                        >
                            <option value={7}>最近 7 天</option>
                            <option value={30}>最近 30 天</option>
                            <option value={90}>最近 90 天</option>
                            <option value={365}>最近 365 天</option>
                        </select>

                        <button
                            onClick={() => {
                                setNewSiteId(sites[0]?.id || '');
                                setShowAddModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            添加关键词
                        </button>
                    </div>
                </header>

                {/* Chart */}
                {chartData.length > 0 && selectedKeywords.size > 0 && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8">
                        <h2 className="text-lg font-semibold mb-4">排名趋势图</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <RechartsLineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(d) => new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis
                                    reversed
                                    domain={[1, 'auto']}
                                    tick={{ fontSize: 12 }}
                                    label={{ value: '排名', angle: -90, position: 'insideLeft', fontSize: 12 }}
                                />
                                <Tooltip
                                    formatter={(value: any, name: string) => [value?.toFixed(1), trackedKeywords.find(k => k.id === name)?.keyword]}
                                    labelFormatter={(d) => new Date(d).toLocaleDateString('zh-CN')}
                                />
                                <Legend
                                    formatter={(value) => trackedKeywords.find(k => k.id === value)?.keyword || value}
                                />
                                {trackedKeywords
                                    .filter(k => selectedKeywords.has(k.id))
                                    .map((k, i) => (
                                        <Line
                                            key={k.id}
                                            type="monotone"
                                            dataKey={k.id}
                                            stroke={COLORS[i % COLORS.length]}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    ))
                                }
                            </RechartsLineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <select
                        value={filterSite}
                        onChange={(e) => setFilterSite(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm"
                    >
                        <option value="">所有站点</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm"
                    >
                        <option value="">所有来源</option>
                        <option value="google">Google</option>
                        <option value="bing">Bing</option>
                    </select>
                    <span className="text-sm text-zinc-500">
                        共 {filteredTrackedKeywords.length} 个追踪关键词
                    </span>
                </div>

                {/* Keywords Table */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    {filteredTrackedKeywords.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500 w-10">
                                        <input
                                            type="checkbox"
                                            checked={filteredTrackedKeywords.every(k => selectedKeywords.has(k.id))}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedKeywords(new Set(filteredTrackedKeywords.map(k => k.id)));
                                                } else {
                                                    setSelectedKeywords(new Set());
                                                }
                                            }}
                                            className="rounded"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500">关键词</th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500">站点</th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-500">来源</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-500">当前排名</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-500">变化</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-500">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {filteredTrackedKeywords.map((k, index) => {
                                    const currentPos = getCurrentPosition(k);
                                    const change = getRankingChange(k);
                                    const site = sites.find(s => s.id === k.site_id);

                                    return (
                                        <tr key={k.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedKeywords.has(k.id)}
                                                    onChange={() => toggleKeywordSelection(k.id)}
                                                    className="rounded"
                                                    style={{ accentColor: COLORS[index % COLORS.length] }}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                    />
                                                    {k.keyword}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                                {site?.name || '未知站点'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={clsx(
                                                    "px-2 py-0.5 rounded text-xs font-medium",
                                                    k.source === 'google' ? "bg-blue-50 text-blue-600" : "bg-cyan-50 text-cyan-600"
                                                )}>
                                                    {k.source}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {currentPos != null ? currentPos.toFixed(1) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {change != null ? (
                                                    <span className={clsx(
                                                        "flex items-center justify-end gap-1 font-medium",
                                                        change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-zinc-400"
                                                    )}>
                                                        {change > 0 ? <TrendingUp className="w-4 h-4" /> :
                                                            change < 0 ? <TrendingDown className="w-4 h-4" /> :
                                                                <Minus className="w-4 h-4" />}
                                                        {Math.abs(change).toFixed(1)}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => deleteTrackedKeyword(k.id)}
                                                    className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-16">
                            <LineChart className="w-12 h-12 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                                暂无追踪关键词
                            </h3>
                            <p className="text-zinc-500 mb-6">
                                添加您想要追踪排名的关键词
                            </p>
                            <button
                                onClick={() => {
                                    setNewSiteId(sites[0]?.id || '');
                                    setShowAddModal(true);
                                }}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                添加关键词
                            </button>
                        </div>
                    )}
                </div>

                {/* Add Keyword Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">添加追踪关键词</h2>
                                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">站点</label>
                                    <select
                                        value={newSiteId}
                                        onChange={(e) => setNewSiteId(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-transparent"
                                    >
                                        <option value="">选择站点</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">来源</label>
                                    <div className="flex gap-3">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="source"
                                                value="google"
                                                checked={newSource === 'google'}
                                                onChange={() => setNewSource('google')}
                                            />
                                            Google
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="source"
                                                value="bing"
                                                checked={newSource === 'bing'}
                                                onChange={() => setNewSource('bing')}
                                            />
                                            Bing
                                        </label>
                                    </div>
                                </div>

                                <div className="relative">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">关键词</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                        <input
                                            type="text"
                                            value={newKeyword}
                                            onChange={(e) => {
                                                setNewKeyword(e.target.value);
                                                setShowSuggestions(true);
                                            }}
                                            onFocus={() => setShowSuggestions(true)}
                                            placeholder="输入关键词或从已采集中选择"
                                            className="w-full pl-10 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-transparent"
                                        />
                                    </div>

                                    {/* Suggestions dropdown */}
                                    {showSuggestions && filteredSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {filteredSuggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        setNewKeyword(s.query);
                                                        setNewSiteId(s.site_id);
                                                        setNewSource(s.source);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-between text-sm"
                                                >
                                                    <span>{s.query}</span>
                                                    <span className="text-zinc-400 text-xs">
                                                        排名: {s.position?.toFixed(1) || '-'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={addTrackedKeyword}
                                    disabled={addLoading || !newKeyword.trim() || !newSiteId}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {addLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    添加
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
