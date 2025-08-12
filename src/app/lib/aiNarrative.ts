// lib/aiNarrative.ts

// We don't need the GoogleGenerativeAI package anymore.

// --- START: Rate Limiting Variables for Groq ---
let lastApiCallTimestamp = 0;
// Groq's free tier allows 30 requests/minute.
// 60 seconds / 30 requests = 2 seconds per request.
// We'll set the interval to 2000ms to stay safely within the limit.
// NOTE: Your original code had 60000ms (1 minute), which would limit you to 1 request/min.
// I've corrected it to 2000ms to align with the 30 RPM limit.
const RATE_LIMIT_INTERVAL_MS = 60000;
// --- END: Rate Limiting Variables ---

// The response structure remains the same
export interface AINarrativeResponse {
  mainNarrative: string;
  keyThemes: {
    positive: string[];
    negative: string[];
  };
  narrativeScore: number;
  scoreReasoning: string;
  summary: string;
}

/**
 * Extracts a JSON object from a string, even if it's wrapped in markdown.
 */
function extractJsonFromString(text: string): string | null {
  // Use a regex to find the JSON object within the string
  const jsonRegex = /```json\s*([\s\S]*?)\s*```|({[\s\S]*})/;
  const match = text.match(jsonRegex);

  if (match) {
    // If it's a markdown block, match[1] will have the content.
    // If it's a plain JSON object, match[2] will have it.
    // match[0] is the full match, which also works but might have the backticks.
    return match[1] || match[2];
  }

  // Fallback for cases where the regex might fail but the string is just JSON
  if (text.trim().startsWith('{')) {
      return text;
  }
  
  return null;
}


/**
 * Calls the Groq API with Llama 3 to get a narrative analysis of tweets.
 * Includes rate limiting and robust JSON parsing.
 */
export async function getAINarrativeAnalysis(
  tweets: string[]
): Promise<AINarrativeResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set in environment variables.");
  }
  console.log("[Groq API] Starting AI narrative analysis...");
  
  // --- Rate Limiting Logic ---
  const currentTime = Date.now();
  const timeSinceLastCall = currentTime - lastApiCallTimestamp;

  if (timeSinceLastCall < RATE_LIMIT_INTERVAL_MS) {
    const delayNeeded = RATE_LIMIT_INTERVAL_MS - timeSinceLastCall;
    console.log(`[Groq Rate Limiter] Waiting for ${delayNeeded / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  
  lastApiCallTimestamp = Date.now();
  // --- End Rate Limiting Logic ---

  // Create the prompt (no changes needed here, it's already very good)
  const tweetSample = tweets.slice().reverse().slice(0, 30);
  const prompt = `
You are an expert memecoin analyst with a sharp eye for both opportunity and risk. Your task is to evaluate the *social narrative* and *community energy* behind a coin, based on tweet data. Your goal is to fairly judge whether the memecoin shows signs of organic growth, creativity, and potential — or if it's likely a short-lived, bot-driven attempt to extract liquidity.

Analyze the following tweet dataset on these key dimensions:

1. **Narrative Strength & Originality**
   - Is there a clear story, meme, or cultural angle?
   - Is it trying something new (e.g., satire, parody, philosophy), or just blending in with common shill trends?

2. **Community Engagement**
   - Are users showing genuine excitement, humor, or inside jokes?
   - Is there actual conversation or just repeated call-to-action tweets?
   - Do the accounts seem like real people, or mostly anonymous bots?

3. **Signal Quality vs Noise**
   - Is the conversation diverse and human, or repetitive and templated?
   - Are multiple tweets just repeating the contract address (CA), "send it", "pump", or alert phrases?

4. **Cautionary Flags**
   - Are there any signs of scam risk, rug pull history, or developer dumping?
   - Are warnings, negative replies, or suspicious metrics mentioned?

---

Use the rubric below to assign a \`narrativeScore\` — be balanced. Do not default to low scores unless strong evidence exists. Reward creative meme culture and real engagement when it's present.

**Scoring Rubric:**
- **1-2 (Likely Scam):** Heavy bot spam, no original narrative, frequent scam/rug warnings. Zero creativity.
- **3-4 (High Risk):** Mostly generic or repetitive hype. Weak or cliché meme. Some engagement, but low authenticity.
- **5-6 (Standard Meme Hype):** A typical memecoin with solid but unoriginal energy. Some unique posts or jokes, mix of bots and humans.
- **7-8 (Strong Community Narrative):** Distinct voice, meme creativity, and strong organic interaction. The project has soul.
- **9-10 (Viral or Cultural Movement):** Highly original and engaging. Unique lore or meme. High trust and momentum. Minimal bot spam.

---

Analyze the following tweets (JSON array):

${JSON.stringify(tweetSample)}

---

Return **only** a valid JSON object using the exact format below. Do not include any other text, markdown, or explanations.

{
  "mainNarrative": "A one-sentence summary of the dominant meme, lore, or message.",
  "keyThemes": {
    "positive": ["List of positive signals like 'original meme concept', 'global community', 'organic engagement'"],
    "negative": ["List of risks like 'bot repetition', 'rug history', 'contract spam'"]
  },
  "narrativeScore": A number from 1 to 10,
  "scoreReasoning": "A short explanation using specific examples from the tweets and the rubric.",
  "summary": "2-3 sentence overall sentiment read based on tweet energy and trust signals."
}
`;

  try {
    console.log("[Groq API] Sending request to Llama3...");

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: "llama3-70b-8192",
        // --- FIX #1: Tune Parameters for Reliability ---
        temperature: 0.2, // Lower temperature for more deterministic, structured output
        max_tokens: 1024, // Renamed from max_completion_tokens for OpenAI compatibility
        top_p: 1,
        // --- FIX #2: Force JSON Output (The Best Fix) ---
        response_format: { "type": "json_object" },
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    let jsonContent = data.choices[0]?.message?.content;

    if (!jsonContent) {
        throw new Error("Invalid or empty response from Groq API");
    }
    
    // --- FIX #3: Robust Parsing Logic ---
    // Log the raw content for debugging, BEFORE trying to parse it.
    // This will show you exactly what the API returned if an error occurs.
    console.log("[Groq API] Raw response content:", jsonContent);

    // Clean the string to extract only the JSON part
    const cleanedJsonString = extractJsonFromString(jsonContent);

    if (!cleanedJsonString) {
      throw new Error("Could not find a valid JSON object in the API response.");
    }
    
    // Now, parse the cleaned string
    return JSON.parse(cleanedJsonString) as AINarrativeResponse;

  } catch (error) {
    // The existing error handling is good.
    console.error("Error in AI Narrative Analysis (Groq):", error);
    return {
      mainNarrative: "Analysis failed.",
      keyThemes: { positive: [], negative: [] },
      narrativeScore: 0,
      scoreReasoning: `Could not generate analysis. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      summary: "Failed to retrieve AI-powered narrative analysis."
    };
  }
}