'use client';

import { useSiteStore } from '@/lib/store';
import { getRecentPosts, getSiteStats } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, FileText, Calendar, User, ExternalLink, Settings, MessageSquare, Pencil, Check, X, Layout, Package, Palette, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { PluginManager } from '@/components/plugin-manager';
import { ThemeManager } from '@/components/theme-manager';
import { CommentManager } from '@/components/comment-manager';
import { PostManager } from '@/components/post-manager';
import { clsx } from 'clsx';

interface Post {
  id: number;
  title: { rendered: string };
  date: string;
  link: string;
  _embedded?: {
    author?: Array<{ name: string }>;
  };
}

export default function SiteDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { getSite, updateSite } = useSiteStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'posts' | 'plugins' | 'themes' | 'comments'>('overview');
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const site = getSite(id as string);

  useEffect(() => {
    if (site) {
        setEditName(site.name);
    }
  }, [site?.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!site) return;

    if (site.type === 'custom') {
        setLoading(false);
        return;
    }

    const fetchData = async () => {
      setLoading(true);
      const [recentPosts, stats] = await Promise.all([
        getRecentPosts(site.url),
        getSiteStats(site.url)
      ]);
      
      setPosts(recentPosts);
      updateSite(site.id, stats);
      setLoading(false);
    };

    fetchData();
  }, [site?.url, site?.type]);

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">未找到网站</h2>
          <Link href="/" className="text-blue-600 hover:underline">返回仪表盘</Link>
        </div>
      </div>
    );
  }

  const handleSaveName = () => {
    if (editName.trim()) {
      updateSite(site.id, { name: editName.trim() });
    } else {
      setEditName(site.name); // Revert if empty
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(site.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // If it's a custom site, show simplified view
  if (site.type === 'custom') {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
          <div className="max-w-4xl mx-auto">
            <button 
                onClick={() => router.push('/')}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                返回仪表盘
            </button>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 group">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleSaveName}
                                    className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none px-1 min-w-[200px]"
                                />
                                <button onClick={handleSaveName} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                    <Check className="w-5 h-5" />
                                </button>
                                <button onClick={handleCancelEdit} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold">{site.name}</h1>
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all"
                                    title="修改名称"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        自建站
                    </div>
                </div>
                <div className="flex items-center gap-6 mb-4">
                    <a 
                        href={site.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-zinc-500 hover:text-blue-600 flex items-center gap-1 inline-flex"
                    >
                        {site.url}
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-300 mb-1">非 WordPress 站点</h3>
                <p className="text-blue-700 dark:text-blue-400 text-sm mb-4">
                    该站点被标记为“自建站”，不支持 WordPress 的文章、插件和评论管理功能。
                </p>
                <p className="text-sm text-zinc-500">
                    您仍然可以在 <Link href="/webmaster" className="underline hover:text-blue-600">Webmaster Tools</Link> 中查看该站点的 SEO 数据。
                </p>
            </div>
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition-colors"
        >
            <ArrowLeft className="w-4 h-4" />
            返回仪表盘
        </button>

        {/* Header Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 group">
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleSaveName}
                                className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none px-1 min-w-[200px]"
                            />
                            <button onClick={handleSaveName} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                <Check className="w-5 h-5" />
                            </button>
                            <button onClick={handleCancelEdit} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold">{site.name}</h1>
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all"
                                title="修改名称"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    site.status === 'online' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                    {site.status.toUpperCase()}
                </div>
            </div>
            <div className="flex items-center gap-6 mb-4">
                <a 
                    href={site.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-zinc-500 hover:text-blue-600 flex items-center gap-1 inline-flex"
                >
                    {site.url}
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {(site.postCount !== undefined || site.commentCount !== undefined) && (
                <div className="flex gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">文章总数</p>
                            <p className="font-semibold text-lg">{site.postCount ?? 0}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-zinc-500">评论总数</p>
                            <p className="font-semibold text-lg">{site.commentCount ?? 0}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800">
            <button
                onClick={() => setActiveTab('overview')}
                className={clsx(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'overview'
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
            >
                <Layout className="w-4 h-4" />
                概览
            </button>
            <button
                onClick={() => setActiveTab('posts')}
                className={clsx(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'posts'
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
            >
                <FileText className="w-4 h-4" />
                文章管理
            </button>
            <button
                onClick={() => setActiveTab('plugins')}
                className={clsx(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'plugins'
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
            >
                <Package className="w-4 h-4" />
                插件管理
            </button>
            <button
                onClick={() => setActiveTab('themes')}
                className={clsx(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'themes'
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
            >
                <Palette className="w-4 h-4" />
                主题管理
            </button>
            <button
                onClick={() => setActiveTab('comments')}
                className={clsx(
                    "pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'comments'
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
            >
                <MessageSquare className="w-4 h-4" />
                评论管理
            </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' ? (
            <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <a 
                        href={`${site.url}/wp-admin/`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition-colors"
                    >
                        <Settings className="w-5 h-5 text-zinc-500" />
                        <span className="font-medium">后台管理</span>
                    </a>
                    <a 
                        href={`${site.url}/wp-admin/post-new.php`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-500 transition-colors"
                    >
                        <FileText className="w-5 h-5 text-zinc-500" />
                        <span className="font-medium">新建文章</span>
                    </a>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        最近文章
                    </h2>

                    {loading ? (
                        <div className="grid gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-900 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : posts.length > 0 ? (
                        <div className="grid gap-4">
                            {posts.map(post => (
                                <div key={post.id} className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                    <h3 className="font-medium text-lg mb-2" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(post.date).toLocaleDateString()}
                                        </span>
                                        {post._embedded?.author?.[0] && (
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {post._embedded.author[0].name}
                                            </span>
                                        )}
                                        <a href={post.link} target="_blank" rel="noreferrer" className="ml-auto text-blue-600 hover:underline text-xs">
                                            查看文章
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-zinc-500">未找到文章或无法获取文章。</p>
                    )}
                </div>
            </>
        ) : activeTab === 'posts' ? (
            <PostManager site={site} />
        ) : activeTab === 'plugins' ? (
            <PluginManager site={site} />
        ) : activeTab === 'themes' ? (
            <ThemeManager site={site} />
        ) : (
            <CommentManager site={site} />
        )}
      </div>
    </div>
  );
}
