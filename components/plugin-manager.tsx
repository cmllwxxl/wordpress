'use client';

import { Site } from '@/lib/store';
import Link from 'next/link';
import { getPlugins, updatePlugin, deletePlugin, installPlugin } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Package, Power, Trash2, RefreshCw, Plus, AlertTriangle, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { SiteAuthModal } from './site-auth-modal';
import { ErrorBoundary } from './error-boundary';

interface Plugin {
    plugin: string;
    name: string;
    status: 'active' | 'inactive';
    version: string;
    description: string;
}

function PluginManagerContent({ site }: { site: Site }) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [installSlug, setInstallSlug] = useState('');
  const [installing, setInstalling] = useState(false);

  const hasCredentials = !!site.username && !!site.appPassword;

  const fetchPlugins = async () => {
    if (!hasCredentials) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPlugins(site);
      // Ensure data is an array
      if (Array.isArray(data)) {
        setPlugins(data);
      } else {
        // Some WP configurations might return an object keyed by plugin file
        setPlugins(Object.values(data));
      }
    } catch (err: any) {
      setError(err.message);
      if (err.message.includes('Authentication') || err.message.includes('401')) {
         // Could prompt for auth again or just show error
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasCredentials) {
      fetchPlugins();
    }
  }, [site.username, site.appPassword]);

  const handleToggleStatus = async (plugin: Plugin) => {
    const newStatus = plugin.status === 'active' ? 'inactive' : 'active';
    // Optimistic update
    setPlugins(prev => prev.map(p => p.plugin === plugin.plugin ? { ...p, status: newStatus } : p));
    
    try {
      await updatePlugin(site, plugin.plugin, newStatus);
    } catch (err: any) {
      // Revert
      setPlugins(prev => prev.map(p => p.plugin === plugin.plugin ? { ...p, status: plugin.status } : p));
      alert(`更新插件状态失败: ${err.message}`);
    }
  };

  const handleDelete = async (plugin: Plugin) => {
    if (!confirm(`确定要删除插件 ${plugin.name} 吗?`)) return;
    
    // Optimistic remove
    setPlugins(prev => prev.filter(p => p.plugin !== plugin.plugin));

    try {
      await deletePlugin(site, plugin.plugin);
    } catch (err: any) {
      // Revert (fetch again is safer)
      fetchPlugins();
      alert(`删除插件失败: ${err.message}`);
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!installSlug) return;
    
    setInstalling(true);
    try {
      await installPlugin(site, installSlug);
      setInstallSlug('');
      fetchPlugins(); // Refresh list
      alert('插件安装成功!');
    } catch (err: any) {
        if (err.message.includes('activation failed')) {
             alert(`插件安装成功，但自动激活失败。请手动检查。`);
             fetchPlugins();
        } else {
             alert(`安装插件失败: ${err.message}`);
        }
    } finally {
      setInstalling(false);
    }
  };

  if (!hasCredentials) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-zinc-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">需要认证</h3>
        <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
          管理插件需要 WordPress 应用程序密码权限。请先配置认证信息。
        </p>
        <Link
          href="/credentials"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          前往凭证管理
        </Link>
      </div>
    );
  }

  const filteredPlugins = plugins.filter(p => {
    const name = p.name || '';
    const description = p.description || '';
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query) || description.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
                type="text"
                placeholder="搜索插件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        
        <form onSubmit={handleInstall} className="flex gap-2 w-full md:w-auto">
            <input
                type="text"
                placeholder="插件 Slug (如: akismet)"
                value={installSlug}
                onChange={(e) => setInstallSlug(e.target.value)}
                className="flex-1 md:w-48 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
                type="submit"
                disabled={installing || !installSlug}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
                {installing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                安装
            </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="font-medium mb-1">无法加载插件列表</p>
                <p className="text-sm opacity-90">{error}</p>
                {error.includes('Request via proxy failed') && (
                    <p className="text-xs mt-2 opacity-75">
                        提示：这可能是由于目标站点阻止了 API 访问，或者服务器配置拦截了认证信息。请检查目标站点的安全插件设置。
                    </p>
                )}
            </div>
            <Link 
                href="/credentials"
                className="text-sm underline hover:text-red-800 dark:hover:text-red-300 whitespace-nowrap"
            >
                更新凭证
            </Link>
        </div>
      )}

      {/* Plugin List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
            <div className="p-8 text-center text-zinc-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p>正在获取插件列表...</p>
            </div>
        ) : plugins.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无插件或获取失败</p>
            </div>
        ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredPlugins.map(plugin => (
                    <div key={plugin.plugin} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{plugin.name}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                    v{plugin.version}
                                </span>
                                {plugin.status === 'active' ? (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> 已启用
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                        未启用
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1" dangerouslySetInnerHTML={{ __html: plugin.description }} />
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                            <button
                                onClick={() => handleToggleStatus(plugin)}
                                className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                                    plugin.status === 'active' 
                                        ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' 
                                        : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                }`}
                                title={plugin.status === 'active' ? '禁用插件' : '启用插件'}
                            >
                                <Power className="w-4 h-4" />
                                {plugin.status === 'active' ? '禁用' : '启用'}
                            </button>
                            <button
                                onClick={() => handleDelete(plugin)}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="删除插件"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

    </div>
  );
}

export function PluginManager({ site }: { site: Site }) {
    return (
        <ErrorBoundary>
            <PluginManagerContent site={site} />
        </ErrorBoundary>
    );
}
