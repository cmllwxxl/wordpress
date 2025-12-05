'use client';

import { Site, useSiteStore } from '@/lib/store';
import { verifyCredentials } from '@/lib/api';
import { useState } from 'react';
import { Key, Lock, Check, AlertCircle, AlertTriangle } from 'lucide-react';

interface SiteAuthModalProps {
  site: Site;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SiteAuthModal({ site, onClose, onSuccess }: SiteAuthModalProps) {
  const { updateSite } = useSiteStore();
  const [username, setUsername] = useState(site.username || '');
  const [appPassword, setAppPassword] = useState(site.appPassword || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        // Verify credentials first
        await verifyCredentials(site, username.trim(), appPassword.trim());

        // If verification succeeds, save to store
        await updateSite(site.id, {
          username: username.trim(),
          appPassword: appPassword.trim(),
        });

        setLoading(false);
        if (onSuccess) onSuccess();
        onClose();
    } catch (err: any) {
        setError(err.message || '验证失败，请检查您的输入或站点状态。');
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
            ✕
        </button>

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-3">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">认证设置</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            请输入 WordPress 应用程序密码以管理插件
          </p>
        </div>

        {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-md flex items-start gap-2 text-sm text-red-700 dark:text-red-400 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">用户名</label>
            <div className="relative">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-9 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
                <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                应用程序密码
                <a 
                    href={`${site.url}/wp-admin/profile.php#application-passwords-section`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 text-xs font-normal ml-2 hover:underline"
                >
                    如何获取?
                </a>
            </label>
            <div className="relative">
                <input
                    type="password"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full pl-9 px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex gap-2 items-start text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>建议为本工具创建一个专用的应用程序密码，而不是使用您的登录密码。</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity font-medium flex items-center justify-center gap-2"
          >
            {loading ? '验证并保存...' : '保存凭证'}
          </button>
        </form>
      </div>
    </div>
  );
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
        </svg>
    )
}
