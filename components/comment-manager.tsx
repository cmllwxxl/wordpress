'use client';

import { Site } from '@/lib/store';
import { getComments, updateComment, deleteComment, getCommentCounts, Comment } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Check, X, ShieldAlert, RefreshCw, AlertTriangle, Archive, User, Clock, CheckSquare, Square, MoreHorizontal } from 'lucide-react';
import { ErrorBoundary } from './error-boundary';
import { clsx } from 'clsx';

function CommentManagerContent({ site }: { site: Site }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [counts, setCounts] = useState({ all: 0, hold: 0, approved: 0, spam: 0, trash: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [selectedComments, setSelectedComments] = useState<number[]>([]);

  const hasCredentials = !!site.username && !!site.appPassword;

  const fetchComments = async () => {
    if (!hasCredentials) return;
    setLoading(true);
    setError(null);
    try {
      const [data, newCounts] = await Promise.all([
        getComments(site, filter),
        getCommentCounts(site)
      ]);
      setComments(data);
      setCounts(newCounts);
      setSelectedComments([]); // Clear selection on refresh/filter change
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasCredentials) {
      fetchComments();
    }
  }, [site.username, site.appPassword, filter]);

  const handleStatusChange = async (comment: Comment, newStatus: string) => {
    setProcessingId(comment.id);
    try {
      await updateComment(site, comment.id, newStatus);
      // Optimistic update
      setComments(prev => prev.map(c => c.id === comment.id ? { ...c, status: newStatus as any } : c));
      if (filter !== 'all' && filter !== newStatus) {
          setComments(prev => prev.filter(c => c.id !== comment.id));
      }
      // Refresh counts in background
      getCommentCounts(site).then(setCounts);
    } catch (err: any) {
      alert(`Failed to update comment: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (comment: Comment, force = false) => {
    if (force && !confirm('确定要永久删除此评论吗？')) return;
    
    setProcessingId(comment.id);
    try {
      await deleteComment(site, comment.id, force);
      setComments(prev => prev.filter(c => c.id !== comment.id));
      // Refresh counts in background
      getCommentCounts(site).then(setCounts);
    } catch (err: any) {
      alert(`Failed to delete comment: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSelectAll = () => {
    if (selectedComments.length === comments.length) {
      setSelectedComments([]);
    } else {
      setSelectedComments(comments.map(c => c.id));
    }
  };

  const handleSelect = (id: number) => {
    if (selectedComments.includes(id)) {
      setSelectedComments(prev => prev.filter(i => i !== id));
    } else {
      setSelectedComments(prev => [...prev, id]);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'spam' | 'trash') => {
    if (!selectedComments.length) return;
    if (!confirm(`确定要对选中的 ${selectedComments.length} 条评论执行此操作吗？`)) return;
    
    setLoading(true);
    try {
      const promises = selectedComments.map(id => {
        if (action === 'trash') return deleteComment(site, id);
        // 'approve' action maps to 'approved' status
        return updateComment(site, id, action === 'approve' ? 'approved' : action);
      });
      
      await Promise.all(promises);
      await fetchComments();
      setSelectedComments([]);
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
          管理评论需要 WordPress 应用程序密码权限。请先配置认证信息。
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
    { id: 'hold', label: '待审核', count: counts.hold },
    { id: 'approved', label: '已批准', count: counts.approved },
    { id: 'spam', label: '垃圾', count: counts.spam },
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
            {selectedComments.length > 0 && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg mr-2">
                    <button
                        onClick={() => handleBulkAction('approve')}
                        className="p-1.5 text-green-600 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                        title="批量批准"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleBulkAction('spam')}
                        className="p-1.5 text-amber-600 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-colors"
                        title="批量标记垃圾"
                    >
                        <ShieldAlert className="w-4 h-4" />
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
            <button
                onClick={() => fetchComments()}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="刷新"
            >
                <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="font-medium mb-1">无法加载评论</p>
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

      {loading && comments.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>正在获取评论...</p>
        </div>
      ) : comments.length === 0 && !error ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-4 opacity-50" />
            <p>暂无评论</p>
        </div>
      ) : (
        <div className="space-y-4">
            {comments.length > 0 && (
                 <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <button 
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                        {selectedComments.length === comments.length ? (
                            <CheckSquare className="w-4 h-4" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                        全选
                    </button>
                    <span className="text-sm text-zinc-400">
                        已选择 {selectedComments.length} 项
                    </span>
                </div>
            )}

            {comments.map(comment => (
                <div key={comment.id} className={clsx(
                    "bg-white dark:bg-zinc-900 rounded-xl border p-4 shadow-sm transition-colors",
                    selectedComments.includes(comment.id) 
                        ? "border-blue-200 dark:border-blue-900 ring-1 ring-blue-200 dark:ring-blue-900" 
                        : "border-zinc-200 dark:border-zinc-800"
                )}>
                    <div className="flex items-start gap-4">
                        <button 
                            onClick={() => handleSelect(comment.id)}
                            className="mt-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            {selectedComments.includes(comment.id) ? (
                                <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                                <Square className="w-5 h-5" />
                            )}
                        </button>

                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0">
                            {comment.author_avatar_urls?.['96'] ? (
                                <img src={comment.author_avatar_urls['96']} alt={comment.author_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-zinc-400" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{comment.author_name}</span>
                                <span className="text-xs text-zinc-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(comment.date).toLocaleString()}
                                </span>
                                {comment.status === 'hold' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                        待审核
                                    </span>
                                )}
                                {comment.status === 'spam' && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                        垃圾评论
                                    </span>
                                )}
                            </div>
                            <div 
                                className="text-sm text-zinc-600 dark:text-zinc-300 prose dark:prose-invert max-w-none mb-3"
                                dangerouslySetInnerHTML={{ __html: comment.content.rendered }} 
                            />
                            
                            <div className="flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 overflow-x-auto no-scrollbar">
                                {comment.status === 'hold' && (
                                    <button 
                                        onClick={() => handleStatusChange(comment, 'approved')}
                                        disabled={processingId === comment.id}
                                        className="text-xs flex items-center gap-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                    >
                                        <Check className="w-3 h-3" /> 批准
                                    </button>
                                )}
                                {comment.status === 'approved' && (
                                    <button 
                                        onClick={() => handleStatusChange(comment, 'hold')}
                                        disabled={processingId === comment.id}
                                        className="text-xs flex items-center gap-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                    >
                                        <Clock className="w-3 h-3" /> 驳回
                                    </button>
                                )}
                                {comment.status !== 'spam' && comment.status !== 'trash' && (
                                    <button 
                                        onClick={() => handleStatusChange(comment, 'spam')}
                                        disabled={processingId === comment.id}
                                        className="text-xs flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                    >
                                        <ShieldAlert className="w-3 h-3" /> 标记垃圾
                                    </button>
                                )}
                                {comment.status !== 'trash' ? (
                                    <button 
                                        onClick={() => handleDelete(comment)}
                                        disabled={processingId === comment.id}
                                        className="text-xs flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors ml-auto whitespace-nowrap"
                                    >
                                        <Trash2 className="w-3 h-3" /> 移至回收站
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => handleStatusChange(comment, 'approved')}
                                            disabled={processingId === comment.id}
                                            className="text-xs flex items-center gap-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                        >
                                            <Archive className="w-3 h-3" /> 还原
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(comment, true)}
                                            disabled={processingId === comment.id}
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

export function CommentManager({ site }: { site: Site }) {
    return (
        <ErrorBoundary>
            <CommentManagerContent site={site} />
        </ErrorBoundary>
    );
}
