import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Preset Coordinates mapping for Tamil Nadu hubs and major Indian cities to avoid Gemini API calls for standard lookups
const STATION_DATA: Record<string, { name: string; state: string; latitude: number; longitude: number }> = {
  chennai: { name: "Chennai", state: "Tamil Nadu", latitude: 13.0827, longitude: 80.2707 },
  karur: { name: "Karur", state: "Tamil Nadu", latitude: 10.9601, longitude: 78.0766 },
  trichy: { name: "Trichy", state: "Tamil Nadu", latitude: 10.7905, longitude: 78.7047 },
  tiruchirappalli: { name: "Tiruchirappalli", state: "Tamil Nadu", latitude: 10.7905, longitude: 78.7047 },
  coimbatore: { name: "Coimbatore", state: "Tamil Nadu", latitude: 11.0168, longitude: 76.9558 },
  madurai: { name: "Madurai", state: "Tamil Nadu", latitude: 9.9252, longitude: 78.1198 },
  salem: { name: "Salem", state: "Tamil Nadu", latitude: 11.6643, longitude: 78.1460 },
  erode: { name: "Erode", state: "Tamil Nadu", latitude: 11.3410, longitude: 77.7172 },
  tiruppur: { name: "Tiruppur", state: "Tamil Nadu", latitude: 11.1085, longitude: 77.3411 },
  tirupur: { name: "Tiruppur", state: "Tamil Nadu", latitude: 11.1085, longitude: 77.3411 },
  thanjavur: { name: "Thanjavur", state: "Tamil Nadu", latitude: 10.7870, longitude: 79.1378 },
  nagercoil: { name: "Nagercoil", state: "Tamil Nadu", latitude: 8.1830, longitude: 77.4119 },
  vellore: { name: "Vellore", state: "Tamil Nadu", latitude: 12.9165, longitude: 79.1325 },
  dindigul: { name: "Dindigul", state: "Tamil Nadu", latitude: 10.3673, longitude: 77.9803 },
  palani: { name: "Palani", state: "Tamil Nadu", latitude: 10.4549, longitude: 77.5215 },
  pudukkottai: { name: "Pudukkottai", state: "Tamil Nadu", latitude: 10.3797, longitude: 78.8214 },
  namakkal: { name: "Namakkal", state: "Tamil Nadu", latitude: 11.2189, longitude: 78.1674 },
  kumbakonam: { name: "Kumbakonam", state: "Tamil Nadu", latitude: 10.9602, longitude: 79.3844 },
  tuticorin: { name: "Thoothukudi", state: "Tamil Nadu", latitude: 8.7642, longitude: 78.1348 },
  thoothukudi: { name: "Thoothukudi", state: "Tamil Nadu", latitude: 8.7642, longitude: 78.1348 },
  bangalore: { name: "Bangalore", state: "Karnataka", latitude: 12.9716, longitude: 77.5946 },
  bengaluru: { name: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946 },
  mumbai: { name: "Mumbai", state: "Maharashtra", latitude: 19.0760, longitude: 72.8777 },
  delhi: { name: "Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.2090 },
  newdelhi: { name: "New Delhi", state: "Delhi", latitude: 28.6139, longitude: 77.2090 },
};

function normalizeText(text: string): string {
  return (text || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Memory geocoding cache to capture dynamic lookups and avoid repetitive API hits
const customGeocodeCache = new Map<string, { name: string; state: string; latitude: number; longitude: number }>();

app.use(express.json());

// API: Geocode a query restricted to India using Gemini 3.5 Flash with robust 429 rate limit fallbacks
app.get("/api/geocode", async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  const normalized = normalizeText(query);

  // 1. Check in static dataset map directly
  if (STATION_DATA[normalized]) {
    return res.json(STATION_DATA[normalized]);
  }

  // 1.5 Check if query contains any of the predefined hubs
  for (const [key, val] of Object.entries(STATION_DATA)) {
    if (normalized.includes(key) && key.length > 3) {
      return res.json(val);
    }
  }

  // 2. Check in dynamic cache memory
  if (customGeocodeCache.has(normalized)) {
    return res.json(customGeocodeCache.get(normalized));
  }

  try {
    const systemPrompt = `You are a specialist geographical geocoding assistant for India locations.
Your job is to identify the location requested and extract its precise decimal latitude and longitude coordinates.
STRICT RESTRICTION: The location must be strictly within India. Do not return or search for locations outside India. 
If the requested location does not exist in India or is outside India, please find a similarly named place in India or return New Delhi coordinates with state as "Delhi".
Return the response as a valid, pure JSON object container.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Extract the latitude and longitude for the location: ${query}. Strict Restriction: The location must be within India. Do not look for locations outside India.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The name of the town, village, city, or hub within India",
            },
            state: {
              type: Type.STRING,
              description: "The Indian state or Union Territory (e.g., Tamil Nadu, Karnataka)",
            },
            latitude: {
              type: Type.NUMBER,
              description: "The precise float decimal latitude",
            },
            longitude: {
              type: Type.NUMBER,
              description: "The precise float decimal longitude",
            },
          },
          required: ["name", "state", "latitude", "longitude"],
        },
      },
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.latitude === "number") {
        // Cache this query result in RAM
        customGeocodeCache.set(normalized, parsed);
        return res.json(parsed);
      }
    }
    throw new Error("Received empty or corrupt geocode template format from Gemini AI.");
  } catch (err: any) {
    console.warn("Gemini geocoding assistant error (applying local query fallback):", err.message || err);
    
    // Find closest match or fall back to Chennai safely
    let bestFallback = STATION_DATA["chennai"];
    for (const [key, val] of Object.entries(STATION_DATA)) {
      if (normalized.includes(key)) {
        bestFallback = val;
        break;
      }
    }

    return res.json({
      name: `${bestFallback.name} (AI Cache-Matched)`,
      state: bestFallback.state,
      latitude: bestFallback.latitude,
      longitude: bestFallback.longitude,
      fallbackUsed: true
    });
  }
});

// Setup Vite Dev Server / Serve Static Files
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Joined Vite development server middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static files from: " + distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started successfully on port ${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Vite server initialization error:", err);
});
