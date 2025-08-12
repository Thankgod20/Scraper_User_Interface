import { NextResponse } from "next/server";
import axios from "axios";
interface PoolInfo {
  pool_id: string;
  full_id: string;
  dex: string;
  pool_name: string;
  created_at: string;
  address: string;
}

interface MetaData {
  poolID?: string;
  all_pools?: PoolInfo[];
  pools_count?: number;
  ohlcv_source_pool?: string;
}
export async function POST(request: Request) {
  try {
    // Extract the token address from the request body
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const hostname = process.env.DATA_HOST ?? 'localhost';
    console.log("hostname", hostname)
    // Step 2: Fetch OHLCV data for the pool using the poolId
    const ohlcvUrl = `http://${hostname}:3300/get-ohlcv?poolId=${address}`;
    console.log("URL TOser",ohlcvUrl)
    /*const ohlcvResponse = await axios.get(ohlcvUrl);
    const poolId =ohlcvResponse.data.meta.poolID
    // Return the OHLCV data as JSON
    return NextResponse.json({poolId,ohlcv:ohlcvResponse.data}, { status: 200 });*/
    const ohlcvResponse = await axios.get(ohlcvUrl);

    // Extract pool IDs from metadata
    let poolId = '';
    if (ohlcvResponse.data.meta) {
        const meta: MetaData = ohlcvResponse.data.meta;
        
        // Check if all_pools exists in metadata (from your Go function)
        if (meta.all_pools && Array.isArray(meta.all_pools)) {
            // Extract pool_id from each pool and join with commas
            const poolIds = meta.all_pools.map((pool: PoolInfo) => pool.pool_id).filter((id: string) => id);
            poolId = poolIds.join(',');
        } else if (meta.poolID) {
            // Fallback to single poolID if all_pools doesn't exist
            poolId = meta.poolID;
        }
    }
    
    // Return the OHLCV data as JSON
    return NextResponse.json({
        poolId,
        ohlcv: ohlcvResponse.data
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching data from GeckoTerminal:", error.message);
    return NextResponse.json(
      { error: "Error fetching data from GeckoTerminal: " + error.message },
      { status: 500 }
    );
  }
}