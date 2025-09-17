import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://api.themoviedb.org/3';

// Helper function to check credentials
function checkCredentials() {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;

  if (!TMDB_API_KEY || !TMDB_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'Missing TMDB API credentials' },
      { status: 500 }
    );
  }
  return null;
}

// Generic TMDB API proxy - GET handler
export async function GET(request: NextRequest) {
  const credentialCheck = checkCredentials();
  if (credentialCheck) return credentialCheck;

  const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN!;

  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const query = Object.fromEntries(searchParams.entries());
    delete query.path; // Remove path from query params

    if (!path) {
      return NextResponse.json({ error: 'Missing TMDB API path' }, { status: 400 });
    }

    const queryString = new URLSearchParams(query).toString();
    const url = `${BASE_URL}${path}?${queryString}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      next: {
        revalidate: 3600, // Cache for 1 hour
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`TMDB API error for path ${path}:`, errorData);
      return NextResponse.json({ error: 'TMDB API failed', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in TMDB API route:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Generic TMDB API proxy - POST handler
export async function POST(request: NextRequest) {
  const credentialCheck = checkCredentials();
  if (credentialCheck) return credentialCheck;

  const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN!;

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
