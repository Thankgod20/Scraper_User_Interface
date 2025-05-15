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
      triggerBackgroundRefresh(address); // optional: refresh even if fresh
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    if (cacheEntry) {
      triggerBackgroundRefresh(address); // stale cache — refresh in background
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    // No cache — compute immediately
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
  const response = await fetch(`http://${hostname}:3300/fetch-holders?search=${address}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch holder data: ${response.status}`);
  }

  const jsonData = await response.json();
  const holderData: { [key: string]: { price: number; amount: number; time: string } } = {};

  jsonData.forEach((entry: any) => {
    const price = parseFloat(entry.price);
    const amount = parseFloat(entry.amount);
    const timeNumber = new Date(entry.time).setSeconds(0, 0);
    const formattedTime = new Date(timeNumber).toISOString();
    const key = `${price}_${formattedTime}`;

    if (holderData[key]) {
      holderData[key].amount += amount;
    } else {
      holderData[key] = { price, amount, time: formattedTime };
    }
  });

  return Object.values(holderData);
}

function triggerBackgroundRefresh(address: string) {
  console.log(`Triggering background refresh for ${address}`);
  if (refreshing[address]) return;

  refreshing[address] = true;
  fetchAndAggregate(address)
    .then(data => {
      cache[address] = {
        timestamp: Date.now(),
        data
      };
      console.log(`Cache refreshed for ${address}`);
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
    holders: data.slice(start, end),
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
    const response = await fetch(`http://${hostname}:3300/fetch-holders?search=${address}`);

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
    }

    const jsonData = await response.json();

    // Aggregate by price and rounded minute
    const holderData: { [key: string]: { price: number; amount: number; time: string } } = {};
    jsonData.forEach((entry: any) => {
      const price = parseFloat(entry.price);
      const amount = parseFloat(entry.amount);
      const timeNumber = new Date(entry.time).setSeconds(0, 0);
      const formattedTime = new Date(timeNumber).toISOString();
      const key = `${price}_${formattedTime}`;

      if (holderData[key]) {
        holderData[key].amount += amount;
      } else {
        holderData[key] = { price, amount, time: formattedTime };
      }
    });

    const holdersArray = Object.values(holderData);

    // Pagination
    const total = holdersArray.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = holdersArray.slice(start, end);
    
    return NextResponse.json({
      holders: paginatedData,
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