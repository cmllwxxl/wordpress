'use client';

import { useSiteStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Globe, AlertTriangle, Play, Pause } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { clsx } from 'clsx';

interface MonitorResult {
  status: 'online' | 'offline' | 'pending';
  latency: number;
  code: number;
  lastChecked: string;
  error?: string;
}

export default function UptimeMonitorPage() {
  const { sites } = useSiteStore();
  const [results, setResults] = useState<Record<string, MonitorResult>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);

  // Initialize results with pending state
  useEffect(() => {
    if (Object.keys(results).length === 0 && sites.length > 0) {
      const initialResults: Record<string, MonitorResult> = {};
      sites.forEach(site => {
        initialResults[site.id] = {
          status: 'pending',
          latency: 0,
          code: 0,
          lastChecked: '-'
        };
      });
      setResults(initialResults);
    }
  }, [sites]);

  const checkSite = async (siteId: string, url: string) => {
    setResults(prev => ({
      ...prev,
      [siteId]: { ...prev[siteId], status: 'pending' }
    }));

    try {
      const response = await axios.post('/api/monitor/check', { url });
      const { status, latency, code, error } = response.data;
      
      setResults(prev => ({
        ...prev,
        [siteId]: {
          status,
          latency,
          code,
          lastChecked: new Date().toLocaleTimeString(),
          error
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [siteId]: {
          status: 'offline',
          latency: 0,
          code: 0,
          lastChecked: new Date().toLocaleTimeString(),
          error: 'Check failed'
        }
      }));
    }
  };

  const checkAll = async () => {
    if (isChecking) return;
    setIsChecking(true);
    
    // Process in batches of 5 to avoid overwhelming the server
    const batchSize = 5;
    const siteList = [...sites];
    
    for (let i = 0; i < siteList.length; i += batchSize) {
      const batch = siteList.slice(i, i + batchSize);
      await Promise.all(batch.map(site => checkSite(site.id, site.url)));
    }
    
    setLastFullCheck(new Date());
    setIsChecking(false);
  };

  // Auto refresh logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(checkAll, 60000); // Check every minute
      if (!lastFullCheck) {
        checkAll();
      }
    }
    return () => clearInterval(interval);
  }, [autoRefresh, sites]); // Re-create interval if sites change

  // Stats
  const onlineCount = Object.values(results).filter(r => r.status === 'online').length;
  const offlineCount = Object.values(results).filter(r => r.status === 'offline').length;
  const avgLatency = Object.values(results)
    .filter(r => r.status === 'online')
    .reduce((acc, curr) => acc + curr.latency, 0) / (onlineCount || 1);

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
                        <Clock className="w-8 h-8" />
                        Uptime Monitor
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        实时网站可用性监控
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium text-sm",
                        autoRefresh 
                            ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400" 
                            : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                    )}
                >
                    {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {autoRefresh ? '自动刷新中' : '开启自动刷新'}
                </button>
                
                <button
                    onClick={checkAll}
                    disabled={isChecking}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
                >
                    <RefreshCw className={clsx("w-4 h-4", isChecking && "animate-spin")} />
                    {isChecking ? '检测中...' : '立即检测'}
                </button>
            </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-500">在线站点</h3>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {onlineCount}
                    <span className="text-sm text-zinc-400 font-normal ml-2">/ {sites.length}</span>
                </p>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-500">离线/异常</h3>
                    <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {offlineCount}
                </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-zinc-500">平均响应时间</h3>
                    <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                    {Math.round(avgLatency)}
                    <span className="text-sm text-zinc-400 font-normal ml-1">ms</span>
                </p>
            </div>
        </div>

        {/* Monitor Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="px-6 py-4 font-medium text-zinc-500 w-[30%]">站点名称</th>
                            <th className="px-6 py-4 font-medium text-zinc-500 w-[15%]">状态</th>
                            <th className="px-6 py-4 font-medium text-zinc-500 w-[15%]">响应时间</th>
                            <th className="px-6 py-4 font-medium text-zinc-500 w-[15%]">状态码</th>
                            <th className="px-6 py-4 font-medium text-zinc-500 w-[15%]">最后检查</th>
                            <th className="px-6 py-4 font-medium text-zinc-500 w-[10%] text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {sites.map(site => {
                            const result = results[site.id] || { status: 'pending', latency: 0, code: 0, lastChecked: '-' };
                            const isOnline = result.status === 'online';
                            const isPending = result.status === 'pending';
                            const isOffline = result.status === 'offline';
                            
                            // Latency color
                            const latencyColor = result.latency < 200 ? 'text-green-600' : result.latency < 500 ? 'text-amber-600' : 'text-red-600';
                            
                            return (
                                <tr key={site.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{site.name}</div>
                                        <a 
                                            href={site.url} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-xs text-zinc-500 hover:text-blue-600 flex items-center gap-1 mt-0.5"
                                        >
                                            {site.url}
                                            <Globe className="w-3 h-3" />
                                        </a>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isPending ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                检测中
                                            </span>
                                        ) : isOnline ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                                <CheckCircle2 className="w-3 h-3" />
                                                在线
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                                                <AlertTriangle className="w-3 h-3" />
                                                离线
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isPending || isOffline ? (
                                            <span className="text-zinc-400">-</span>
                                        ) : (
                                            <span className={`font-mono font-medium ${latencyColor}`}>
                                                {result.latency} ms
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isPending ? (
                                            <span className="text-zinc-400">-</span>
                                        ) : (
                                            <span className="font-mono text-zinc-600 dark:text-zinc-400">
                                                {result.code || '-'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {result.lastChecked}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => checkSite(site.id, site.url)}
                                            disabled={isPending}
                                            className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                                            title="重新检测"
                                        >
                                            <RefreshCw className={clsx("w-4 h-4", isPending && "animate-spin")} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                {sites.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                        <p>暂无站点，请先添加网站。</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
