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

    // Step 1: Fetch pool data using the token address
    const poolUrl = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}/pools`;
    const poolResponse = await axios.get(poolUrl);
    const poolData = poolResponse.data?.data;

    if (!poolData || poolData.length === 0) {
      return NextResponse.json(
        { error: "No pool data found for the provided address" },
        { status: 404 }
      );
    }

    // Assuming you want the first pool's id
    let rawPoolId: string = poolData[0].id;
    // Remove the "solana_" prefix if present
    const poolId = rawPoolId.startsWith("solana_")
      ? rawPoolId.replace("solana_", "")
      : rawPoolId;

    // Step 2: Fetch OHLCV data for the pool using the poolId
    const ohlcvUrl = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolId}/ohlcv/minute?aggregate=1&limit=1000¤cy=USD`;
    const ohlcvResponse = await axios.get(ohlcvUrl);

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