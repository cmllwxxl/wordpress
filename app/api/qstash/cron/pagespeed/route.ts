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
        // 1. Get sites and API Key
        const { data: sites } = await supabase.from('sites').select('id, url, name');

        // We need the API key from webmaster store settings
        // Since settings are stored in local storage for the client, we might need a settings table in DB
        // But for now, we'll try to get it from settings table if available, or rely on worker to have env var fallback

        // Note: In the current architecture, pageSpeedApiKey is in webmaster store (client-side persist).
        // Best practice would be to store it in DB 'settings' table. 
        // For this implementation, we will pass a placeholder and let the worker try to fetch global settings or use env var.

        if (!sites || sites.length === 0) {
            return NextResponse.json({ message: 'No sites to check' });
        }

        const appUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // 2. Publish tasks with staggered delay to avoid rate limits
        // 400 requests/day limit without key -> very strict
        // With key -> 25,000 requests/day -> ~1000/hour -> ~16/minute
        // We'll space them out by 10 seconds per site to be safe

        const results = await Promise.allSettled(
            sites.map(async (site, index) => {
                // Check mobile strategy
                await qstashClient.publishJSON({
                    url: `${appUrl}/api/qstash/worker/check-pagespeed`,
                    body: {
                        siteId: site.id,
                        url: site.url,
                        strategy: 'mobile'
                    },
                    delay: index * 10
                });

                // Check desktop strategy (offset by 5s from mobile)
                return qstashClient.publishJSON({
                    url: `${appUrl}/api/qstash/worker/check-pagespeed`,
                    body: {
                        siteId: site.id,
                        url: site.url,
                        strategy: 'desktop'
                    },
                    delay: (index * 10) + 5
                });
            })
        );

        return NextResponse.json({
            success: true,
            total_sites: sites.length,
            tasks_created: results.length * 2, // approximate
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('PageSpeed cron error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
