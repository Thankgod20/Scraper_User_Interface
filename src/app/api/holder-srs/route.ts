import { NextRequest, NextResponse } from 'next/server';
import {
  computeSellOffRiskScore,
  processHoldings,
  processHolderCounts
} from '@/app/utils/holdersfunct';
import { CategoryHoldings } from '@/app/utils/app_types';

const getLiquidity = (time: string) => 1_000_000_000;

interface Holder {
  address: string;
  amount: number[];
  time: string[];
}

type CacheEntry = {
  timestamp: number;
  data: {
    srs: any[];
    procssholding: CategoryHoldings;
    procssholdingcount: CategoryHoldings;
  };
};

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const lpsParam = searchParams.get('lps');
    const lps = lpsParam ? new Set(lpsParam.split(',')) : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const cacheKey = getCacheKey(address, lps);
    const cacheEntry = cache[cacheKey];
    const isFresh = cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_TTL);

    console.log("Cache Entry", cacheEntry, address);
    console.log("New request - cache key:", cacheKey, "All keys:", Object.keys(cache));

    if (isFresh) {
      console.log("Serving fresh cache");
      //await void triggerBackgroundRefresh(cacheKey, address, lps); // optional freshness
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    if (cacheEntry) {
      console.log("Serving stale cache and refreshing in background");
      await void triggerBackgroundRefresh(cacheKey, address, lps); // async refresh
      return NextResponse.json(paginate(cacheEntry.data, page, limit));
    }

    console.log("Computing new data and caching");
    const data = await computeData(address, lps);
    cache[cacheKey] = {
      timestamp: Date.now(),
      data
    };
    return NextResponse.json(paginate(data, page, limit));
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function getCacheKey(address: string, lps?: Set<string>) {
  const lpsKey = lps ? Array.from(lps).sort().join(',') : '';
  return `${address}|${lpsKey}`;
}

async function computeData(address: string, lps?: Set<string>) {
  const hostname = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
  const response = await fetch(`http://${hostname}:3300/api/holder-history?address=${address}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch holder history: ${response.status}`);
  }

  const jsonData = await response.json();
  const holders: Holder[] = jsonData.holders || [];

  const formattedData = holders.map(holder => ({
    address: holder.address,
    data: holder.time.map((t, i) => ({
      time: new Date(t).toISOString(),
      amount: holder.amount[i]
    }))
  }));

  const srs = computeSellOffRiskScore(formattedData, getLiquidity, 3, lps);
  const procssholding = processHoldings(holders, lps);
  const procssholdingcount = processHolderCounts(holders, lps);

  return { srs, procssholding, procssholdingcount };
}

async function triggerBackgroundRefresh(cacheKey: string, address: string, lps?: Set<string>) {
  console.log(`Triggering background refresh for ${cacheKey}`);
  const data = await computeData(address, lps);
    cache[cacheKey] = {
      timestamp: Date.now(),
      data
    };
  console.log(`Cache refreshed for ${cacheKey}`);
}

function paginate(
  data: {
    srs: any[];
    procssholding: CategoryHoldings;
    procssholdingcount: CategoryHoldings;
  },
  page: number,
  limit: number
) {
  const { srs, procssholding, procssholdingcount } = data;

  const allTimes = srs.map(entry => entry.time).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const totalItems = allTimes.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedTimes = new Set(allTimes.slice(startIndex, endIndex));
  const paginatedSrs = srs.filter(entry => paginatedTimes.has(entry.time));

  const allHoldingTimes = Object.keys(procssholding.whales).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const paginatedTimes_ = new Set(allHoldingTimes.slice(startIndex, endIndex));

  const filterCategoryHoldings = (data: CategoryHoldings): CategoryHoldings => ({
    whales: Object.fromEntries(
      Object.entries(data.whales).filter(([time]) => paginatedTimes_.has(time))
    ),
    retail: Object.fromEntries(
      Object.entries(data.retail).filter(([time]) => paginatedTimes_.has(time))
    ),
    lps: Object.fromEntries(
      Object.entries(data.lps).filter(([time]) => paginatedTimes_.has(time))
    ),
  });

  const paginatedHolding = filterCategoryHoldings(procssholding);
  const paginatedHoldingCount = filterCategoryHoldings(procssholdingcount);

  return {
    srs: paginatedSrs,
    procssholding: paginatedHolding,
    procssholdingcount: paginatedHoldingCount,
    page,
    totalPages,
    totalItems
  };
}

/*import { NextRequest, NextResponse } from 'next/server';
import { computeSellOffRiskScore, processHoldings, processHolderCounts } from '@/app/utils/holdersfunct';
import { CategoryHoldings } from '@/app/utils/app_types';
const getLiquidity = (time: string) => 1_000_000_000;

interface Holder {
  address: string;
  amount: number[];
  time: string[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const lpsParam = searchParams.get('lps');
    const lps = lpsParam ? new Set(lpsParam.split(',')) : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }
    
    const hostname = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
    
    const response = await fetch(`http://${hostname}:3300/api/holder-history?address=${address}`);

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: 502 });
    }
    console.log("Data Requesting0")
    const jsonData = await response.json();
    const holders: Holder[] = jsonData.holders || [];
    console.log("Data Requesting")
    // Format all data (don't filter yet)
    const formattedData = holders.map(holder => ({
      address: holder.address,
      data: holder.time.map((t, i) => ({
        time: new Date(t).toISOString(),
        amount: holder.amount[i]
      }))
    }));
    console.log("Data Requesting 2")
    // Compute full results
    const srs_ = computeSellOffRiskScore(formattedData, getLiquidity, 3, lps);
    const procssholding = processHoldings(holders, lps);
    const procssholdingcount = processHolderCounts(holders, lps);
    console.log("Data Requesting 3")
    // Get all timestamps from srs_ (they're ordered by time already if your function does that)
    const allTimes = srs_.map(entry => entry.time).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const totalItems = allTimes.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTimes = new Set(allTimes.slice(startIndex, endIndex));
    console.log("Data Requesting 5")
    // Paginate srs_
    const paginatedSrs = srs_.filter(entry => paginatedTimes.has(entry.time));


    const allHoldingTimes = Object.keys(procssholding.whales).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const totalItems_ = allHoldingTimes.length;
    const totalPages_ = Math.ceil(totalItems_ / limit);
    const startIndex_ = (page - 1) * limit;
    const endIndex_ = startIndex_ + limit;
    const paginatedTimes_ = new Set(allHoldingTimes.slice(startIndex_, endIndex_));

    const filterCategoryHoldings = (data: CategoryHoldings): CategoryHoldings => ({
      whales: Object.fromEntries(
        Object.entries(data.whales).filter(([time]) => paginatedTimes_.has(time))
      ),
      retail: Object.fromEntries(
        Object.entries(data.retail).filter(([time]) => paginatedTimes_.has(time))
      ),
      lps: Object.fromEntries(
        Object.entries(data.lps).filter(([time]) => paginatedTimes_.has(time))
      ),
    });
    

    console.log("Data Requesting 6")
    const paginatedHolding = filterCategoryHoldings(procssholding);
    const paginatedHoldingCount = filterCategoryHoldings(procssholdingcount);
    //console.log("Pagenated",procssholding)
    return NextResponse.json({
      srs: paginatedSrs,
      procssholding: paginatedHolding,
      procssholdingcount: paginatedHoldingCount,
      page,
      totalPages:(totalPages_ > totalPages) ? totalPages_ : totalPages,
      totalItems,
      lps: lps ? Array.from(lps) : []
    });
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
*/