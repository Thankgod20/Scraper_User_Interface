import { NextResponse } from "next/server";
import axios from "axios";

const API_URL = "https://streaming.bitquery.io/eap";
const API_KEY = "BQYu9W1R90BNV1XZbDV2uqpqp0I3djsE"; // Replace with your Bitquery API key

interface DexTrade {
  timeInterval: { minute: string };
  quotePrice: number;
}

interface ApiResponse {
  data: {
    ethereum: {
      dexTrades: DexTrade[];
    };
  };
}

export async function POST(request: Request) {
  //GET() {

  try {
    const { address } = await request.json(); // Extract address from the request body

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const query = `
{
  Solana {
    DEXTradeByTokens(
      orderBy: { descendingByField: "Block_Timefield" },
      where: {
        Trade: {
          Currency: { MintAddress: { is: "${address}" }},
          Dex: { ProgramAddress: { is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" }}
        }
      },
      limit: { count: 10 }
    ) {
      Block {
        Timefield: Time(interval: { in: minutes, count: 1 })
      }
      volume: sum(of: Trade_Amount)
      Trade {
        high: Price(maximum: Trade_Price)
        low: Price(minimum: Trade_Price)
        open: Price(minimum: Block_Height)
        close: Price(maximum: Block_Height)
      }
    }
  }
}
  `;

    const response = await axios.post<ApiResponse>(
      API_URL,
      { query },
      { headers: { "X-API-KEY": API_KEY, "Content-Type": "application/json" } }
    );

    return NextResponse.json(response.data, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching data from Bitquery:", error.message);
    return NextResponse.json(
      { error: "Error fetching data from Bitquery" },
      { status: 500 }
    );
  }
}
