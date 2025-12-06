import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyQStashSignature } from '@/lib/qstash';
import axios from 'axios';
import https from 'https';

export const maxDuration = 30; // Worker runs quickly per site

export async function POST(req: NextRequest) {
    // Verify QStash signature
    const isVerified = await verifyQStashSignature(req);
    if (!isVerified && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { siteId, url, name } = await req.json();

    if (!siteId || !url) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Supabase config missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const result = {
        siteId,
        status: 'unknown',
        latency: 0,
        code: 0,
        error: undefined as string | undefined,
        lastChecked: new Date().toISOString()
    };

    try {
        const start = Date.now();
        // Check site with timeout
        const agent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.get(url, {
            timeout: 10000,
            httpsAgent: agent,
            validateStatus: () => true // Accept all status codes
        });

        const duration = Date.now() - start;
        result.status = (response.status >= 200 && response.status < 300) ? 'online' : 'offline';
        result.code = response.status;
        result.latency = duration;

    } catch (error: any) {
        result.status = 'offline';
        result.error = error.message;
        if (error.response) {
            result.code = error.response.status;
        }
    }

    // Update database
    try {
        const updates: any = {
            status: result.status,
            last_checked: result.lastChecked,
        };

        if (result.status === 'online') {
            // Ideally we'd store latency history too, but for now just update status
        }

        await supabase.from('sites').update(updates).eq('id', siteId);

        return NextResponse.json({ success: true, result });
    } catch (err: any) {
        console.error('Database update error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
