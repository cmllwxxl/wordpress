import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import tls from 'tls';

interface SSLInfo {
    valid: boolean;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    daysRemaining?: number;
    error?: string;
}

interface CheckResult {
    status: 'online' | 'offline';
    latency: number;
    code: number;
    error?: string;
    ssl?: SSLInfo;
}

// Get SSL certificate info
async function getSSLInfo(hostname: string, port: number = 443): Promise<SSLInfo> {
    return new Promise((resolve) => {
        const options = {
            host: hostname,
            port: port,
            servername: hostname,
            rejectUnauthorized: false, // Allow checking expired certs
        };

        const socket = tls.connect(options, () => {
            try {
                const cert = socket.getPeerCertificate();

                if (!cert || Object.keys(cert).length === 0) {
                    socket.destroy();
                    resolve({ valid: false, error: 'No certificate found' });
                    return;
                }

                const validFrom = new Date(cert.valid_from);
                const validTo = new Date(cert.valid_to);
                const now = new Date();
                const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isValid = now >= validFrom && now <= validTo;

                socket.destroy();
                resolve({
                    valid: isValid && daysRemaining > 0,
                    issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
                    validFrom: validFrom.toISOString(),
                    validTo: validTo.toISOString(),
                    daysRemaining: daysRemaining,
                });
            } catch (err) {
                socket.destroy();
                resolve({ valid: false, error: 'Failed to parse certificate' });
            }
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve({ valid: false, error: err.message });
        });

        socket.setTimeout(10000, () => {
            socket.destroy();
            resolve({ valid: false, error: 'Connection timeout' });
        });
    });
}

// Check site availability
async function checkSite(urlString: string): Promise<CheckResult> {
    return new Promise((resolve) => {
        const startTime = Date.now();

        try {
            const parsedUrl = new URL(urlString);
            const isHttps = parsedUrl.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: 15000,
                headers: {
                    'User-Agent': 'WordPress-Manager-Uptime-Monitor/1.0',
                },
                rejectUnauthorized: false, // Allow self-signed certs for uptime check
            };

            const req = httpModule.request(options, async (res) => {
                const latency = Date.now() - startTime;
                const statusCode = res.statusCode || 0;

                // Consume the response to free up resources
                res.resume();

                // Get SSL info for HTTPS sites
                let sslInfo: SSLInfo | undefined;
                if (isHttps) {
                    sslInfo = await getSSLInfo(parsedUrl.hostname, parseInt(parsedUrl.port) || 443);
                }

                resolve({
                    status: statusCode >= 200 && statusCode < 400 ? 'online' : 'offline',
                    latency,
                    code: statusCode,
                    ssl: sslInfo,
                });
            });

            req.on('error', async (err) => {
                const latency = Date.now() - startTime;

                // Still try to get SSL info even if request failed
                let sslInfo: SSLInfo | undefined;
                try {
                    const parsedUrl = new URL(urlString);
                    if (parsedUrl.protocol === 'https:') {
                        sslInfo = await getSSLInfo(parsedUrl.hostname, parseInt(parsedUrl.port) || 443);
                    }
                } catch { }

                resolve({
                    status: 'offline',
                    latency,
                    code: 0,
                    error: err.message,
                    ssl: sslInfo,
                });
            });

            req.on('timeout', async () => {
                req.destroy();
                const latency = Date.now() - startTime;

                // Still try to get SSL info
                let sslInfo: SSLInfo | undefined;
                try {
                    const parsedUrl = new URL(urlString);
                    if (parsedUrl.protocol === 'https:') {
                        sslInfo = await getSSLInfo(parsedUrl.hostname, parseInt(parsedUrl.port) || 443);
                    }
                } catch { }

                resolve({
                    status: 'offline',
                    latency,
                    code: 0,
                    error: 'Request timeout',
                    ssl: sslInfo,
                });
            });

            req.end();
        } catch (err: any) {
            resolve({
                status: 'offline',
                latency: Date.now() - startTime,
                code: 0,
                error: err.message || 'Invalid URL',
            });
        }
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const result = await checkSite(url);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Monitor check error:', error);
        return NextResponse.json(
            {
                status: 'offline',
                latency: 0,
                code: 0,
                error: error.message || 'Internal server error'
            },
            { status: 500 }
        );
    }
}
