import { NextResponse } from "next/server";
import axios from "axios";

const API_URL = "https://streaming.bitquery.io/eap";
const API_KEY = "Bearer ory_at_XR1sXaw2W5jZh5_pgp1V3Y23eUxyx4OvOCbxboA48cU.zj3YnLzXPtI25CQK36Hc1LYGf5XmCs9WS_9oqVWXLJE"; // Replace with your Bitquery API key

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
          Dex: { ProgramAddress: { is: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" }}
        }
      },
      limit: { count: 1000 }
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
      { headers: { "Authorization": API_KEY, "Content-Type": "application/json" } }
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
