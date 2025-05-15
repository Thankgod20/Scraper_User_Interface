import { NextRequest, NextResponse } from 'next/server';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, { timestamp: number; data: any[] }> = {};
const refreshing: Record<string, boolean> = {};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const cacheEntry = cache[address];
    const isFresh = cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_TTL);

    if (isFresh) {
      triggerBackgroundRefresh(address); // optional freshness
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    if (cacheEntry) {
      triggerBackgroundRefresh(address); // serve stale, refresh in background
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    // No cache — compute and cache
    const data = await fetchAndAggregate(address);
    cache[address] = { timestamp: Date.now(), data };
    return NextResponse.json(paginate(data, page, limit));
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function fetchAndAggregate(address: string): Promise<any[]> {
  const hostname = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
  const response = await fetch(`http://${hostname}:3300/api/holder-snapshots?address=${address}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch holder snapshots: ${response.status}`);
  }

  const jsonData = await response.json();
  const holderData: Record<string, { holders: number; time: string }> = {};

  jsonData.forEach((entry: any) => {
    const holders = parseInt(entry.holders);
    const timeNumber = new Date(entry.time).setSeconds(0, 0);
    const formattedTime = new Date(timeNumber).toISOString();
    holderData[formattedTime] = { holders, time: formattedTime };
  });

  const holdersArray = Object.values(holderData);
  holdersArray.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return holdersArray;
}

function triggerBackgroundRefresh(address: string) {
  if (refreshing[address]) return;
  console.log(`Triggering background refresh for ${address}`);
  refreshing[address] = true;
  fetchAndAggregate(address)
    .then(data => {
      cache[address] = {
        timestamp: Date.now(),
        data
      };
      console.log(`Cache refreshed for snapshot of ${address}`);
    })
    .catch(err => {
      console.error(`Background refresh failed for snapshot of ${address}:`, err);
    })
    .finally(() => {
      refreshing[address] = false;
    });
}

function paginate(data: any[], page: number, limit: number) {
  const total = data.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    snapshot: data.slice(start, end),
    page,
    totalPages,
    totalItems: total
  };
}


/*import { NextRequest, NextResponse } from 'next/server';
import { computeSellOffRiskScore } from '@/app/utils/holdersfunct'; // adjust path as needed

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10); // default: 20 items per page

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const hostname = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
    const response =await fetch(`http://${hostname}:3300/api/holder-snapshots?address=${address}`);

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
    }

    const jsonData = await response.json();
        
      // Aggregate data by price and time (converted to an ISO string with seconds and milliseconds reset)
      const holderData: { [key: string]: { holders: number; time: string } } = {};
      
      jsonData.forEach((entry: any) => {
        // Extract the holders count
        const holders = parseInt(entry.holders);
        
        // Round the time to the nearest minute (seconds & milliseconds zeroed)
        const timeNumber = new Date(entry.time).setSeconds(0, 0);
        
        // Convert the time back to a string (ISO format)
        const formattedTime = new Date(timeNumber).toISOString();
        
        // Use the formatted time as the key since we're tracking holders over time
        const key = formattedTime;
        
        // For holder snapshots, we're likely interested in the latest count for each minute
        // We could also sum or average if there are multiple entries per minute
        holderData[key] = { holders, time: formattedTime };
      });
      
      // Convert aggregated object to an array of objects with holders count and time
      const holdersArray = Object.values(holderData);
      
      // Sort by time to ensure chronological order
      holdersArray.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      
    // Pagination
    const total = holdersArray.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = holdersArray.slice(start, end);

    return NextResponse.json({
      snapshot: paginatedData,
      page,
      totalPages,
      totalItems: total,
    });
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
*/