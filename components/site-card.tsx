'use client';

import { Site, useSiteStore } from '@/lib/store';
import { checkSiteHealth, getSiteStats, sendWebhookNotification, sendEmailNotification } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import { Trash2, RefreshCw, ExternalLink, Globe, Settings, FileText, MessageSquare, Pencil, Check, X, Tag, Plus, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SiteCard({ site }: { site: Site }) {
  const { removeSite, updateSite, settings } = useSiteStore();
  const [checking, setChecking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(site.name);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // DnD Kit hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: site.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [showTagInput]);

  const handleCheck = async () => {
    setChecking(true);
    const result = await checkSiteHealth(site.url, site.type);

    // Check status change and send notification if needed
    if (site.status !== 'offline' && result.status === 'offline') {
      // 发送 Webhook 通知
      if (settings.enableNotifications && settings.webhookUrl) {
        sendWebhookNotification(
          settings.webhookUrl,
          site.name,
          site.url,
          'offline'
        );
      }
      // 发送邮件通知
      if (settings.enableEmailNotification && settings.notifyEmail) {
        sendEmailNotification(
          settings.notifyEmail,
          site.name,
          site.url,
          'offline'
        );
      }
    }

    let stats = {};
    if (result.status === 'online' && site.type !== 'custom') {
      stats = await getSiteStats(site.url);
    }

    updateSite(site.id, {
      status: result.status,
      lastChecked: new Date().toISOString(),
      // Only update name if it hasn't been manually edited or if it was empty
      ...(!site.name && result.name ? { name: result.name } : {}),
      ...stats
    });
    setChecking(false);
  };

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

  const handleAddTag = () => {
    if (newTag.trim()) {
      const currentTags = site.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        updateSite(site.id, { tags: [...currentTags, newTag.trim()] });
      }
      setNewTag('');
      setShowTagInput(false);
    } else {
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = site.tags || [];
    updateSite(site.id, { tags: currentTags.filter(t => t !== tagToRemove) });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTag();
    } else if (e.key === 'Escape') {
      setShowTagInput(false);
      setNewTag('');
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-sm flex flex-col gap-3 group relative"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className={`w-2 h-2 rounded-full shrink-0 ${site.status === 'online' ? 'bg-green-500' :
              site.status === 'offline' ? 'bg-red-500' : 'bg-gray-400'
            }`} />

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveName}
                className="w-full px-2 py-1 text-sm rounded border border-blue-500 bg-transparent focus:outline-none"
              />
              <button onClick={handleSaveName} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={handleCancelEdit} className="text-red-600 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 group/title">
              <h3 className="font-semibold text-lg truncate">{site.name}</h3>
              <button
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover/title:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-opacity"
                title="修改名称"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-500 transition-colors"
            title="刷新状态"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => removeSite(site.id)}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-md transition-colors"
            title="删除网站"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="text-sm text-zinc-500 truncate flex items-center gap-1">
        <Globe className="w-3 h-3" />
        <a href={site.url} target="_blank" rel="noreferrer" className="hover:underline">
          {site.url}
        </a>
      </div>

      {site.status === 'online' && (site.postCount !== undefined || site.commentCount !== undefined) && (
        <div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-md">
          <div className="flex items-center gap-1.5" title="文章数量">
            <FileText className="w-3.5 h-3.5" />
            <span>{site.postCount ?? 0} 文章</span>
          </div>
          <div className="flex items-center gap-1.5" title="评论数量">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{site.commentCount ?? 0} 评论</span>
          </div>
        </div>
      )}

      {/* Tags Section */}
      <div className="flex flex-wrap gap-1.5 items-center min-h-[24px]">
        {(site.tags || []).map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800 group/tag">
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-opacity"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input
              ref={tagInputRef}
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder="标签名..."
              className="w-16 px-1 py-0.5 text-[10px] rounded border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:border-blue-500"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowTagInput(true)}
            className="text-zinc-400 hover:text-blue-500 transition-colors p-0.5"
            title="添加标签"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="mt-auto pt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
        <span>
          {site.lastChecked ? `${new Date(site.lastChecked).toLocaleTimeString()}` : '未检查'}
        </span>
        <div className="flex gap-2">
          <Link
            href={`/site/${site.id}`}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:opacity-90 transition-opacity"
          >
            <Settings className="w-3 h-3" />
            管理
          </Link>
          {site.type !== 'custom' && (
            <a
              href={`${site.url}/wp-admin/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              后台
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
