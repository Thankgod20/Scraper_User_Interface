// utils/cache.ts
import {
    computeSellOffRiskScore,
    processHoldings,
    processHolderCounts
  } from './holdersfunct';
  import { CategoryHoldings } from './app_types';
  
  const getLiquidity = (time: string) => 1_000_000_000;
  
  export interface Holder {
    address: string;
    amount: number[];
    time: string[];
  }
  
  export type CacheEntry = {
    timestamp: number;
    data: {
      srs: any[];
      procssholding: CategoryHoldings;
      procssholdingcount: CategoryHoldings;
    };
    refreshInProgress: boolean;
  };
  
  export const cache: Record<string, CacheEntry> = {};
  
  export function getCacheKey(address: string, lps?: Set<string>) {
    const lpsKey = lps ? Array.from(lps).sort().join(',') : '';
    return `${address}|${lpsKey}`;
  }
  
  export async function computeData(address: string, lps?: Set<string>) {
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
  