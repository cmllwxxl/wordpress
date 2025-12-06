import { NextRequest, NextResponse } from 'next/server';

interface LighthouseAudit {
    id: string;
    title: string;
    score: number | null;
    displayValue?: string;
}

interface PageSpeedResult {
    url: string;
    fetchTime: string;
    strategy: 'mobile' | 'desktop';
    scores: {
        performance: number;
        accessibility: number;
        bestPractices: number;
        seo: number;
    };
    metrics: {
        firstContentfulPaint: string;
        largestContentfulPaint: string;
        totalBlockingTime: string;
        cumulativeLayoutShift: string;
        speedIndex: string;
        timeToInteractive: string;
    };
    screenshot?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, strategy = 'mobile', apiKey } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Google PageSpeed Insights API
        // With API key: 25,000 requests/day
        // Without API key: 400 requests/day (shared quota)
        let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo`;

        if (apiKey) {
            apiUrl += `&key=${apiKey}`;
        }

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({
                error: errorData.error?.message || 'Failed to fetch PageSpeed data',
                details: errorData.error
            }, { status: response.status });
        }

        const data = await response.json();

        // Extract scores from lighthouse result
        const lighthouseResult = data.lighthouseResult;
        const categories = lighthouseResult?.categories || {};
        const audits = lighthouseResult?.audits || {};

        const result: PageSpeedResult = {
            url: data.id,
            fetchTime: new Date().toISOString(),
            strategy: strategy as 'mobile' | 'desktop',
            scores: {
                performance: Math.round((categories.performance?.score || 0) * 100),
                accessibility: Math.round((categories.accessibility?.score || 0) * 100),
                bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
                seo: Math.round((categories.seo?.score || 0) * 100),
            },
            metrics: {
                firstContentfulPaint: audits['first-contentful-paint']?.displayValue || '-',
                largestContentfulPaint: audits['largest-contentful-paint']?.displayValue || '-',
                totalBlockingTime: audits['total-blocking-time']?.displayValue || '-',
                cumulativeLayoutShift: audits['cumulative-layout-shift']?.displayValue || '-',
                speedIndex: audits['speed-index']?.displayValue || '-',
                timeToInteractive: audits['interactive']?.displayValue || '-',
            },
            screenshot: audits['final-screenshot']?.details?.data,
        };

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('PageSpeed API error:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
