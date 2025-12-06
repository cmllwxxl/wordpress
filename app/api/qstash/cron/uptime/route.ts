import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { qstashClient } from '@/lib/qstash';

export const maxDuration = 60; // Allow 60 seconds for execution

export async function GET(req: NextRequest) {
    // Basic auth check for Cron
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // In development, might not have secret, so we can skip in dev
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
        // 1. Get all sites
        const { data: sites, error } = await supabase
            .from('sites')
            .select('id, url, name');

        if (error) throw error;
        if (!sites || sites.length === 0) {
            return NextResponse.json({ message: 'No sites to check' });
        }

        // 2. Publish tasks to QStash
        const appUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const results = await Promise.allSettled(
            sites.map(async (site) => {
                return qstashClient.publishJSON({
                    url: `${appUrl}/api/qstash/worker/check-uptime`,
                    body: {
                        siteId: site.id,
                        url: site.url,
                        name: site.name
                    },
                    // Optional: Add some jitter to avoid slamming DB
                    delay: Math.floor(Math.random() * 5)
                });
            })
        );

        const published = results.filter(r => r.status === 'fulfilled').length;

        return NextResponse.json({
            success: true,
            total: sites.length,
            published,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('Uptime cron error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
