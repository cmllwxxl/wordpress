import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyQStashSignature } from '@/lib/qstash';

// This worker processes ranking checks for a single user
// It relies on search_queries table being populated by the client-side collector currently
// OR it could fetch fresh data if we had server-side access to GSC/Bing APIs.
// Currently, our application captures tokens on client side.
// Server-side access requires refresh tokens which we might not have stored securely or at all yet.
//
// STRATEGY: 
// 1. In this v1 implementation, we will snapshot the latest data from `search_queries` table into `keyword_ranking_history`.
//    This assumes the user visits the dashboard occasionally to sync data from GSC/Bing via client.
// 2. Ideally, we should implement server-side GSC/Bing API calls here using refresh tokens.
//    However, `webmaster-store` suggests we only have client-side tokens or service account JSON (which is powerful).
//    If the user provided Service Account JSON for Google, we CAN fetch server-side.
//
// For now, let's implement the snapshot logic (same as the cron we built earlier), but triggered via QStash.

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const isVerified = await verifyQStashSignature(req);
    if (!isVerified && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Get tracked keywords for this user
        const { data: keywords, error: kwError } = await supabase
            .from('tracked_keywords')
            .select('*')
            .eq('user_id', userId);

        if (kwError) throw kwError;
        if (!keywords || keywords.length === 0) {
            return NextResponse.json({ message: 'No keywords for user' });
        }

        // 2. Get latest positions from search_queries (Snapshot strategy)
        // Note: This relies on data being imported. A true background worker would fetch from Google API directly.
        // Given we might not have credentials here easily, snapshotting is a safe valid first step.
        const { data: latestData, error: qError } = await supabase
            .from('search_queries')
            .select('site_id, source, query, position, impressions, clicks')
            .eq('user_id', userId);

        if (qError) throw qError;

        // 3. Match and insert history
        const today = new Date().toISOString().split('T')[0];
        const historyRecords = [];

        for (const kw of keywords) {
            const match = latestData?.find((d: any) =>
                d.site_id === kw.site_id &&
                d.source === kw.source &&
                d.query === kw.keyword
            );

            if (match) {
                historyRecords.push({
                    user_id: userId,
                    site_id: kw.site_id,
                    keyword: kw.keyword,
                    source: kw.source,
                    position: match.position,
                    impressions: match.impressions,
                    clicks: match.clicks,
                    recorded_date: today
                });
            }
        }

        if (historyRecords.length > 0) {
            const { error: insertError } = await supabase
                .from('keyword_ranking_history')
                .upsert(historyRecords, {
                    onConflict: 'user_id,site_id,source,keyword,recorded_date',
                    ignoreDuplicates: false
                });

            if (insertError) throw insertError;
        }

        return NextResponse.json({
            success: true,
            processed: historyRecords.length
        });

    } catch (error: any) {
        console.error('Ranking Worker error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
