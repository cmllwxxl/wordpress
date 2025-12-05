import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ message: 'Missing URL' }, { status: 400 });
    }

    // Ensure protocol
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`;
    }

    const start = performance.now();
    try {
      const response = await fetch(targetUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'WordPress-Manager-Uptime-Monitor/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      });
      
      const end = performance.now();
      const latency = Math.round(end - start);

      // If HEAD fails with 405 (Method Not Allowed), try GET
      if (response.status === 405) {
         const startGet = performance.now();
         const responseGet = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'WordPress-Manager-Uptime-Monitor/1.0'
            },
            signal: AbortSignal.timeout(10000)
         });
         const endGet = performance.now();
         return NextResponse.json({
            status: responseGet.ok ? 'online' : 'offline',
            latency: Math.round(endGet - startGet),
            code: responseGet.status
         });
      }

      return NextResponse.json({
        status: response.ok || response.status === 301 || response.status === 302 ? 'online' : 'offline',
        latency,
        code: response.status
      });

    } catch (error: any) {
      // If HEAD fails completely, try GET as fallback before giving up
      // (Some servers block HEAD)
      try {
        const startGet = performance.now();
        const responseGet = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'WordPress-Manager-Uptime-Monitor/1.0'
            },
            signal: AbortSignal.timeout(10000)
         });
         const endGet = performance.now();
         return NextResponse.json({
            status: responseGet.ok ? 'online' : 'offline',
            latency: Math.round(endGet - startGet),
            code: responseGet.status
         });
      } catch (e) {
          return NextResponse.json({
            status: 'offline',
            latency: 0,
            code: 0,
            error: error.message
          });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
