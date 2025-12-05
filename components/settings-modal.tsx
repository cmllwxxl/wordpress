'use client';

import { useSiteStore } from '@/lib/store';
import { useState } from 'react';
import { Bell, Check, AlertCircle } from 'lucide-react';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useSiteStore();
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl);
  const [enabled, setEnabled] = useState(settings.enableNotifications);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({
      webhookUrl,
      enableNotifications: enabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知设置
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-zinc-900 dark:text-zinc-100">启用异常通知</label>
              <p className="text-sm text-zinc-500">当站点状态变为离线时发送通知</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                enabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                enabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>

          <div className={`space-y-2 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Webhook URL (飞书/钉钉/企业微信)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
              className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>目前支持飞书、钉钉和企业微信机器人的 Webhook 地址。系统将以 Markdown 格式发送报警信息。</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {saved ? <Check className="w-4 h-4" /> : null}
              {saved ? '已保存' : '保存设置'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2 rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
