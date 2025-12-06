'use client';

import { useSiteStore } from '@/lib/store';
import { useWebmasterStore } from '@/lib/webmaster-store';
import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Gauge, Monitor, Smartphone, Zap, Eye, Shield, Search, ChevronDown, ChevronUp, ExternalLink, Settings, Save, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { clsx } from 'clsx';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface PageSpeedResult {
    url: string;
    fetchTime: string;
    strategy: 'mobile' | 'desktop';
    scores: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
    metrics: {
        firstContentfulPaint: string;
        largestContentfulPaint: string;
        totalBlockingTime: string;
        cumulativeLayoutShift: string;
        speedIndex: string;
        timeToInteractive: string;
    };
    screenshot?: string;
}

interface SiteResult {
    siteId: string;
    siteName: string;
    siteUrl: string;
    mobile?: PageSpeedResult;
    desktop?: PageSpeedResult;
    loading: boolean;
    error?: string;
}

// Get color based on score
const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
};

const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
    return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800';
};

const getScoreRingColor = (score: number) => {
    if (score >= 90) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
};

// Circular progress component
const ScoreCircle = ({ score, size = 80, label }: { score: number; size?: number; label: string }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        fill="none"
                        className="text-zinc-200 dark:text-zinc-700"
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={getScoreRingColor(score)}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={clsx("text-xl font-bold", getScoreColor(score))}>{score}</span>
                </div>
            </div>
            <span className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
        </div>
    );
};

