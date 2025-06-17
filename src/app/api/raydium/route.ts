import { NextResponse } from "next/server";
import axios from "axios";

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
    const ohlcvResponse = await axios.get(ohlcvUrl);
    const poolId =ohlcvResponse.data.meta.poolID
    // Return the OHLCV data as JSON
    return NextResponse.json({poolId,ohlcv:ohlcvResponse.data}, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching data from GeckoTerminal:", error.message);
    return NextResponse.json(
      { error: "Error fetching data from GeckoTerminal: " + error.message },
      { status: 500 }
    );
  }
}