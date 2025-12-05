'use client';

import { Site } from '@/lib/store';
import { getPosts, updatePost, deletePost, getPostCounts, Post } from '@/lib/api';
import { usePostStore, CachedPost } from '@/lib/post-store';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, Trash2, Check, X, RefreshCw, AlertTriangle, Archive, Clock, CheckSquare, Square, Cloud, Calendar, Edit, ExternalLink, ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from './error-boundary';
import { clsx } from 'clsx';

function PostManagerContent({ site }: { site: Site }) {
  const { 
    getPosts: getCachedPosts, 
    setPosts: setCachedPosts, 
    getCounts: getCachedCounts, 
    setCounts: setCachedCounts, 
    lastSync,
    uploadToSupabase,
    downloadFromSupabase
  } = usePostStore();
  
  const [posts, setPosts] = useState<CachedPost[]>([]);
  const [counts, setCounts] = useState(getCachedCounts(site.id));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<number[]>([]);

  const hasCredentials = !!site.username && !!site.appPassword;
  const lastSyncTime = lastSync[site.id];

  // Initial load from cache
  useEffect(() => {
      const loadData = async () => {
          let cached = getCachedPosts(site.id);
          
          // If no local cache, try to download from Supabase
          if (cached.length === 0) {
             const downloaded = await downloadFromSupabase(site.id);
             if (downloaded) {
                 cached = getCachedPosts(site.id); // Re-fetch from store after download
             }
          }

          if (cached.length > 0) {
              setPosts(cached);
          }
          setCounts(getCachedCounts(site.id));
      };
      
      loadData();
  }, [site.id]);

  // Filter posts based on current tab
  const filteredPosts = posts.filter(post => {
      if (filter === 'all') return post.status !== 'trash';
      return post.status === filter;
  });

  const syncData = async () => {
    if (!hasCredentials) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch counts
      const newCounts = await getPostCounts(site);
      setCachedCounts(site.id, newCounts);
      setCounts(newCounts);

      // Fetch posts (fetch more to fill cache, e.g., 50)
      // We fetch 'all' statuses to populate local cache correctly
      const data = await getPosts(site, 'all', 50);
      
      const mappedPosts: CachedPost[] = data.map((p: any) => ({
          id: p.id,
          siteId: site.id,
          title: p.title.rendered,
          date: p.date,
          status: p.status,
          author_name: p._embedded?.author?.[0]?.name || 'Unknown',
          link: p.link,
          modified: p.modified
      }));

      setCachedPosts(site.id, mappedPosts);
      setPosts(mappedPosts);
      setSelectedPosts([]); 

      // Upload to Supabase for cloud backup
      await uploadToSupabase(site.id);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-sync if empty
  useEffect(() => {
    if (hasCredentials && posts.length === 0 && !loading && !error) {
        syncData();
    }
  }, [hasCredentials]);

  const handleStatusChange = async (post: CachedPost, newStatus: string) => {
    setProcessingId(post.id);
    try {
      await updatePost(site, post.id, { status: newStatus });
      
      // Optimistic update
      const updatedPosts = posts.map(p => p.id === post.id ? { ...p, status: newStatus } : p);
      setPosts(updatedPosts);
      setCachedPosts(site.id, updatedPosts);
      
      // Refresh counts in background
      getPostCounts(site).then(async c => {
          setCounts(c);
          setCachedCounts(site.id, c);
          // Sync changes to cloud
          await uploadToSupabase(site.id);
      });
    } catch (err: any) {
      alert(`Failed to update post: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (post: CachedPost, force = false) => {
    if (force && !confirm('确定要永久删除此文章吗？')) return;
    
    setProcessingId(post.id);
    try {
      await deletePost(site, post.id, force);
      
      const updatedPosts = posts.filter(p => p.id !== post.id);
      setPosts(updatedPosts);
      setCachedPosts(site.id, updatedPosts);

      getPostCounts(site).then(async c => {
          setCounts(c);
          setCachedCounts(site.id, c);
          // Sync changes to cloud
          await uploadToSupabase(site.id);
      });
    } catch (err: any) {
      alert(`Failed to delete post: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSelectAll = () => {
    if (selectedPosts.length === filteredPosts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(filteredPosts.map(p => p.id));
    }
  };

  const handleSelect = (id: number) => {
    if (selectedPosts.includes(id)) {
      setSelectedPosts(prev => prev.filter(i => i !== id));
    } else {
      setSelectedPosts(prev => [...prev, id]);
    }
  };

  const handleBulkAction = async (action: 'publish' | 'draft' | 'trash') => {
    if (!selectedPosts.length) return;
    if (!confirm(`确定要对选中的 ${selectedPosts.length} 篇文章执行此操作吗？`)) return;
    
    setLoading(true);
    try {
      const promises = selectedPosts.map(id => {
        if (action === 'trash') return deletePost(site, id);
        return updatePost(site, id, { status: action });
      });
      
      await Promise.all(promises);
      await syncData();
      setSelectedPosts([]);
    } catch (err: any) {
      alert(`批量操作失败: ${err.message}`);
      setLoading(false);
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
          管理文章需要 WordPress 应用程序密码权限。请先配置认证信息。
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

  const tabs = [
    { id: 'all', label: '全部', count: counts.all },
    { id: 'publish', label: '已发布', count: counts.publish },
    { id: 'draft', label: '草稿', count: counts.draft },
    { id: 'pending', label: '待审核', count: counts.pending },
    { id: 'private', label: '私密', count: counts.private },
    { id: 'trash', label: '回收站', count: counts.trash },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2",
                        filter === tab.id
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    )}
                >
                    {tab.label}
                    <span className={clsx(
                        "text-xs px-1.5 py-0.5 rounded-full",
                        filter === tab.id
                            ? "bg-white/20 text-white dark:bg-black/10 dark:text-zinc-900"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                    )}>
                        {tab.count}
                    </span>
                </button>
            ))}
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
            {selectedPosts.length > 0 && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg mr-2">
                    <button
                        onClick={() => handleBulkAction('publish')}
                        className="p-1.5 text-green-600 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                        title="批量发布"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleBulkAction('draft')}
                        className="p-1.5 text-amber-600 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                        title="批量转为草稿"
                    >
                        <FileText className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleBulkAction('trash')}
                        className="p-1.5 text-red-600 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                        title="批量移至回收站"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            <div className="flex items-center gap-2 text-xs text-zinc-400 mr-2">
                {lastSyncTime && (
                    <span>
                        已同步: {new Date(lastSyncTime).toLocaleTimeString()}
                    </span>
                )}
            </div>

            <button
                onClick={() => syncData()}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                title="同步数据"
            >
                <Cloud className={clsx("w-4 h-4", loading && "animate-bounce")} />
                {loading ? '同步中...' : '云同步'}
            </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="font-medium mb-1">同步失败</p>
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

      {filteredPosts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
            <FileText className="w-8 h-8 mx-auto mb-4 opacity-50" />
            <p>暂无文章</p>
            {posts.length === 0 && (
                <button onClick={syncData} className="mt-4 text-blue-600 hover:underline text-sm">
                    点击同步数据
                </button>
            )}
        </div>
      ) : (
        <div className="space-y-4">
             <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <button 
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                    {selectedPosts.length === filteredPosts.length ? (
                        <CheckSquare className="w-4 h-4" />
                    ) : (
                        <Square className="w-4 h-4" />
                    )}
                    全选
                </button>
                <span className="text-sm text-zinc-400">
                    已选择 {selectedPosts.length} 项
                </span>
            </div>

            {filteredPosts.map(post => (
                <div key={post.id} className={clsx(
                    "bg-white dark:bg-zinc-900 rounded-xl border p-4 shadow-sm transition-colors",
                    selectedPosts.includes(post.id) 
                        ? "border-blue-200 dark:border-blue-900 ring-1 ring-blue-200 dark:ring-blue-900" 
                        : "border-zinc-200 dark:border-zinc-800"
                )}>
                    <div className="flex items-start gap-4">
                        <button 
                            onClick={() => handleSelect(post.id)}
                            className="mt-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            {selectedPosts.includes(post.id) ? (
                                <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                                <Square className="w-5 h-5" />
                            )}
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 truncate">
                                    {post.title || '(无标题)'}
                                </h3>
                                {post.status === 'draft' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                        草稿
                                    </span>
                                )}
                                {post.status === 'pending' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                        待审核
                                    </span>
                                )}
                                {post.status === 'private' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                        私密
                                    </span>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(post.date).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {post.author_name}
                                </span>
                                <a 
                                    href={post.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    查看
                                </a>
                            </div>
                            
                            <div className="flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 overflow-x-auto no-scrollbar">
                                {post.status !== 'publish' && post.status !== 'trash' && (
                                    <button 
                                        onClick={() => handleStatusChange(post, 'publish')}
                                        disabled={processingId === post.id}
                                        className="text-xs flex items-center gap-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                    >
                                        <Check className="w-3 h-3" /> 发布
                                    </button>
                                )}
                                {post.status === 'publish' && (
                                    <button 
                                        onClick={() => handleStatusChange(post, 'draft')}
                                        disabled={processingId === post.id}
                                        className="text-xs flex items-center gap-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                    >
                                        <FileText className="w-3 h-3" /> 转为草稿
                                    </button>
                                )}
                                
                                {post.status !== 'trash' ? (
                                    <button 
                                        onClick={() => handleDelete(post)}
                                        disabled={processingId === post.id}
                                        className="text-xs flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors ml-auto whitespace-nowrap"
                                    >
                                        <Trash2 className="w-3 h-3" /> 移至回收站
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => handleStatusChange(post, 'draft')}
                                            disabled={processingId === post.id}
                                            className="text-xs flex items-center gap-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                        >
                                            <Archive className="w-3 h-3" /> 还原
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(post, true)}
                                            disabled={processingId === post.id}
                                            className="text-xs flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors ml-auto whitespace-nowrap"
                                        >
                                            <X className="w-3 h-3" /> 永久删除
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

    </div>
  );
}

export function PostManager({ site }: { site: Site }) {
    return (
        <ErrorBoundary>
            <PostManagerContent site={site} />
        </ErrorBoundary>
    );
}
