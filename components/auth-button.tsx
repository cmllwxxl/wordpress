'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSiteStore } from '@/lib/store';
import { LogIn, User, LogOut } from 'lucide-react';

export function AuthButton() {
  const { user, setUser } = useSiteStore();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      setMessage('已发送登录链接到您的邮箱，请查收！');
    } catch (error: any) {
      setMessage(error.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.reload(); // Reload to clear state
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full">
          <User className="w-4 h-4" />
          <span className="truncate max-w-[150px]">{user.email}</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="退出登录"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
      >
        <LogIn className="w-4 h-4" />
        登录同步
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 relative">
            <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
                ✕
            </button>
            
            <h2 className="text-xl font-bold mb-2">登录到云端</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">
              登录后，您的站点数据将在多设备间自动同步。我们将向您发送一个魔法链接进行免密登录。
            </p>

            {message ? (
              <div className={`p-4 rounded-lg mb-6 text-sm ${
                message.includes('失败') 
                  ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                  : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
              }`}>
                {message}
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">邮箱地址</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? '发送中...' : '发送登录链接'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
