'use client';

import { useSiteStore } from '@/lib/store';
import { getPostCountsByDate } from '@/lib/api';
import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import Link from 'next/link';
import { clsx } from 'clsx';

interface ChartData {
  date: string;
  [key: string]: string | number;
}

export default function AnalyticsPage() {
  const { sites } = useSiteStore();
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    const endDate = new Date();
    const dates: string[] = [];
    
    // Generate date range
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(endDate.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // Initialize data structure
    const chartData: ChartData[] = dates.map(date => ({ date }));

    // Fetch data for each online site
    const onlineSites = sites.filter(s => s.status === 'online' && s.type !== 'custom');
    
    await Promise.all(onlineSites.map(async (site) => {
      const counts = await getPostCountsByDate(site.url, days);
      
      // Merge counts into chartData
      chartData.forEach(item => {
        item[site.name] = counts[item.date] || 0;
      });
    }));

    // Add total column
    chartData.forEach(item => {
      let total = 0;
      onlineSites.forEach(site => {
        total += (item[site.name] as number) || 0;
      });
      item['Total'] = total;
    });

    setData(chartData);
    setLoading(false);
  };

  useEffect(() => {
    if (sites.length > 0) {
      fetchData();
    } else {
        setLoading(false);
    }
  }, [sites, days]);

  // Calculate aggregate stats
  const totalPostsInPeriod = data.reduce((acc, curr) => acc + (curr['Total'] as number || 0), 0);
  const averagePostsPerDay = (totalPostsInPeriod / days).toFixed(1);

  // Colors for charts
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2'];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-7xl mx-auto">
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
                        <BarChart3 className="w-8 h-8" />
                        数据大屏
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        文章发布趋势分析
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1">
                    <button
                        onClick={() => setDays(7)}
                        className={clsx(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            days === 7 
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        )}
                    >
                        近7天
                    </button>
                    <button
                        onClick={() => setDays(30)}
                        className={clsx(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            days === 30 
                                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        )}
                    >
                        近30天
                    </button>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                    <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                </button>
            </div>
        </header>

        {sites.length === 0 ? (
             <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800">
                <p className="text-zinc-500">暂无站点数据，请先添加网站。</p>
            </div>
        ) : (
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-medium text-zinc-500 mb-2">总发布文章数 (近{days}天)</h3>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-white">{totalPostsInPeriod}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-medium text-zinc-500 mb-2">平均每日发布</h3>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-white">{averagePostsPerDay}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h3 className="text-sm font-medium text-zinc-500 mb-2">监控站点数</h3>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                            {sites.filter(s => s.status === 'online').length}
                            <span className="text-sm text-zinc-400 font-normal ml-2">/ {sites.length}</span>
                        </p>
                    </div>
                </div>

                {/* Main Chart */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6">每日发布趋势 (总量)</h2>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#6b7280"
                                    fontSize={12}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#6b7280" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="Total" 
                                    stroke="#2563eb" 
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                    name="总发布量"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6">站点详细数据对比</h2>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#6b7280"
                                    fontSize={12}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#6b7280" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    cursor={{ fill: 'transparent' }}
                                />
                                <Legend />
                                {sites.filter(s => s.status === 'online' && s.type !== 'custom').map((site, index) => (
                                    <Bar 
                                        key={site.id}
                                        dataKey={site.name}
                                        stackId="a"
                                        fill={colors[index % colors.length]}
                                        name={site.name}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
