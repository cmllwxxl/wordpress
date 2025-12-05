'use client';

import { useSiteStore } from '@/lib/store';
import { verifyCredentials } from '@/lib/api';
import { useState, useEffect } from 'react';
import { ArrowLeft, Key, Lock, Check, AlertCircle, ShieldAlert, Search, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { SiteAuthModal } from '@/components/site-auth-modal';

export default function CredentialsPage() {
  const { sites, updateSite, fetchSites } = useSiteStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});
  const [statusMap, setStatusMap] = useState<Record<string, 'success' | 'error' | null>>({});
  
  // Use the existing modal for editing single site credentials
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  const filteredSites = sites.filter(site => 
    (site.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    site.url.toLowerCase().includes(searchQuery.toLowerCase())) &&
    site.type !== 'custom'
  );

  const handleVerify = async (siteId: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site || !site.username || !site.appPassword) return;

    setVerifyingMap(prev => ({ ...prev, [siteId]: true }));
    setStatusMap(prev => ({ ...prev, [siteId]: null }));

    try {
      await verifyCredentials(site, site.username, site.appPassword);
      setStatusMap(prev => ({ ...prev, [siteId]: 'success' }));
    } catch (error) {
      setStatusMap(prev => ({ ...prev, [siteId]: 'error' }));
    } finally {
      setVerifyingMap(prev => ({ ...prev, [siteId]: false }));
    }
  };

  const handleBatchVerify = async () => {
    const sitesToVerify = filteredSites.filter(s => s.username && s.appPassword);
    
    for (const site of sitesToVerify) {
        handleVerify(site.id);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-5xl mx-auto">
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
                        <Key className="w-8 h-8" />
                        凭证管理
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        集中管理所有站点的 WordPress 应用程序密码
                    </p>
                </div>
            </div>
        </header>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
                <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="搜索站点..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={handleBatchVerify}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors text-sm font-medium"
                >
                    <RefreshCw className="w-4 h-4" />
                    批量验证有效性
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th className="pb-3 font-medium text-zinc-500 w-1/3">站点名称</th>
                            <th className="pb-3 font-medium text-zinc-500 w-1/3">用户名</th>
                            <th className="pb-3 font-medium text-zinc-500 w-1/6">状态</th>
                            <th className="pb-3 font-medium text-zinc-500 w-1/6 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredSites.map(site => (
                            <tr key={site.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="py-4 pr-4">
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{site.name}</div>
                                    <a 
                                        href={site.url} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-xs text-zinc-500 hover:text-blue-600 flex items-center gap-1 mt-0.5"
                                    >
                                        {site.url}
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </td>
                                <td className="py-4 pr-4">
                                    {site.username ? (
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400">
                                                {site.username}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-zinc-400 italic">未配置</span>
                                    )}
                                </td>
                                <td className="py-4 pr-4">
                                    {verifyingMap[site.id] ? (
                                        <span className="flex items-center gap-1 text-blue-600 text-xs">
                                            <RefreshCw className="w-3 h-3 animate-spin" /> 验证中...
                                        </span>
                                    ) : statusMap[site.id] === 'success' ? (
                                        <span className="flex items-center gap-1 text-green-600 text-xs bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full w-fit">
                                            <Check className="w-3 h-3" /> 验证通过
                                        </span>
                                    ) : statusMap[site.id] === 'error' ? (
                                        <span className="flex items-center gap-1 text-red-600 text-xs bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full w-fit">
                                            <AlertCircle className="w-3 h-3" /> 验证失败
                                        </span>
                                    ) : site.username && site.appPassword ? (
                                        <span className="text-zinc-400 text-xs">已配置</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-amber-600 text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full w-fit">
                                            <ShieldAlert className="w-3 h-3" /> 需配置
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {site.username && site.appPassword && (
                                            <button 
                                                onClick={() => handleVerify(site.id)}
                                                disabled={verifyingMap[site.id]}
                                                className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="验证凭证"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setEditingSiteId(site.id)}
                                            className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
                                        >
                                            {site.username ? '修改' : '配置'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {filteredSites.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                        <p>未找到匹配的站点</p>
                    </div>
                )}
            </div>
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full text-blue-600 dark:text-blue-300 shrink-0 h-fit">
                <Lock className="w-5 h-5" />
            </div>
            <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-1">安全提示</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    所有的应用程序密码都经过加密存储。建议为每个站点使用独立的应用程序密码，而不是您的主登录密码。
                    如果发现任何异常，请立即在 WordPress 后台撤销相应的应用程序密码。
                </p>
            </div>
        </div>
      </div>

      {editingSiteId && (
        <SiteAuthModal
            site={sites.find(s => s.id === editingSiteId)!}
            onClose={() => setEditingSiteId(null)}
            onSuccess={() => {
                // Automatically verify after saving
                handleVerify(editingSiteId);
            }}
        />
      )}
    </div>
  );
}
