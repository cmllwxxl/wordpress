import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { HttpsProxyAgent } from 'https-proxy-agent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceAccountJson, siteUrl, startDate, endDate, dimensions, action, proxyUrl } = body;

    if (!serviceAccountJson) {
      return NextResponse.json({ message: 'Missing Service Account credentials' }, { status: 400 });
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
      return NextResponse.json({ message: 'Invalid JSON format for Service Account' }, { status: 400 });
    }

    // Normalize private_key newlines if pasted as escaped string
    if (credentials && typeof credentials.private_key === 'string') {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    if (proxyUrl) {
      const agent = new HttpsProxyAgent(proxyUrl);
      google.options({ httpAgent: agent, httpsAgent: agent } as any);
    }

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    if (action === 'list_sites') {
        const response = await searchconsole.sites.list();
        return NextResponse.json({ 
            sites: response.data.siteEntry || [],
            serviceAccountEmail: credentials.client_email 
        });
    }

    if (!siteUrl) {
        return NextResponse.json({ message: 'Missing site URL' }, { status: 400 });
    }

    // Helper to try different URL variations
    const tryQuery = async (url: string) => {
        return await searchconsole.searchanalytics.query({
            siteUrl: url,
            requestBody: {
                startDate: startDate || '2024-01-01', 
                endDate: endDate || '2024-01-31',
                dimensions: dimensions || ['date'],
                rowLimit: 1000,
            },
        });
    };

    let response;
    let lastError;
    
    // 1. Try exact match first
    try {
        response = await tryQuery(siteUrl);
    } catch (e) {
        lastError = e;
    }

    // 2. If failed, try finding a matching site in GSC list
    if (!response) {
        try {
            const sitesRes = await searchconsole.sites.list();
            const sites = sitesRes.data.siteEntry || [];
            
            // Find best match:
            // - Domain property: sc-domain:example.com
            // - URL prefix: https://example.com/
            
            // Clean input url for comparison (remove protocol, www, trailing slash)
            const cleanInput = siteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
            
            const matchedSite = sites.find(s => {
                const sUrl = s.siteUrl || '';
                
                // Check Domain Property (sc-domain:)
                if (sUrl.startsWith('sc-domain:')) {
                    const domain = sUrl.replace('sc-domain:', '');
                    return cleanInput === domain || cleanInput.endsWith('.' + domain);
                }
                
                // Check URL Prefix
                const cleanSite = sUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                return cleanSite === cleanInput;
            });

            if (matchedSite && matchedSite.siteUrl) {
                console.log(`Auto-matched site: ${siteUrl} -> ${matchedSite.siteUrl}`);
                response = await tryQuery(matchedSite.siteUrl);
            }
        } catch (e) {
            console.error('Auto-match failed:', e);
        }
    }
    
    // 3. If still no response, throw the original error
    if (!response) {
        throw lastError || new Error('Failed to query Google Search Console');
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Google API Error:', error);
    
    // Enhance error message for common cases
    let message = error.message || 'Google API Request Failed';
    if (error.code === 403) {
        message = '权限不足 (403)：请确保服务账号已被添加为该网站的用户，并拥有足够权限。';
    } else if (error.code === 404) {
        message = '未找到资源 (404)：请检查网站 URL 是否与 Search Console 中完全一致（注意 http/https 和末尾斜杠）。';
    }

    return NextResponse.json(
      { message, details: error.response?.data },
      { status: error.code || 500 }
    );
  }
}
