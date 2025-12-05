'use client';

import { useSiteStore } from '@/lib/store';
import { useState } from 'react';
import { Bell, Check, AlertCircle, Mail, Webhook, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useSiteStore();
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl);
  const [webhookEnabled, setWebhookEnabled] = useState(settings.enableNotifications);
  const [notifyEmail, setNotifyEmail] = useState(settings.notifyEmail);
  const [emailEnabled, setEmailEnabled] = useState(settings.enableEmailNotification);
  const [saved, setSaved] = useState(false);

  // 测试邮件状态
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<'success' | 'error' | null>(null);
  const [emailTestMessage, setEmailTestMessage] = useState('');

  // 测试 Webhook 状态
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'error' | null>(null);
  const [webhookTestMessage, setWebhookTestMessage] = useState('');

  const handleSave = () => {
    updateSettings({
      webhookUrl,
      enableNotifications: webhookEnabled,
      notifyEmail,
      enableEmailNotification: emailEnabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestEmail = async () => {
    if (!notifyEmail) {
      setEmailTestResult('error');
      setEmailTestMessage('请先输入邮箱地址');
      return;
    }

    setEmailTesting(true);
    setEmailTestResult(null);
    setEmailTestMessage('');

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: notifyEmail,
          siteName: '测试站点',
          siteUrl: 'https://example.com',
          status: 'offline',
          isTest: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailTestResult('success');
        setEmailTestMessage('测试邮件已发送，请检查收件箱');
      } else {
        setEmailTestResult('error');
        setEmailTestMessage(data.error || '发送失败');
      }
    } catch (error: any) {
      setEmailTestResult('error');
      setEmailTestMessage(error.message || '网络错误');
    } finally {
      setEmailTesting(false);
      setTimeout(() => {
        setEmailTestResult(null);
        setEmailTestMessage('');
      }, 5000);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      setWebhookTestResult('error');
      setWebhookTestMessage('请先输入 Webhook URL');
      return;
    }

    setWebhookTesting(true);
    setWebhookTestResult(null);
    setWebhookTestMessage('');

    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setWebhookTestResult('success');
        setWebhookTestMessage('测试消息已发送');
      } else {
        setWebhookTestResult('error');
        setWebhookTestMessage(data.error || '发送失败');
      }
    } catch (error: any) {
      setWebhookTestResult('error');
      setWebhookTestMessage(error.message || '网络错误');
    } finally {
      setWebhookTesting(false);
      setTimeout(() => {
        setWebhookTestResult(null);
        setWebhookTestMessage('');
      }, 5000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知设置
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>

        <div className="space-y-6">
          {/* Webhook 通知部分 */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-orange-500" />
                <label className="font-medium text-zinc-900 dark:text-zinc-100">Webhook 通知</label>
              </div>
              <button
                onClick={() => setWebhookEnabled(!webhookEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${webhookEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${webhookEnabled ? 'left-7' : 'left-1'
                  }`} />
              </button>
            </div>

            <div className={`space-y-3 transition-opacity ${webhookEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
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
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestWebhook}
                  disabled={webhookTesting || !webhookUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {webhookTesting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  测试 Webhook
                </button>
                {webhookTestResult && (
                  <span className={`flex items-center gap-1 text-xs ${webhookTestResult === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {webhookTestResult === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {webhookTestMessage}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">支持飞书、钉钉和企业微信机器人的 Webhook 地址</p>
            </div>
          </div>

          {/* 邮箱通知部分 */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                <label className="font-medium text-zinc-900 dark:text-zinc-100">邮箱通知</label>
              </div>
              <button
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative ${emailEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'
                  }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${emailEnabled ? 'left-7' : 'left-1'
                  }`} />
              </button>
            </div>

            <div className={`space-y-3 transition-opacity ${emailEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                通知邮箱地址
              </label>
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestEmail}
                  disabled={emailTesting || !notifyEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {emailTesting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  发送测试邮件
                </button>
                {emailTestResult && (
                  <span className={`flex items-center gap-1 text-xs ${emailTestResult === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {emailTestResult === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {emailTestMessage}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>需要配置 RESEND_API_KEY 环境变量才能发送邮件通知。请访问 <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">resend.com</a> 获取免费 API Key。</p>
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
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

