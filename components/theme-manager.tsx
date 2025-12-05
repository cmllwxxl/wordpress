'use client';

import Link from 'next/link';
import { Site } from '@/lib/store';
import { getThemes, activateTheme } from '@/lib/api';
import { useEffect, useState } from 'react';
import { Palette, CheckCircle2, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import { SiteAuthModal } from './site-auth-modal';
import { ErrorBoundary } from './error-boundary';

interface Theme {
    theme: string;
    name: string;
    status: 'active' | 'inactive';
    version: string;
    description: string;
    author: string;
    screenshot?: string;
}

function ThemeManagerContent({ site }: { site: Site }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const hasCredentials = !!site.username && !!site.appPassword;

  const fetchThemes = async () => {
    if (!hasCredentials) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getThemes(site);
      // Ensure data is an array and has 'theme' property
      if (Array.isArray(data)) {
        setThemes(data);
      } else if (data && typeof data === 'object') {
        // If data is an object, the key is usually the theme slug
        const themesArray = Object.entries(data).map(([key, value]: [string, any]) => ({
            ...value,
            theme: value.theme || value.slug || key
        }));
        setThemes(themesArray);
      } else {
        setThemes([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasCredentials) {
      fetchThemes();
    }
  }, [site.username, site.appPassword]);

  const handleActivate = async (theme: Theme) => {
    if (theme.status === 'active') return;
    
    setActivating(theme.theme);
    try {
      await activateTheme(site, theme.theme);
      // Optimistic update or refresh
      await fetchThemes();
    } catch (err: any) {
      alert(`Failed to activate theme: ${err.message}`);
    } finally {
      setActivating(null);
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
          管理主题需要 WordPress 应用程序密码权限。请先配置认证信息。
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="font-medium mb-1">无法加载主题列表</p>
                <p className="text-sm opacity-90">{error}</p>
            </div>
            <Link 
                href="/credentials"
                className="text-sm underline hover:text-red-800 dark:hover:text-red-300 whitespace-nowrap"
            >
                更新凭证
            </Link>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>正在获取主题列表...</p>
        </div>
      ) : themes.length === 0 && !error ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
            <Palette className="w-8 h-8 mx-auto mb-4 opacity-50" />
            <p>暂无主题或获取失败</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {themes.map((theme, index) => (
                <div key={theme.theme || index} className={`bg-white dark:bg-zinc-900 rounded-xl border overflow-hidden flex flex-col transition-all ${
                    theme.status === 'active' 
                        ? 'border-green-500 ring-1 ring-green-500 shadow-md' 
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700'
                }`}>
                    <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative">
                        {theme.screenshot ? (
                            <img src={theme.screenshot} alt={theme.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                <Palette className="w-12 h-12" />
                            </div>
                        )}
                        {theme.status === 'active' && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                <CheckCircle2 className="w-3 h-3" />
                                当前使用
                            </div>
                        )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 truncate" title={theme.name}>
                                {theme.name}
                            </h3>
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-500 shrink-0">
                                v{theme.version}
                            </span>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 flex-1" dangerouslySetInnerHTML={{ __html: theme.description }} />
                        
                        <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-xs text-zinc-400 truncate max-w-[120px]">
                                By {theme.author}
                            </span>
                            {theme.status !== 'active' && (
                                <button
                                    onClick={() => handleActivate(theme)}
                                    disabled={!!activating}
                                    className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                                >
                                    {activating === theme.theme ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                                    启用
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

    </div>
  );
}

export function ThemeManager({ site }: { site: Site }) {
    return (
        <ErrorBoundary>
            <ThemeManagerContent site={site} />
        </ErrorBoundary>
    );
}
