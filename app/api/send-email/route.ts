import { NextRequest, NextResponse } from 'next/server';

// 使用 Resend API 发送邮件 (免费tier支持每天100封)
// 或者可以配置其他邮件服务如 SMTP

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, siteName, siteUrl, status, isTest } = body;

    if (!to) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    }

    // 获取 Resend API Key 从环境变量
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      // 如果没有配置 Resend，尝试使用 SMTP
      const smtpHost = process.env.SMTP_HOST;
      if (smtpHost) {
        // SMTP 发送逻辑可以后续添加
        console.log('SMTP sending not implemented yet');
        return NextResponse.json({ error: 'SMTP not implemented' }, { status: 501 });
      }
      return NextResponse.json({ error: '邮件服务未配置，请设置 RESEND_API_KEY 环境变量' }, { status: 500 });
    }

    // 根据是否为测试邮件生成不同内容
    const emailSubject = isTest
      ? '✅ WordPress 管理平台 - 邮件配置测试成功'
      : `⚠️ 站点异常: ${siteName} 状态变为 ${status.toUpperCase()}`;

    const emailContent = isTest
      ? `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; text-align: center; }
    .success-icon { font-size: 48px; margin-bottom: 16px; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ 邮件配置测试成功</h1>
    </div>
    <div class="content">
      <div class="success-icon">🎉</div>
      <h2 style="color: #16a34a; margin-bottom: 8px;">恭喜！邮件服务配置正确</h2>
      <p style="color: #666;">
        您的 WordPress 管理平台邮件通知功能已正常工作。<br>
        当您的站点状态发生异常时，系统将自动发送邮件通知到此邮箱。
      </p>
      <p style="color: #999; font-size: 14px; margin-top: 24px;">
        测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
      </p>
    </div>
    <div class="footer">
      此邮件由 WordPress 管理平台自动发送
    </div>
  </div>
</body>
</html>
      `.trim()
      : `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 24px; }
    .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid #eee; }
    .info-label { color: #666; width: 100px; }
    .info-value { color: #333; font-weight: 500; }
    .status-badge { display: inline-block; background: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; color: #888; font-size: 12px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ 站点状态异常通知</h1>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="info-label">站点名称</span>
        <span class="info-value">${siteName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">站点地址</span>
        <span class="info-value"><a href="${siteUrl}" target="_blank">${siteUrl}</a></span>
      </div>
      <div class="info-row">
        <span class="info-label">当前状态</span>
        <span class="status-badge">${status.toUpperCase()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">检测时间</span>
        <span class="info-value">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
      </div>
      <p style="color: #666; margin-top: 20px;">
        您的站点可能已经无法访问，请尽快检查服务器状态和网络连接。
      </p>
      <a href="${siteUrl}" class="button">访问站点</a>
    </div>
    <div class="footer">
      此邮件由 WordPress 管理平台自动发送
    </div>
  </div>
</body>
</html>
    `.trim();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'WordPress Monitor <onboarding@resend.dev>',
        to: [to],
        subject: emailSubject,
        html: emailContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend API error:', errorData);
      return NextResponse.json({ error: errorData.message || 'Failed to send email' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, messageId: data.id });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

