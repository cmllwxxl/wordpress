import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyQStashSignature } from '@/lib/qstash';
import axios from 'axios';

export const maxDuration = 60; // PageSpeed API can be slow

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export async function POST(req: NextRequest) {
    const isVerified = await verifyQStashSignature(req);
    if (!isVerified && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { siteId, url, strategy, apiKey } = await req.json();

    if (!siteId || !url) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Use passed apiKey or fallback to env var
    const key = apiKey || process.env.GOOGLE_PAGESPEED_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Call PageSpeed API
        const params: any = {
            url,
            strategy: strategy || 'mobile',
            category: ['PERFORMANCE', 'ACCESSIBILITY', 'BEST_PRACTICES', 'SEO']
        };
        if (key) params.key = key;

        const response = await axios.get(PAGESPEED_API_URL, { params });
        const data = response.data;

        // Process data
        const lh = data.lighthouseResult;
        const result = {
            url,
            fetchTime: lh.fetchTime,
            strategy: strategy || 'mobile',
            scores: {
                performance: Math.round((lh.categories.performance?.score || 0) * 100),
                accessibility: Math.round((lh.categories.accessibility?.score || 0) * 100),
                bestPractices: Math.round((lh.categories['best-practices']?.score || 0) * 100),
                seo: Math.round((lh.categories.seo?.score || 0) * 100),
            },
            metrics: {
                firstContentfulPaint: lh.audits['first-contentful-paint']?.displayValue,
                largestContentfulPaint: lh.audits['largest-contentful-paint']?.displayValue,
                totalBlockingTime: lh.audits['total-blocking-time']?.displayValue,
                cumulativeLayoutShift: lh.audits['cumulative-layout-shift']?.displayValue,
                speedIndex: lh.audits['speed-index']?.displayValue,
                timeToInteractive: lh.audits['interactive']?.displayValue,
            },
            screenshot: lh.audits['final-screenshot']?.details?.data
        };

        // Save to DB
        const timestamp = Date.now();
        const updateData: any = {
            site_id: siteId,
            last_sync: timestamp,
            updated_at: new Date().toISOString()
        };

        if (strategy === 'desktop') {
            updateData.desktop_data = result;
        } else {
            updateData.mobile_data = result; // default to mobile
        }

        // We need to merge with existing data to avoid overwriting the other strategy
        // Supabase upsert will verify if row exists. If we only update one column, the other should be preserved?
        // No, upsert replaces the row if not careful. But we can select first or use nice Postgres features.
        // Easiest is to check if exists first or use jsonb_set logic, but Supabase JS client handles upsert.
        // Actually for jsonb columns, upsert replaces the whole jsonb value.
        // So we should fetch first.

        const { data: existing } = await supabase
            .from('pagespeed_cache')
            .select('*')
            .eq('site_id', siteId)
            .single();

        if (existing) {
            if (strategy === 'desktop') {
                updateData.mobile_data = existing.mobile_data; // Keep existing mobile data
            } else {
                updateData.desktop_data = existing.desktop_data; // Keep existing desktop data
            }
        }

        const { error } = await supabase
            .from('pagespeed_cache')
            .upsert(updateData);

        if (error) throw error;

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('PageSpeed Worker error:', error.message);
        return NextResponse.json({
            error: error.message,
            response: error.response?.data
        }, { status: 500 });
    }
}
