import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { webhookUrl } = body;

        if (!webhookUrl) {
            return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
        }

        // 发送测试消息到 Webhook
        const testMessage = {
            msgtype: "markdown",
            markdown: {
                content: `### ✅ 测试消息
> 这是一条来自 **WordPress 管理平台** 的测试消息
> 
> **发送时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
> 
> 如果您收到这条消息，说明 Webhook 配置正确！`
            }
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testMessage),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Webhook test failed:', errorText);
            return NextResponse.json({
                error: `Webhook 返回错误: ${response.status}`
            }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: '测试消息已发送' });
    } catch (error: any) {
        console.error('Error testing webhook:', error);
        return NextResponse.json({
            error: error.message || 'Failed to send test message'
        }, { status: 500 });
    }
}
