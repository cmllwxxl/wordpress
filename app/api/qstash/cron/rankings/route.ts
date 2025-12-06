import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { qstashClient } from '@/lib/qstash';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Get all tracked keywords with user_id
        const { data: keywords, error } = await supabase
            .from('tracked_keywords')
            .select('user_id');

        if (error) throw error;
        if (!keywords || keywords.length === 0) {
            return NextResponse.json({ message: 'No keywords to track' });
        }

        // 2. Group by user_id
        // We want to process keywords per user because they share the same connected accounts (Search Console/Bing)
        // And we can batch process them in the worker.
        const userIds = [...new Set(keywords.map(k => k.user_id))];

        const appUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // 3. Publish task for each user
        const results = await Promise.allSettled(
            userIds.map(async (userId, index) => {
                return qstashClient.publishJSON({
                    url: `${appUrl}/api/qstash/worker/check-rankings`,
                    body: { userId },
                    delay: index * 5 // Stagger by 5 seconds per user
                });
            })
        );

        return NextResponse.json({
            success: true,
            users_processed: userIds.length,
            tasks_created: results.filter(r => r.status === 'fulfilled').length,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Ranking cron error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
