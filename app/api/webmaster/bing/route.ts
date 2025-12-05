import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, siteUrl, action } = body;

    if (!apiKey) {
      return NextResponse.json({ message: 'Missing API Key' }, { status: 400 });
    }

    if (action !== 'GetUserSites' && !siteUrl) {
        return NextResponse.json({ message: 'Missing Site URL' }, { status: 400 });
    }

    const baseUrl = 'https://ssl.bing.com/webmaster/api.svc/json';
    let endpoint = '';
    
    switch (action) {
        case 'GetQueryStats':
            endpoint = 'GetQueryStats';
            break;
        case 'GetPageStats':
            endpoint = 'GetPageStats';
            break;
        case 'GetUrlSubmissionQuota':
            endpoint = 'GetUrlSubmissionQuota';
            break;
        case 'GetRankAndTrafficStats':
            endpoint = 'GetRankAndTrafficStats';
            break;
        case 'GetUserSites':
            endpoint = 'GetUserSites';
            break;
        default:
            endpoint = 'GetQueryStats';
    }

    // Bing API expects parameters in query string for GET.
    // The endpoint is case-sensitive and follows the pattern /json/{Action}?siteUrl=...&apikey=...
    
    const params: any = { apikey: apiKey };
    if (endpoint !== 'GetUserSites') {
        params.siteUrl = siteUrl;
    }

    console.log(`Bing API Request: ${baseUrl}/${endpoint}`, { apiKey: '***', siteUrl: params.siteUrl });
    
    const response = await axios.get(`${baseUrl}/${endpoint}`, {
        params: params
    });

    // Check if response data has 'd' property, if so return it directly or unwrap it
    // The current implementation returns response.data, which usually contains { d: [...] }
    // But if something is wrong, we might need to inspect it.
    
    // Log the response for debugging if needed (optional)
    console.log(`Bing API Request: ${baseUrl}/${endpoint}`, { apiKey: '***', siteUrl });
    console.log('Bing API Response Status:', response.status);
    console.log('Bing API Response Data:', JSON.stringify(response.data).substring(0, 500) + '...');

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Bing API Error:', error.response?.data || error.message);
    // Return more details to client for debugging
    return NextResponse.json(
      { 
          message: error.message || 'Bing API Request Failed', 
          details: error.response?.data,
          status: error.response?.status 
      },
      { status: error.response?.status || 500 }
    );
  }
}
