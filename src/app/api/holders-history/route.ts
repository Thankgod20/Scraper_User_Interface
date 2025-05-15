
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
      triggerBackgroundRefresh(address);
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    if (cacheEntry) {
      triggerBackgroundRefresh(address);
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

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
  const response = await fetch(`http://${hostname}:3300/api/holder-history?address=${address}`);

  if (!response.ok) {
    throw new Error(`Upstream error: ${response.status}`);
  }

  const jsonData = await response.json();

  if (!jsonData.holders || jsonData.holders.length === 0) return [];

  const holderData: Record<string, number> = {};

  jsonData.holders.forEach((holder: any) => {
    const { amount, time } = holder;

    if (!amount || !time || amount.length !== time.length) return;

    for (let i = 0; i < time.length; i++) {
      const rawTime = new Date(time[i]).setSeconds(0, 0); // Round to minute
      const formattedTime = new Date(rawTime).toISOString();

      if (!holderData[formattedTime]) {
        holderData[formattedTime] = 0;
      }

      holderData[formattedTime] += amount[i];
    }
  });

  const holdersArray = Object.entries(holderData).map(([time, holders]) => ({
    time,
    holders,
  }));

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
        data,
      };
      console.log(`Cache refreshed for holder history of ${address}`);
    })
    .catch(err => {
      console.error(`Background refresh failed for ${address}:`, err);
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
    history: data.slice(start, end),
    page,
    totalPages,
    totalItems: total,
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
    const response = await fetch(`http://${hostname}:3300/api/holder-history?address=${address}`);

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
    }

    const jsonData = await response.json();
    
    if (!jsonData.holders || jsonData.holders.length === 0) return [];

    // Aggregate holder amounts across all holders, grouped by rounded timestamp
    const holderData: { [time: string]: number } = {};
    jsonData.holders.forEach((holder: any) => {
      const { amount, time } = holder;

      if (!amount || !time || amount.length !== time.length) return;

      for (let i = 0; i < time.length; i++) {
        const rawTime = new Date(time[i]).setSeconds(0, 0); // Round to nearest minute
        const formattedTime = new Date(rawTime).toISOString();

        if (!holderData[formattedTime]) {
          holderData[formattedTime] = 0;
        }

        holderData[formattedTime] += amount[i];
      }
    });

    // Convert aggregated object to array
    const holdersArray = Object.entries(holderData).map(([time, holders]) => ({
      time,
      holders,
    }));
    
    // Sort by time
    holdersArray.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Pagination
    const total = holdersArray.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = holdersArray.slice(start, end);

    return NextResponse.json({
      history: paginatedData,
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