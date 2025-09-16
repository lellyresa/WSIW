import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.themoviedb.org/3';

// Generic TMDB API proxy
export async function POST(request: NextRequest) {
  // Check environment variables inside the handler, not at module level
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

  if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'Missing TMDB API credentials' },
      { status: 500 }
    );
  }

  try {
    const { endpoint, params = {} } = await request.json();
    
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error('TMDB API Error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'TMDB API request failed' }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
