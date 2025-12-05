'use client';

import { useState, useEffect } from 'react';
import { useSiteStore, Site } from '@/lib/store';
import { useWebmasterStore } from '@/lib/webmaster-store';
import { ArrowLeft, Settings, Search, BarChart2, RefreshCw, ExternalLink, Save, AlertCircle, ChevronDown, ChevronUp, Globe, Calendar, Check, Copy, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import axios from 'axios';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Helper to normalize URLs for comparison (strip protocol, www, trailing slash)
const normalizeUrl = (url: string) => {
    if (!url) return '';
    return url
        .toLowerCase()
        .replace(/\/+$/, '')
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '');
};

// Helper to parse Bing date format "/Date(1722841200000-0700)/" -> "YYYY-MM-DD"
const parseBingDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'string') {
        const m = value.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
        if (m && m[1]) {
            const ts = parseInt(m[1], 10);
            if (!isNaN(ts)) return new Date(ts).toISOString().split('T')[0];
        }
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }
    return null;
};

export default function WebmasterPage() {
  const { sites } = useSiteStore();
  const { googleJson, bingApiKey, googleProxy, setGoogleJson, setBingApiKey, setGoogleProxy } = useWebmasterStore();
  
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');
  const [activeTab, setActiveTab] = useState<'google' | 'bing'>('google');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  
  // Overview State
  const [overviewData, setOverviewData] = useState<{site: Site, google?: any, bing?: any}[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewSortBy, setOverviewSortBy] = useState<'site' | 'google_clicks' | 'google_impressions' | 'bing_clicks' | 'bing_impressions' | 'total_clicks' | 'total_impressions'>('total_clicks');
  const [overviewSortOrder, setOverviewSortOrder] = useState<'asc' | 'desc'>('desc');

  // Date Range State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedRange, setSelectedRange] = useState('30');
  
  // Credentials State (local for editing)
  const [tempGoogleJson, setTempGoogleJson] = useState('');
  const [tempBingApiKey, setTempBingApiKey] = useState('');
  const [tempGoogleProxy, setTempGoogleProxy] = useState('');

  // Hydrate credentials
  useEffect(() => {
    setTempGoogleJson(googleJson);
    setTempBingApiKey(bingApiKey);
    setTempGoogleProxy(googleProxy);
  }, [googleJson, bingApiKey, googleProxy]);

  // Select first site by default if not set
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const handleSaveSettings = () => {
    setGoogleJson(tempGoogleJson);
    setBingApiKey(tempBingApiKey);
    setGoogleProxy(tempGoogleProxy);
    setShowSettings(false);
    setVerifyResult(null); 
    alert('设置已保存');
  };

  const toggleOverviewSort = (key: 'site' | 'google_clicks' | 'google_impressions' | 'bing_clicks' | 'bing_impressions' | 'total_clicks' | 'total_impressions') => {
    setOverviewSortBy(key);
    setOverviewSortOrder(prev => key === overviewSortBy ? (prev === 'asc' ? 'desc' : 'asc') : (key === 'site' ? 'asc' : 'desc'));
  };

  const renderOverviewSortIcon = (key: 'site' | 'google_clicks' | 'google_impressions' | 'bing_clicks' | 'bing_impressions' | 'total_clicks' | 'total_impressions') => {
    if (overviewSortBy !== key) return null;
    return overviewSortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />;
  };

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    const days = parseInt(value);
    if (!isNaN(days) && days > 0) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const verifyGoogleAccess = async () => {
    if (!tempGoogleJson) {
        alert('请先输入 JSON 配置');
        return;
    }
    setLoading(true);
    setError(null);
    setVerifyResult(null);
    try {
        const res = await axios.post('/api/webmaster/google', {
            serviceAccountJson: tempGoogleJson,
            proxyUrl: tempGoogleProxy,
            action: 'list_sites'
        });
        setVerifyResult(res.data);
    } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || err.message || '验证失败');
    } finally {
        setLoading(false);
    }
  };

  const [querySortKey, setQuerySortKey] = useState<string>('clicks');
  const [querySortOrder, setQuerySortOrder] = useState<'asc' | 'desc'>('desc');
  const toggleQuerySort = (key: string) => {
    setQuerySortKey(key);
    setQuerySortOrder(prev => key === querySortKey ? (prev === 'asc' ? 'desc' : 'asc') : ((key === 'position' || key === 'AvgImpressionPosition') ? 'asc' : 'desc'));
  };
  const renderQuerySortIcon = (key: string) => {
    if (querySortKey !== key) return null;
    return querySortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const syncToCache = async (results: any[]) => {
    if (!isSupabaseConfigured()) return;
    const timestamp = Date.now();
    const updates = results.map(item => ({
        site_id: item.site.id,
        overview_data: { google: item.google, bing: item.bing },
        last_sync: timestamp,
        updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from('webmaster_cache').upsert(updates);
    if (error) console.error('Failed to sync cache:', error);
    else setLastSync(timestamp);
  };

  const fetchFromCache = async () => {
    if (!isSupabaseConfigured()) return false;
    const { data: cachedData, error } = await supabase.from('webmaster_cache').select('*');
    if (error || !cachedData) return false;

    const results = cachedData.map((row: any) => {
        const site = sites.find(s => s.id === row.site_id);
        if (!site) return null;
        return { site, google: row.overview_data?.google, bing: row.overview_data?.bing };
    }).filter(Boolean);

    if (results.length > 0) {
        setOverviewData(results as any);
        const maxSync = Math.max(...cachedData.map((d: any) => d.last_sync || 0));
        if (maxSync > 0) setLastSync(maxSync);
        return true;
    }
    return false;
  };

  const fetchOverviewData = async (forceApi = false) => {
      if (sites.length === 0) return;
      
      // Try cache first if not forced and we have no data
      if (!forceApi && overviewData.length === 0) {
          setOverviewLoading(true);
          const hit = await fetchFromCache();
          setOverviewLoading(false);
          if (hit) return;
      }

      setOverviewLoading(true);
      setOverviewData([]); // Clear previous
      
      // 1. Pre-fetch Bing Sites for URL normalization
      let bingUrlMap: Record<string, string> = {};
      if (bingApiKey) {
          try {
             const userSitesRes = await axios.post('/api/webmaster/bing', {
                apiKey: bingApiKey,
                action: 'GetUserSites'
              });
              const userSites = userSitesRes.data.d || userSitesRes.data || [];
              if (Array.isArray(userSites)) {
                  userSites.forEach((s: any) => {
                      if (s.Url) {
                          // Normalize: remove trailing slashes, lowercase, protocol, www
                          const norm = normalizeUrl(s.Url);
                          // Store mapping from normalized -> actual Bing URL
                          // If multiple map to same norm (unlikely with verified sites?), last one wins
                          bingUrlMap[norm] = s.Url;
                      }
                  });
              }
          } catch (e) {
              console.warn('Failed to fetch Bing user sites list', e);
          }
      }

      const results = [];
      
      // Process sequentially to avoid rate limits, or parallel with limit?
      // Let's do batches of 3
      const batchSize = 3;
      for (let i = 0; i < sites.length; i += batchSize) {
          const batch = sites.slice(i, i + batchSize);
          const batchPromises = batch.map(async (site) => {
              let googleData = null;
              let bingData = null;

              // Fetch Google Totals
              if (googleJson) {
                  try {
                      const res = await axios.post('/api/webmaster/google', {
                          serviceAccountJson: googleJson,
                          siteUrl: site.url,
                          startDate,
                          endDate,
                          dimensions: [],
                          proxyUrl: googleProxy
                      });
                      if (res.data && res.data.rows && res.data.rows.length > 0) {
                          googleData = res.data.rows[0];
                      }
                  } catch (e) {
                      console.warn(`Failed to fetch Google overview for ${site.url}`, e);
                  }
              }

              // Fetch Bing Totals
              if (bingApiKey) {
                  // Find correct Bing URL
                  const normSiteUrl = normalizeUrl(site.url);
                  const bingSiteUrl = bingUrlMap[normSiteUrl];
                  
                  if (bingSiteUrl) {
                    try {
                        // Use GetRankAndTrafficStats and sum up
                        const trafficRes = await axios.post('/api/webmaster/bing', {
                            apiKey: bingApiKey,
                            siteUrl: bingSiteUrl,
                            action: 'GetRankAndTrafficStats'
                        });
                        
                        // Bing Traffic Stats might need filtering by date range on client side
                        // as the API returns all history (or last 6 months)
                        let chartData = trafficRes.data.d || [];

                        // Ensure chartData is an array
                        if (!Array.isArray(chartData) && trafficRes.data && Array.isArray(trafficRes.data)) {
                            chartData = trafficRes.data;
                        } else if (!Array.isArray(chartData)) {
                            chartData = [];
                        }
                        
                        // Filter by date and sum
                        let clicks = 0;
                        let impressions = 0;
                        
                        // Ensure chartData is an array before iterating
                        if (Array.isArray(chartData)) {
                            chartData.forEach((item: any) => {
                                const dateStr = parseBingDate(item.Date);
                                if (dateStr && dateStr >= startDate && dateStr <= endDate) {
                                    clicks += item.Clicks || 0;
                                    impressions += item.Impressions || 0;
                                }
                            });
                        }
                        
                        bingData = { clicks, impressions };
                    } catch (e) {
                        console.warn(`Failed to fetch Bing overview for ${site.url}`, e);
                    }
                  } else {
                      // Site not verified in Bing, skip silently or log
                      // console.debug(`Site ${site.url} not found in Bing verified sites.`);
                  }
              }

              return { site, google: googleData, bing: bingData };
          });
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
      }
      
      setOverviewData(results);
      syncToCache(results);
      setOverviewLoading(false);
  };

  useEffect(() => {
      if (viewMode === 'overview') {
          fetchOverviewData();
      }
  }, [startDate, endDate, googleJson, bingApiKey, sites]);

  const fetchGoogleData = async () => {
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;
    if (!googleJson) {
      setError('请先配置 Google Service Account JSON');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch Chart Data (By Date)
      const chartRes = await axios.post('/api/webmaster/google', {
        serviceAccountJson: googleJson,
        siteUrl: site.url,
        startDate,
        endDate,
        dimensions: ['date'],
        proxyUrl: googleProxy
      });

      // Fetch Table Data (By Query)
      const queryRes = await axios.post('/api/webmaster/google', {
        serviceAccountJson: googleJson,
        siteUrl: site.url,
        startDate,
        endDate,
        dimensions: ['query'],
        proxyUrl: googleProxy
      });

      // Normalize Google data to have a 'date' field
      const normalizedChartData = (chartRes.data.rows || []).map((row: any) => ({
        ...row,
        date: row.keys[0]
      }));

      // Sort by date just in case
      normalizedChartData.sort((a: any, b: any) => a.date.localeCompare(b.date));

      setData({
        chart: normalizedChartData,
        queries: queryRes.data.rows || []
      });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch Google data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBingData = async () => {
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;
    if (!bingApiKey) {
      setError('请先配置 Bing API Key');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Verify site and get correct URL format from Bing
      const userSitesRes = await axios.post('/api/webmaster/bing', {
        apiKey: bingApiKey,
        action: 'GetUserSites'
      });

      const userSites = userSitesRes.data.d || userSitesRes.data || [];
      if (!Array.isArray(userSites)) {
          throw new Error('Failed to retrieve sites list from Bing. Please check your API Key.');
      }

      // Normalize URLs for comparison (remove trailing slashes, protocol, www)
      const normalizedTargetUrl = normalizeUrl(site.url);
      
      const matchedSite = userSites.find((s: any) => {
          const sUrl = normalizeUrl(s.Url || '');
          return sUrl === normalizedTargetUrl;
      });

      if (!matchedSite) {
          throw new Error(`Site "${site.url}" is not verified in Bing Webmaster Tools. Found: ${userSites.map((s: any) => s.Url).join(', ')}`);
      }

      const correctSiteUrl = matchedSite.Url;
      console.log('Bing Site Verified:', correctSiteUrl);

      // Fetch Query Stats
      const queryRes = await axios.post('/api/webmaster/bing', {
        apiKey: bingApiKey,
        siteUrl: correctSiteUrl,
        action: 'GetQueryStats'
      });

      // Fetch Traffic Stats (for chart)
      const trafficRes = await axios.post('/api/webmaster/bing', {
        apiKey: bingApiKey,
        siteUrl: correctSiteUrl,
        action: 'GetRankAndTrafficStats'
      });

      // Bing Traffic Stats might need filtering by date range on client side
      // as the API returns all history (or last 6 months)
      let chartData = trafficRes.data.d || [];
      
      // Ensure chartData is an array (API might return null or different structure if no data)
      if (!Array.isArray(chartData)) {
          // Fallback for safety
          chartData = [];
          if (trafficRes.data && Array.isArray(trafficRes.data)) {
              chartData = trafficRes.data;
          }
      }

      chartData = chartData.map((item: any) => {
        const dateStr = parseBingDate(item.Date) || new Date().toISOString().split('T')[0];
        return {
            ...item,
            date: dateStr,
            clicks: item.Clicks,
            impressions: item.Impressions
        };
      });

      // Filter by selected range
      chartData = chartData.filter((item: any) => {
          return item.date >= startDate && item.date <= endDate;
      });
      
      // Sort by date
      chartData.sort((a: any, b: any) => a.date.localeCompare(b.date));

      // Handle query stats
      let queryData = queryRes.data.d || [];
      if (!Array.isArray(queryData) && queryRes.data && Array.isArray(queryRes.data)) {
          queryData = queryRes.data;
      }
      
      // Log processed data
      console.log('Processed Bing Data:', { chartCount: chartData.length, queryCount: queryData.length });

      setData({
        queries: queryData,
        chart: chartData
      });
    } catch (err: any) {
        console.error('Frontend Error:', err);
        console.error('Error Details:', err.response?.data);
      setError(err.response?.data?.message || err.message || 'Failed to fetch Bing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'detail') {
        setData(null);
        setError(null);
    }
  }, [selectedSiteId, activeTab, viewMode]);

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify_between gap-4 mb-8">
          <div className="flex items_center gap-4">
            <Link 
                href="/"
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                    <BarChart2 className="w-8 h-8" />
                    Webmaster Tools
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                    集成 Google Search Console 和 Bing Webmaster Tools
                </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'overview' && (
                <>
                    {lastSync && (
                        <div className="hidden md:flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mr-2">
                            <Check className="w-3 h-3" />
                            {new Date(lastSync).toLocaleString()}
                        </div>
                    )}
                    <button
                        onClick={() => fetchOverviewData(true)}
                        disabled={overviewLoading}
                        className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        title="刷新数据"
                    >
                        <RefreshCw className={`w-4 h-4 ${overviewLoading ? 'animate-spin' : ''}`} />
                    </button>
                </>
            )}
            <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items_center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
                <Settings className="w-4 h-4" />
                {showSettings ? '隐藏配置' : '配置凭证'}
            </button>
            <Link
            href="/webmaster/keywords"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            关键词采集
          </Link>
          </div>
        </header>

        {showSettings && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-8 shadow-sm animate-in fade-in slide-in-from-top-4">
                {/* ... Settings Content Same as Before ... */}
                 <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    API 凭证配置
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                            Google Service Account JSON
                        </label>
                        <textarea
                            value={tempGoogleJson}
                            onChange={(e) => setTempGoogleJson(e.target.value)}
                            placeholder='{"type": "service_account", ...}'
                            className="w-full h-48 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-xs resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <div className="mt-3">
                            <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                                Google 代理地址
                            </label>
                            <input
                                type="text"
                                value={tempGoogleProxy}
                                onChange={(e) => setTempGoogleProxy(e.target.value)}
                                placeholder="http://127.0.0.1:7890"
                                className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={verifyGoogleAccess}
                                disabled={loading}
                                className="text-xs flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
                            >
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                验证权限
                            </button>
                            <p className="text-xs text-zinc-500">
                                需将 client_email 添加到 GSC 用户列表
                            </p>
                        </div>

                        {verifyResult && (
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs">
                                <div className="flex items-center gap-2 mb-2">
                                    <Check className="w-4 h-4 text-green-600" />
                                    <span className="font-medium text-green-700 dark:text-green-400">验证成功</span>
                                </div>
                                <div className="mb-2">
                                    <span className="text-zinc-500">服务账号邮箱：</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <code className="bg-white dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 block flex-1 overflow-hidden text-ellipsis">
                                            {verifyResult.serviceAccountEmail}
                                        </code>
                                        <button 
                                            onClick={() => copyToClipboard(verifyResult.serviceAccountEmail)}
                                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                                            title="复制邮箱"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-zinc-500">可访问站点 ({verifyResult.sites.length})：</span>
                                    <div className="max-h-32 overflow-y-auto mt-1 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900">
                                        {verifyResult.sites.length > 0 ? (
                                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {verifyResult.sites.map((s: any) => (
                                                    <li key={s.siteUrl} className="px-2 py-1 truncate text-zinc-700 dark:text-zinc-300">
                                                        {s.siteUrl} <span className="text-zinc-400 text-[10px]">({s.permissionLevel})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="p-2 text-zinc-400 italic">暂无权限访问任何站点，请前往 GSC 添加上述邮箱。</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300">
                            Bing API Key
                        </label>
                        <input
                            type="text"
                            value={tempBingApiKey}
                            onChange={(e) => setTempBingApiKey(e.target.value)}
                            placeholder="Bing Webmaster API Key"
                            className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                         <p className="text-xs text-zinc-500 mt-1">
                            请在 Bing Webmaster Tools 设置中生成 API Key。
                        </p>
                        <div className="mt-4">
                            <button
                                onClick={handleSaveSettings}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                保存配置
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center p-4 gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                
                {/* Mode Switcher */}
                <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('overview')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                            viewMode === 'overview'
                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        全站概览
                    </button>
                    <button
                        onClick={() => setViewMode('detail')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                            viewMode === 'detail'
                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                    >
                        <BarChart2 className="w-4 h-4" />
                        单站详情
                    </button>
                </div>

                {viewMode === 'detail' && (
                    <>
                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Globe className="w-4 h-4 text-zinc-500 shrink-0" />
                            <select
                                value={selectedSiteId}
                                onChange={(e) => setSelectedSiteId(e.target.value)}
                                className="bg-transparent font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer hover:text-blue-600 max-w-[200px] truncate"
                            >
                                <option value="" disabled>选择站点</option>
                                {sites.map(site => (
                                    <option key={site.id} value={site.id}>{site.name} ({site.url})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => setActiveTab('google')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                    activeTab === 'google' 
                                    ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' 
                                    : 'text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                                }`}
                            >
                                Google Search Console
                            </button>
                            <button
                                onClick={() => setActiveTab('bing')}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                    activeTab === 'bing' 
                                    ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' 
                                    : 'text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                                }`}
                            >
                                Bing Webmaster
                            </button>
                        </div>
                    </>
                )}

                <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
                     <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">
                        <Calendar className="w-4 h-4 text-zinc-400" />
                        <select 
                            value={selectedRange} 
                            onChange={(e) => handleRangeChange(e.target.value)}
                            className="bg-transparent text-xs border-none focus:ring-0 p-0 w-20 font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer outline-none"
                        >
                            <option value="3">近3天</option>
                            <option value="7">近7天</option>
                            <option value="30">近30天</option>
                            <option value="90">近3个月</option>
                            <option value="custom">自定义</option>
                        </select>
                        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setSelectedRange('custom');
                            }}
                            className="bg-transparent text-xs border-none focus:ring-0 p-0 w-24"
                        />
                        <span className="text-zinc-400">-</span>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setSelectedRange('custom');
                            }}
                            className="bg-transparent text-xs border-none focus:ring-0 p-0 w-24"
                        />
                    </div>

                    {viewMode === 'detail' && (
                        <button
                            onClick={activeTab === 'google' ? fetchGoogleData : fetchBingData}
                            disabled={loading || !selectedSiteId}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            查询
                        </button>
                    )}
                    {viewMode === 'overview' && (
                        <button
                            onClick={() => fetchOverviewData(true)}
                            disabled={overviewLoading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                            <RefreshCw className={`w-4 h-4 ${overviewLoading ? 'animate-spin' : ''}`} />
                            刷新
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6">
                {viewMode === 'overview' ? (
                    <div>
                        {overviewLoading && overviewData.length === 0 ? (
                            <div className="text-center py-20 text-zinc-500">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                                <p>正在获取所有站点数据...</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                <th onClick={() => toggleOverviewSort('site')} className="px-6 py-4 font-medium text-zinc-500 w-[25%] cursor-pointer select-none">站点信息 {renderOverviewSortIcon('site')}</th>
                                                <th onClick={() => toggleOverviewSort('google_clicks')} className="px-6 py-4 font-medium text-zinc-500 w-[15%] text-right cursor-pointer select-none">Google 点击 {renderOverviewSortIcon('google_clicks')}</th>
                                                <th onClick={() => toggleOverviewSort('google_impressions')} className="px-6 py-4 font-medium text-zinc-500 w-[15%] text-right cursor-pointer select-none">Google 展示 {renderOverviewSortIcon('google_impressions')}</th>
                                                <th onClick={() => toggleOverviewSort('bing_clicks')} className="px-6 py-4 font-medium text-zinc-500 w-[15%] text-right cursor-pointer select-none">Bing 点击 {renderOverviewSortIcon('bing_clicks')}</th>
                                                <th onClick={() => toggleOverviewSort('bing_impressions')} className="px-6 py-4 font-medium text-zinc-500 w-[15%] text-right cursor-pointer select-none">Bing 展示 {renderOverviewSortIcon('bing_impressions')}</th>
                                                <th className="px-6 py-4 font-medium text-zinc-500 w-[15%] text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {[...overviewData].sort((a, b) => {
                                                const order = overviewSortOrder === 'asc' ? 1 : -1;
                                                const val = (o: { site: Site, google?: any, bing?: any }) => {
                                                    switch (overviewSortBy) {
                                                        case 'site': return o.site.name || '';
                                                        case 'google_clicks': return o.google?.clicks || 0;
                                                        case 'google_impressions': return o.google?.impressions || 0;
                                                        case 'bing_clicks': return o.bing?.clicks || 0;
                                                        case 'bing_impressions': return o.bing?.impressions || 0;
                                                        case 'total_clicks': return (o.google?.clicks || 0) + (o.bing?.clicks || 0);
                                                        case 'total_impressions': return (o.google?.impressions || 0) + (o.bing?.impressions || 0);
                                                    }
                                                };
                                                const aVal = val(a);
                                                const bVal = val(b);
                                                if (typeof aVal === 'string' || typeof bVal === 'string') {
                                                    return (String(aVal).localeCompare(String(bVal))) * order;
                                                }
                                                return ((aVal as number) - (bVal as number)) * order;
                                            }).map(({ site, google, bing }) => (
                                                <tr key={site.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={site.name}>{site.name}</div>
                                                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-blue-500 truncate block max-w-[200px] flex items-center gap-1">
                                                            {site.url}
                                                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </a>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {google ? (
                                                            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{google.clicks?.toLocaleString()}</span>
                                                        ) : <span className="text-zinc-300">-</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {google ? (
                                                            <span className="font-mono text-zinc-600 dark:text-zinc-400">{google.impressions?.toLocaleString()}</span>
                                                        ) : <span className="text-zinc-300">-</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {bing ? (
                                                            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{bing.clicks?.toLocaleString()}</span>
                                                        ) : <span className="text-zinc-300">-</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {bing ? (
                                                            <span className="font-mono text-zinc-600 dark:text-zinc-400">{bing.impressions?.toLocaleString()}</span>
                                                        ) : <span className="text-zinc-300">-</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedSiteId(site.id);
                                                                setViewMode('detail');
                                                            }}
                                                            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded text-xs transition-colors"
                                                        >
                                                            详情
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            
                                            {overviewData.length === 0 && !overviewLoading && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                                                        暂无站点数据，请先添加站点或检查 API 凭证。
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg flex items-center gap-2 mb-6">
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </div>
                        )}

                        {!data && !loading && !error && (
                            <div className="text-center py-20 text-zinc-500">
                                <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>请选择站点并点击查询以获取数据</p>
                                {!googleJson && activeTab === 'google' && (
                                     <p className="text-xs mt-2 text-amber-600">提示：尚未配置 Google 凭证</p>
                                )}
                                {!bingApiKey && activeTab === 'bing' && (
                                     <p className="text-xs mt-2 text-amber-600">提示：尚未配置 Bing 凭证</p>
                                )}
                            </div>
                        )}

                        {data?.chart && data.chart.length > 0 ? (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold mb-4">
                                    流量趋势 ({activeTab === 'google' ? 'Google' : 'Bing'})
                                </h3>
                                <div className="h-80 w-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800 p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.chart}>
                                            <defs>
                                                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                            <XAxis 
                                                dataKey="date"
                                                tickFormatter={(value) => {
                                                    try {
                                                        return new Date(value).toLocaleDateString();
                                                    } catch (e) {
                                                        return value;
                                                    }
                                                }}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                            />
                                            <Legend />
                                            <Area yAxisId="left" type="monotone" dataKey="clicks" name="点击量" stroke="#3b82f6" fillOpacity={1} fill="url(#colorClicks)" />
                                            <Area yAxisId="right" type="monotone" dataKey="impressions" name="展示量" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorImp)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ) : data?.chart && (
                            <div className="mb-8 p-8 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                                <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>该时间段内暂无流量数据</p>
                            </div>
                        )}

                        {data?.queries && (
                            <div>
                                <h3 className="text-lg font-semibold mb-4">热门搜索词</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-zinc-500">关键词</th>
                                                {activeTab === 'google' ? (
                                                    <>
                                                        <th onClick={() => toggleQuerySort('clicks')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">点击量 {renderQuerySortIcon('clicks')}</th>
                                                        <th onClick={() => toggleQuerySort('impressions')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">展示量 {renderQuerySortIcon('impressions')}</th>
                                                        <th onClick={() => toggleQuerySort('ctr')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">CTR {renderQuerySortIcon('ctr')}</th>
                                                        <th onClick={() => toggleQuerySort('position')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">排名 {renderQuerySortIcon('position')}</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th onClick={() => toggleQuerySort('Impressions')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">展示量 {renderQuerySortIcon('Impressions')}</th>
                                                        <th onClick={() => toggleQuerySort('Clicks')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">点击量 {renderQuerySortIcon('Clicks')}</th>
                                                        <th onClick={() => toggleQuerySort('AvgImpressionPosition')} className="px-4 py-3 font-medium text-zinc-500 text-right cursor-pointer select-none">位置 {renderQuerySortIcon('AvgImpressionPosition')}</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {[...data.queries].sort((a: any, b: any) => {
                                                const order = querySortOrder === 'asc' ? 1 : -1;
                                                const val = (r: any) => {
                                                    if (activeTab === 'google') {
                                                        switch (querySortKey) {
                                                            case 'clicks': return r.clicks || 0;
                                                            case 'impressions': return r.impressions || 0;
                                                            case 'ctr': return r.ctr || 0;
                                                            case 'position': return r.position || 0;
                                                        }
                                                    } else {
                                                        switch (querySortKey) {
                                                            case 'Impressions': return r.Impressions || 0;
                                                            case 'Clicks': return r.Clicks || 0;
                                                            case 'AvgImpressionPosition': return r.AvgImpressionPosition || 0;
                                                        }
                                                    }
                                                    return 0;
                                                };
                                                return (val(a) - val(b)) * order;
                                            }).slice(0, 50).map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                                        {activeTab === 'google' ? row.keys[0] : row.Query}
                                                    </td>
                                                    {activeTab === 'google' ? (
                                                        <>
                                                            <td className="px-4 py-3 text-right">{row.clicks}</td>
                                                            <td className="px-4 py-3 text-right">{row.impressions}</td>
                                                            <td className="px-4 py-3 text-right">{(row.ctr * 100).toFixed(2)}%</td>
                                                            <td className="px-4 py-3 text-right">{row.position.toFixed(1)}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                             <td className="px-4 py-3 text-right">{row.Impressions}</td>
                                                             <td className="px-4 py-3 text-right">{row.Clicks}</td>
                                                             <td className="px-4 py-3 text-right">{row.AvgImpressionPosition || '-'}</td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