export default function PageSpeedPage() {
    const { sites } = useSiteStore();
    const { pageSpeedApiKey, setPageSpeedApiKey } = useWebmasterStore();
    const [results, setResults] = useState<Record<string, SiteResult>>({});
    const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');
    const [isCheckingAll, setIsCheckingAll] = useState(false);
    const [expandedSite, setExpandedSite] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [tempApiKey, setTempApiKey] = useState(pageSpeedApiKey);
    const [lastSync, setLastSync] = useState<number | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load cached data on mount
    useEffect(() => {
        if (isSupabaseConfigured() && sites.length > 0) {
            loadFromCache();
        }
    }, [sites]);

    // Load data from Supabase cache
    const loadFromCache = async () => {
        if (!isSupabaseConfigured()) return;

        try {
            const { data: cachedData, error } = await supabase
                .from('pagespeed_cache')
                .select('*');

            if (error) {
                console.error('Failed to load pagespeed cache:', error);
                return;
            }

            if (cachedData && cachedData.length > 0) {
                const loadedResults: Record<string, SiteResult> = {};
                let maxSync = 0;

                cachedData.forEach((row: any) => {
                    const site = sites.find(s => s.id === row.site_id);
                    if (site) {
                        loadedResults[site.id] = {
                            siteId: site.id,
                            siteName: site.name,
                            siteUrl: site.url,
                            mobile: row.mobile_data || undefined,
                            desktop: row.desktop_data || undefined,
                            loading: false
                        };
                        if (row.last_sync > maxSync) maxSync = row.last_sync;
                    }
                });

                if (Object.keys(loadedResults).length > 0) {
                    setResults(loadedResults);
                    if (maxSync > 0) setLastSync(maxSync);
                }
            }
        } catch (err) {
            console.error('Error loading cache:', err);
        }
    };

    // Sync data to Supabase
    const syncToCache = async (siteId: string, mobile?: PageSpeedResult, desktop?: PageSpeedResult) => {
        if (!isSupabaseConfigured()) return;

        setIsSyncing(true);
        const timestamp = Date.now();

        try {
            const { error } = await supabase
                .from('pagespeed_cache')
                .upsert({
                    site_id: siteId,
                    mobile_data: mobile || null,
                    desktop_data: desktop || null,
                    last_sync: timestamp,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('Failed to sync pagespeed cache:', error);
            } else {
                setLastSync(timestamp);
            }
        } catch (err) {
            console.error('Error syncing cache:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    const checkSite = async (siteId: string, url: string, siteName: string) => {
        setResults(prev => ({
            ...prev,
            [siteId]: {
                ...prev[siteId],
                siteId,
                siteName,
                siteUrl: url,
                loading: true,
                error: undefined
            }
        }));

        try {
            const response = await axios.post('/api/monitor/pagespeed', {
                url,
                strategy,
                apiKey: pageSpeedApiKey || undefined
            });

            const newResult = response.data;

            setResults(prev => {
                const updated = {
                    ...prev,
                    [siteId]: {
                        ...prev[siteId],
                        [strategy]: newResult,
                        loading: false
                    }
                };

                // Sync to cache with both mobile and desktop data
                const siteResult = updated[siteId];
                syncToCache(siteId, siteResult.mobile, siteResult.desktop);

                return updated;
            });
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || '检测失败';
            // Check for quota exceeded error
            const isQuotaError = errorMsg.includes('Quota exceeded') || errorMsg.includes('quota');
            setResults(prev => ({
                ...prev,
                [siteId]: {
                    ...prev[siteId],
                    loading: false,
                    error: isQuotaError ? '配额已用完，请配置 API Key' : errorMsg
                }
            }));
            // Show settings if quota exceeded
            if (isQuotaError && !pageSpeedApiKey) {
                setShowSettings(true);
            }
        }
    };

    const checkAllSites = async () => {
        if (isCheckingAll) return;
        setIsCheckingAll(true);

        // Process one at a time to avoid rate limiting
        for (const site of sites) {
            await checkSite(site.id, site.url, site.name);
            // Add delay between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        setIsCheckingAll(false);
    };

    // Calculate averages
    const completedResults = Object.values(results).filter(r => r[strategy] && !r.loading && !r.error);
    const avgPerformance = completedResults.length > 0
        ? Math.round(completedResults.reduce((acc, r) => acc + (r[strategy]?.scores.performance || 0), 0) / completedResults.length)
        : 0;
    const avgSeo = completedResults.length > 0
        ? Math.round(completedResults.reduce((acc, r) => acc + (r[strategy]?.scores.seo || 0), 0) / completedResults.length)
        : 0;

    const saveApiKey = () => {
        setPageSpeedApiKey(tempApiKey);
        setShowSettings(false);
        alert('API Key 已保存');
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                                <Gauge className="w-8 h-8" />
                                PageSpeed Insights
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-3">
                                网站性能与SEO检测
                                {isSupabaseConfigured() && (
                                    <span className={clsx(
                                        "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                                        lastSync
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                    )}>
                                        {isSyncing ? (
                                            <>
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                同步中...
                                            </>
                                        ) : lastSync ? (
                                            <>
                                                <Cloud className="w-3 h-3" />
                                                {new Date(lastSync).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </>
                                        ) : (
                                            <>
                                                <CloudOff className="w-3 h-3" />
                                                未同步
                                            </>
                                        )}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Strategy Toggle */}
                        <div className="flex bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1">
                            <button
                                onClick={() => setStrategy('mobile')}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                    strategy === 'mobile'
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                )}
                            >
                                <Smartphone className="w-4 h-4" />
                                移动端
                            </button>
                            <button
                                onClick={() => setStrategy('desktop')}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                                    strategy === 'desktop'
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                )}
                            >
                                <Monitor className="w-4 h-4" />
                                桌面端
                            </button>
                        </div>

                        <button
                            onClick={checkAllSites}
                            disabled={isCheckingAll || sites.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity font-medium text-sm disabled:opacity-50"
                        >
                            <RefreshCw className={clsx("w-4 h-4", isCheckingAll && "animate-spin")} />
                            {isCheckingAll ? '检测中...' : '检测全部'}
                        </button>

                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={clsx(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                                pageSpeedApiKey
                                    ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                                    : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                            )}
                            title="API Key 设置"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Settings Panel */}
                {showSettings && (
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            API Key 配置
                        </h2>

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800 dark:text-amber-300">
                                    <p className="font-medium mb-1">为什么需要 API Key？</p>
                                    <p>Google PageSpeed Insights API 免费配额为每天 400 次请求（共享配额）。配置自己的 API Key 后可获得每天 25,000 次请求配额。</p>
                                    <a
                                        href="https://developers.google.com/speed/docs/insights/v5/get-started"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 mt-2 text-amber-700 dark:text-amber-400 hover:underline"
                                    >
                                        如何获取 API Key
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                placeholder="输入 Google Cloud API Key"
                                className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <button
                                onClick={saveApiKey}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                保存
                            </button>
                        </div>

                        {pageSpeedApiKey && (
                            <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                                ✓ API Key 已配置
                            </p>
                        )}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-zinc-500">已检测站点</h3>
                            <Gauge className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                            {completedResults.length}
                            <span className="text-sm text-zinc-400 font-normal ml-2">/ {sites.length}</span>
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-zinc-500">平均性能分</h3>
                            <Zap className="w-5 h-5 text-amber-500" />
                        </div>
                        <p className={clsx("text-3xl font-bold", avgPerformance > 0 ? getScoreColor(avgPerformance) : "text-zinc-400")}>
                            {avgPerformance > 0 ? avgPerformance : '-'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-zinc-500">平均SEO分</h3>
                            <Search className="w-5 h-5 text-green-500" />
                        </div>
                        <p className={clsx("text-3xl font-bold", avgSeo > 0 ? getScoreColor(avgSeo) : "text-zinc-400")}>
                            {avgSeo > 0 ? avgSeo : '-'}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-zinc-500">当前模式</h3>
                            {strategy === 'mobile' ? <Smartphone className="w-5 h-5 text-purple-500" /> : <Monitor className="w-5 h-5 text-purple-500" />}
                        </div>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                            {strategy === 'mobile' ? '移动端' : '桌面端'}
                        </p>
                    </div>
                </div>

                {/* Sites List */}
                <div className="space-y-4">
                    {sites.map(site => {
                        const result = results[site.id];
                        const currentResult = result?.[strategy];
                        const isLoading = result?.loading;
                        const isExpanded = expandedSite === site.id;

                        return (
                            <div key={site.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                {/* Site Header */}
                                <div className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <h3 className="font-semibold text-zinc-900 dark:text-white">{site.name}</h3>
                                                <a
                                                    href={site.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sm text-zinc-500 hover:text-blue-600 flex items-center gap-1"
                                                >
                                                    {site.url}
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* Scores Preview */}
                                            {currentResult && !isLoading && (
                                                <div className="hidden md:flex items-center gap-6">
                                                    <div className="text-center">
                                                        <div className={clsx("text-2xl font-bold", getScoreColor(currentResult.scores.performance))}>
                                                            {currentResult.scores.performance}
                                                        </div>
                                                        <div className="text-xs text-zinc-500">性能</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className={clsx("text-2xl font-bold", getScoreColor(currentResult.scores.seo))}>
                                                            {currentResult.scores.seo}
                                                        </div>
                                                        <div className="text-xs text-zinc-500">SEO</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className={clsx("text-2xl font-bold", getScoreColor(currentResult.scores.accessibility))}>
                                                            {currentResult.scores.accessibility}
                                                        </div>
                                                        <div className="text-xs text-zinc-500">无障碍</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className={clsx("text-2xl font-bold", getScoreColor(currentResult.scores.bestPractices))}>
                                                            {currentResult.scores.bestPractices}
                                                        </div>
                                                        <div className="text-xs text-zinc-500">最佳实践</div>
                                                    </div>
                                                </div>
                                            )}

                                            {result?.error && (
                                                <span className="text-sm text-red-500">{result.error}</span>
                                            )}

                                            {isLoading && (
                                                <div className="flex items-center gap-2 text-zinc-500">
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    <span className="text-sm">检测中...</span>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => checkSite(site.id, site.url, site.name)}
                                                    disabled={isLoading}
                                                    className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                    title="检测"
                                                >
                                                    <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
                                                </button>
                                                {currentResult && (
                                                    <button
                                                        onClick={() => setExpandedSite(isExpanded ? null : site.id)}
                                                        className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && currentResult && (
                                    <div className="border-t border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50 dark:bg-zinc-950">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {/* Score Circles */}
                                            <div>
                                                <h4 className="text-sm font-medium text-zinc-500 mb-4">评分概览</h4>
                                                <div className="flex justify-around items-center">
                                                    <ScoreCircle score={currentResult.scores.performance} label="性能" />
                                                    <ScoreCircle score={currentResult.scores.accessibility} label="无障碍" />
                                                    <ScoreCircle score={currentResult.scores.bestPractices} label="最佳实践" />
                                                    <ScoreCircle score={currentResult.scores.seo} label="SEO" />
                                                </div>
                                            </div>

                                            {/* Core Web Vitals */}
                                            <div>
                                                <h4 className="text-sm font-medium text-zinc-500 mb-4">核心性能指标</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500 mb-1">首次内容绘制 (FCP)</div>
                                                        <div className="font-semibold text-zinc-900 dark:text-white">{currentResult.metrics.firstContentfulPaint}</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500 mb-1">最大内容绘制 (LCP)</div>
                                                        <div className="font-semibold text-zinc-900 dark:text-white">{currentResult.metrics.largestContentfulPaint}</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500 mb-1">总阻塞时间 (TBT)</div>
                                                        <div className="font-semibold text-zinc-900 dark:text-white">{currentResult.metrics.totalBlockingTime}</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500 mb-1">累积布局偏移 (CLS)</div>
                                                        <div className="font-semibold text-zinc-900 dark:text-white">{currentResult.metrics.cumulativeLayoutShift}</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500 mb-1">速度指数</div>
                                                        <div className="font-semibold text-zinc-900 dark:text-white">{currentResult.metrics.speedIndex}</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500 mb-1">可交互时间 (TTI)</div>
                                                        <div className="font-semibold text-zinc-900 dark:text-white">{currentResult.metrics.timeToInteractive}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Screenshot */}
                                        {currentResult.screenshot && (
                                            <div className="mt-6">
                                                <h4 className="text-sm font-medium text-zinc-500 mb-4">页面截图</h4>
                                                <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-block">
                                                    <img
                                                        src={currentResult.screenshot}
                                                        alt="Page screenshot"
                                                        className="max-h-64 rounded"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Footer */}
                                        <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
                                            <span>检测时间: {new Date(currentResult.fetchTime).toLocaleString()}</span>
                                            <a
                                                href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(site.url)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1 hover:text-blue-600"
                                            >
                                                在 PageSpeed Insights 中查看详情
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {sites.length === 0 && (
                        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800">
                            <p className="text-zinc-500">暂无站点，请先添加网站。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
