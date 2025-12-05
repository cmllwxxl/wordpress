import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, method, headers, data, timeout } = body;

    if (!url) {
      return NextResponse.json({ message: 'URL is required' }, { status: 400 });
    }

    // Forward the request to the WordPress site
    const response = await axios({
      url,
      method: method || 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        // Add User-Agent to avoid being blocked by some security plugins
        'User-Agent': 'WordPress-Manager-App/1.0',
      },
      data,
      // Set timeout (default 30s if not provided)
      timeout: timeout || 30000,
      // Disable SSL verification if needed (optional, use with caution)
      // httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: () => true, // Handle all status codes manually
    });

    // Return data and headers
    return NextResponse.json({
        data: response.data,
        headers: {
            'x-wp-total': response.headers['x-wp-total'],
            'x-wp-totalpages': response.headers['x-wp-totalpages']
        },
        status: response.status
    }, { status: response.status });
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    return NextResponse.json(
      { 
        message: error.message || 'Internal Server Error',
        details: error.response?.data 
      }, 
      { status: error.response?.status || 500 }
    );
  }
}
