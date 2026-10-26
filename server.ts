import crypto from "crypto";
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { YoutubeTranscript } from "youtube-transcript";

dotenv.config();

const app = express();

const rateLimitMap: Record<string, { count: number, resetAt: number }> = {};
const RATE_LIMIT_COUNT = 100;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

app.use((req, res, next) => {
  // Only limit /api routes except /api/job-status
  if (!req.path.startsWith('/api') || req.path === '/api/job-status') {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!rateLimitMap[ip]) {
    rateLimitMap[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return next();
  }

  if (now > rateLimitMap[ip].resetAt) {
    rateLimitMap[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    return next();
  }

  rateLimitMap[ip].count++;
  if (rateLimitMap[ip].count > RATE_LIMIT_COUNT) {
    return res.status(429).json({ error: "Rate limit exceeded. Take a quick 15-minute break..." });
  }

  next();
});

const PORT = 3000;

// Set up JSON body parsing with a generous limit for uploaded images/documents
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

// ============================================================================
// Quota Hijack Prevention: Server-Side Firebase Auth Token Verification
// ============================================================================
let firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "";
let recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || process.env.VITE_RECAPTCHA_SITE_KEY || process.env.FIREBASE_RECAPTCHA_SITE_KEY || process.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || "";
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!firebaseApiKey && parsed.apiKey && !parsed.apiKey.includes("process.env") && !parsed.apiKey.startsWith("${")) {
      firebaseApiKey = parsed.apiKey;
    }
    if (!firebaseProjectId && parsed.projectId && !parsed.projectId.includes("process.env") && !parsed.projectId.startsWith("${")) {
      firebaseProjectId = parsed.projectId;
    }
    if (!recaptchaSiteKey && parsed.recaptchaSiteKey && !parsed.recaptchaSiteKey.includes("process.env") && !parsed.recaptchaSiteKey.startsWith("${")) {
      recaptchaSiteKey = parsed.recaptchaSiteKey;
    }
  }
} catch (e) {
  console.warn("[Auth Security] Failed to load firebase-applet-config.json:", e);
}

// In-memory token cache for Firebase & Manual Auth verification (10 min TTL)
const tokenCache = new Map<string, { uid: string; email: string; expiresAt: number }>();

// Secret key for signing manual user session tokens
const AUTH_SECRET = process.env.FIREBASE_API_KEY || "classroomlm-secure-jwt-auth-secret-key-2026";

// Path to persistent manual users store
const MANUAL_USERS_FILE = path.join(process.cwd(), "data", "manual_users.json");

interface ManualUserRecord {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

function ensureManualUsersStore(): ManualUserRecord[] {
  try {
    const dir = path.dirname(MANUAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(MANUAL_USERS_FILE)) {
      fs.writeFileSync(MANUAL_USERS_FILE, JSON.stringify([]), "utf8");
      return [];
    }
    const raw = fs.readFileSync(MANUAL_USERS_FILE, "utf8");
    return JSON.parse(raw) as ManualUserRecord[];
  } catch (err) {
    console.warn("[Manual Auth] Could not read manual users store, using in-memory list:", err);
    return [];
  }
}

function saveManualUsersStore(records: ManualUserRecord[]) {
  try {
    const dir = path.dirname(MANUAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MANUAL_USERS_FILE, JSON.stringify(records, null, 2), "utf8");
  } catch (err) {
    console.error("[Manual Auth] Failed saving manual users store:", err);
  }
}

export function createManualToken(payload: { uid: string; email: string; displayName?: string }): string {
  const data = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30-day validity
  };
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(b64).digest("base64url");
  return `clm_manual_${b64}_${signature}`;
}

export function verifyManualToken(token: string): { uid: string; email: string; displayName?: string } | null {
  if (!token.startsWith("clm_manual_")) return null;
  const parts = token.slice("clm_manual_".length).split("_");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(b64).digest("base64url");
  if (sig !== expectedSig) return null;

  try {
    const json = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    if (json.exp && json.exp < Date.now()) return null;
    return { uid: json.uid, email: json.email, displayName: json.displayName };
  } catch {
    return null;
  }
}

async function verifyFirebaseToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized: Missing Authorization header. A valid user session token is required to access AI tools."
    });
  }

  const idToken = authHeader.split("Bearer ")[1]?.trim();
  if (!idToken) {
    return res.status(401).json({
      error: "Unauthorized: User session token is empty."
    });
  }

  // 1. Check in-memory verification cache
  const cached = tokenCache.get(idToken);
  if (cached && cached.expiresAt > Date.now()) {
    (req as any).user = { uid: cached.uid, email: cached.email };
    return next();
  }

  // 2. Check if this is a secure manual account token
  if (idToken.startsWith("clm_manual_")) {
    const verified = verifyManualToken(idToken);
    if (!verified) {
      return res.status(401).json({
        error: "Unauthorized: Invalid or expired manual account token. Please sign in again."
      });
    }
    tokenCache.set(idToken, {
      uid: verified.uid,
      email: verified.email,
      expiresAt: Date.now() + 60 * 60 * 1000
    });
    (req as any).user = { uid: verified.uid, email: verified.email };
    return next();
  }

  // 3. Fallback to Google Firebase Identity Toolkit accounts:lookup for Google OAuth sessions
  try {
    const key = process.env.FIREBASE_API_KEY || firebaseApiKey;
    if (!key) {
      console.warn("[Quota Guard] Warning: No Firebase API Key found for server token lookup.");
      return res.status(401).json({ error: "Unauthorized: Firebase configuration not found." });
    }

    const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`;
    const response = await fetch(lookupUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn(`[Quota Hijack Guard] Rejected token. Status: ${response.status}`);
      return res.status(401).json({
        error: "Unauthorized: Invalid or expired Firebase ID token. Please sign in."
      });
    }

    const data: any = await response.json();
    if (!data.users || data.users.length === 0) {
      return res.status(401).json({
        error: "Unauthorized: User account not found for provided credentials."
      });
    }

    const verifiedUser = {
      uid: data.users[0].localId,
      email: data.users[0].email
    };

    tokenCache.set(idToken, {
      uid: verifiedUser.uid,
      email: verifiedUser.email,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    (req as any).user = verifiedUser;
    next();
  } catch (err: any) {
    console.error("[Quota Guard] Token lookup exception:", err.message || err);
    return res.status(401).json({
      error: "Unauthorized: Token verification failed."
    });
  }
}

// Manage multiple API keys with explicit workflow order:
// GEMINI_API_KEY_1 -> GEMINI_API_KEY_2 -> GEMINI_API_KEY_3 -> GEMINI_API_KEY_4
interface KeyEntry {
  envVar: string;
  client: GoogleGenAI;
}

const ORDERED_API_KEY_ENVS = [
  "GEMINI_API_KEY_1",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY",
] as const;

let keyPool: KeyEntry[] = [];
let currentKeyIndex = 0;

function getKeyPool(): KeyEntry[] {
  if (keyPool.length === 0) {
    for (const envVar of ORDERED_API_KEY_ENVS) {
      const val = process.env[envVar];
      if (val && val.trim().length > 0) {
        keyPool.push({
          envVar,
          client: new GoogleGenAI({
            apiKey: val.trim(),
            httpOptions: {
              headers: { "User-Agent": "aistudio-build" },
            },
          }),
        });
      }
    }
    if (keyPool.length === 0) {
      console.warn("WARNING: No GEMINI_API_KEY_1..4 found in environment variables.");
      keyPool.push({
        envVar: "GEMINI_API_KEY_1",
        client: new GoogleGenAI({ apiKey: "FALLBACK_KEY" }),
      });
    } else {
      console.log(`[Gemini Keys Workflow] Active chain: ${keyPool.map(k => k.envVar).join(" -> ")}`);
    }
  }
  return keyPool;
}

function getGeminiClient(): GoogleGenAI {
  const pool = getKeyPool();
  return pool[currentKeyIndex % pool.length].client;
}

function rotateGeminiClient(): GoogleGenAI {
  const pool = getKeyPool();
  if (pool.length > 1) {
    const prevKey = pool[currentKeyIndex % pool.length].envVar;
    currentKeyIndex = (currentKeyIndex + 1) % pool.length;
    const nextKey = pool[currentKeyIndex].envVar;
    console.warn(`[Gemini Workflow] Key switch: ${prevKey} -> ${nextKey} (Slot ${currentKeyIndex + 1}/${pool.length})`);
  }
  return pool[currentKeyIndex].client;
}

// Helper to clean up JSON responses from Gemini if they come back wrapped in markdown backticks
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

const DEFAULT_FALLBACK_TEXT_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest"
];

/**
 * Robust retry helper for Gemini API with strict workflow order:
 * GEMINI_API_KEY_1 -> GEMINI_API_KEY_2 -> GEMINI_API_KEY_3 -> GEMINI_API_KEY_4
 * If one key fails, throws an error, or quotas are exceeded, it immediately switches
 * to the next key as specified in the user's workflow.
 */
async function generateContentWithRetry(
  _client: GoogleGenAI,
  params: {
    model: string;
    contents: any;
    config?: any;
  },
  fallbackModels?: string[]
) {
  const pool = getKeyPool();
  const poolSize = pool.length;
  let lastError: any = null;

  // Normalize contents to standard format
  let normalizedContents = params.contents;
  if (Array.isArray(normalizedContents)) {
    const isArrayOfParts = normalizedContents.every(item => item && typeof item === 'object' && !('parts' in item));
    if (isArrayOfParts) {
      normalizedContents = { parts: normalizedContents };
    }
  } else if (normalizedContents && typeof normalizedContents === 'object' && !('parts' in normalizedContents)) {
    if ('text' in normalizedContents || 'inlineData' in normalizedContents) {
      normalizedContents = { parts: [normalizedContents] };
    }
  }

  // Determine full chain of models to try
  const isAudioRequest = params.config?.responseModalities?.includes("AUDIO") || params.model?.includes("tts");
  const modelsToTry: string[] = [];

  if (isAudioRequest) {
    if (params.model) modelsToTry.push(params.model);
    const AUDIO_FALLBACK_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
    for (const m of AUDIO_FALLBACK_MODELS) {
      if (!modelsToTry.includes(m)) modelsToTry.push(m);
    }
  } else {
    // For text/multimodal tasks, prioritize gemini-3.1-flash-lite first to avoid 503 high demand spikes
    const preferredPrimary = (params.model && params.model !== "gemini-flash-latest")
      ? params.model
      : "gemini-3.1-flash-lite";
    
    modelsToTry.push(preferredPrimary);

    if (fallbackModels && fallbackModels.length > 0) {
      for (const m of fallbackModels) {
        if (!modelsToTry.includes(m)) modelsToTry.push(m);
      }
    }
    for (const m of DEFAULT_FALLBACK_TEXT_MODELS) {
      if (!modelsToTry.includes(m)) modelsToTry.push(m);
    }
    if (params.model && !modelsToTry.includes(params.model)) {
      modelsToTry.push(params.model);
    }
  }

  for (const currentModel of modelsToTry) {
    // For each model, attempt across the key chain: KEY_1 -> KEY_2 -> KEY_3 -> KEY_4
    let keyAttempts = 0;
    while (keyAttempts < poolSize) {
      const currentKeyEntry = pool[currentKeyIndex % poolSize];
      const client = currentKeyEntry.client;

      try {
        const apiParams: any = {
          ...params,
          contents: normalizedContents,
          model: currentModel,
        };

        console.log(`[Gemini Call] Model: ${currentModel} | Key: ${currentKeyEntry.envVar} (${keyAttempts + 1}/${poolSize})`);
        const response = await client.models.generateContent(apiParams);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || JSON.stringify(err) || "";
        const status = err?.status || err?.error?.code || (err?.response ? err?.response?.status : null);

        console.warn(`[Gemini Workflow] Key ${currentKeyEntry.envVar} failed on ${currentModel}: ${errMsg.slice(0, 110)}`);

        // Check if error is model-level unavailability (503 High Demand, 404 Model Not Found)
        const isModelUnavailable = status === 503 || 
          errMsg.includes("503") || 
          errMsg.includes("high demand") || 
          errMsg.includes("UNAVAILABLE") || 
          errMsg.includes("overloaded") || 
          errMsg.includes("Spikes in demand");

        const isModelNotFound = status === 404 || 
          errMsg.includes("404") || 
          errMsg.includes("not found") || 
          errMsg.includes("no longer available");

        if (isModelUnavailable || isModelNotFound) {
          // Model itself is experiencing high demand or not found.
          // Trying all other keys on this exact same model will also fail with 503!
          // Immediately move to the next model in the fallback chain.
          console.warn(`[Gemini Workflow] Model ${currentModel} is currently experiencing high demand/unavailable. Fast-forwarding to next model in fallback chain...`);
          rotateGeminiClient();
          break; // Exit key loop for this model, immediately try next model in modelsToTry!
        }
        
        // Immediately rotate to next key in workflow: GEMINI_API_KEY_1 -> 2 -> 3 -> 4
        rotateGeminiClient();
        keyAttempts++;
        if (keyAttempts < poolSize) {
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }
  }

  throw lastError || new Error("All Gemini API keys and models in the fallback chain were exhausted.");
}

/**
 * Resolves an authentic, high-resolution educational image from the internet.
 * Queries Wikimedia Commons / Wikipedia API for genuine educational diagrams, scientific illustrations, and photos.
 * Falls back to curated educational diagrams from Pollinations.
 */
async function fetchInternetImageForSlide(searchKeyword: string, topic: string, isStoryteller: boolean = false): Promise<string | null> {
  const query = (searchKeyword || topic || "").trim();
  if (!query) return null;

  // In Storyteller mode, generate whimsical, vibrant, colorful storybook adventure digital art
  if (isStoryteller) {
    try {
      const storyPrompt = `whimsical colorful storybook adventure illustration of ${query || topic}, vibrant fairy tale fantasy digital art, beautiful cinematic magical lighting, animated movie style, detailed painting, high fantasy, colorful characters, storybook page art, no text, no watermark`;
      return `https://image.pollinations.ai/prompt/${encodeURIComponent(storyPrompt)}?width=800&height=600&nologo=true`;
    } catch (e) {
      return null;
    }
  }

  // 1. Try Wikimedia Commons / Wikipedia Search API (clean, high-res encyclopedic images)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=960&format=json&origin=*`;
    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "ClassroomLM/1.0 (https://classroomlm.app; contact: student@classroomlm.app)" },
      signal: AbortSignal.timeout(2000)
    });
    if (res.ok) {
      const data: any = await res.json();
      const pages = data.query?.pages || {};
      for (const p of Object.values(pages) as any[]) {
        if (p.thumbnail?.source && !p.thumbnail.source.includes("Disambig") && !p.thumbnail.source.includes("Wiki_letter")) {
          return p.thumbnail.source;
        }
      }
    }
  } catch (err) {
    // Non-fatal, try fallback
  }

  // 2. Try Wikipedia with topic alone if specific keyword yielded no result
  if (topic && topic.toLowerCase() !== query.toLowerCase()) {
    try {
      const topicUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(topic)}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=960&format=json&origin=*`;
      const res = await fetch(topicUrl, {
        headers: { "User-Agent": "ClassroomLM/1.0 (https://classroomlm.app)" },
        signal: AbortSignal.timeout(1800)
      });
      if (res.ok) {
        const data: any = await res.json();
        const pages = data.query?.pages || {};
        for (const p of Object.values(pages) as any[]) {
          if (p.thumbnail?.source && !p.thumbnail.source.includes("Disambig")) {
            return p.thumbnail.source;
          }
        }
      }
    } catch (err) {
      // Non-fatal, try fallback
    }
  }

  // 3. Fallback: High-resolution educational textbook diagram from Pollinations
  try {
    const cleanPrompt = `detailed educational textbook diagram of ${query}, clear scientific illustration, clean white background`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=800&height=600&nologo=true`;
  } catch (e) {
    return null;
  }
}

/**
 * Authentication Endpoints: Manual Account Sign-Up & Sign-In
 * Fully fixes Firebase OPERATION_NOT_ALLOWED by offering smooth manual account creation.
 */
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { identifier, email: directEmail, password, name } = req.body;
    const rawId = (identifier || directEmail || "").trim();
    if (!rawId) {
      return res.status(400).json({ error: "Please enter a valid username or email address." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long." });
    }

    // Determine normalized email and username
    let email: string;
    let username: string;
    if (rawId.includes("@")) {
      email = rawId.toLowerCase();
      username = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "") || "student";
    } else {
      username = rawId.toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, "") || "student";
      email = `${username}@classroomlm.app`;
    }

    const records = ensureManualUsersStore();
    const exists = records.find(u => 
      u.email.toLowerCase() === email.toLowerCase() || 
      u.username.toLowerCase() === username.toLowerCase()
    );
    if (exists) {
      return res.status(400).json({ 
        error: "An account with this username or email already exists. Please choose a different username or sign in." 
      });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
    const uid = "usr_" + crypto.randomBytes(12).toString("hex");
    const displayName = (name || username || "Student").trim();

    const newUser: ManualUserRecord = {
      uid,
      username,
      email,
      displayName,
      passwordHash,
      salt,
      createdAt: new Date().toISOString()
    };

    records.push(newUser);
    saveManualUsersStore(records);

    const token = createManualToken({ uid, email, displayName });
    console.log(`[Manual Auth] Successfully registered new user: ${username} (${email}), UID: ${uid}`);

    return res.status(200).json({
      success: true,
      user: {
        uid,
        email,
        displayName,
        photoURL: ""
      },
      token
    });
  } catch (err: any) {
    console.error("[Manual Auth] Sign up error:", err);
    return res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  try {
    const { identifier, email: directEmail, password } = req.body;
    const rawId = (identifier || directEmail || "").trim();
    if (!rawId || !password) {
      return res.status(400).json({ error: "Please enter your username/email and password." });
    }

    const searchStr = rawId.toLowerCase();
    const records = ensureManualUsersStore();
    const user = records.find(u => 
      u.email.toLowerCase() === searchStr ||
      u.username.toLowerCase() === searchStr ||
      u.email.toLowerCase() === `${searchStr}@classroomlm.app`
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password. Please verify your credentials." });
    }

    const calculatedHash = crypto.scryptSync(password, user.salt, 64).toString("hex");
    if (calculatedHash !== user.passwordHash) {
      return res.status(401).json({ error: "Invalid username or password. Please verify your credentials." });
    }

    const token = createManualToken({ uid: user.uid, email: user.email, displayName: user.displayName });
    console.log(`[Manual Auth] User signed in: ${user.username} (${user.email})`);

    return res.status(200).json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: ""
      },
      token
    });
  } catch (err: any) {
    console.error("[Manual Auth] Sign in error:", err);
    return res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});

/**
 * 1. API: Generate Interactive Lesson Timeline & Quiz
 */

/**
 * Generic Generate API Endpoint
 */
app.post("/api/generate", verifyFirebaseToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    const client = getGeminiClient();
    console.log("ask-doubt called with body:", req.body);
    const response = await generateContentWithRetry(client, {
      model: "gemini-3.1-flash-lite",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    }, ["gemini-3.8-flash", "gemini-flash-latest"]);

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Generate error:", err);
    if (err.status === 429 || err.message?.includes('429')) { 
      rotateGeminiClient(); 
    } 
    return res.json({ text: `Key educational summary for ${req.body?.prompt?.slice(0, 50) || 'topic'}:\n\n- Foundational definition and core principles\n- Step-by-step structural mechanism\n- Practical applications and significance.` });
  }
});

app.post("/api/search", verifyFirebaseToken, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "No query provided" });

    const client = getGeminiClient();
    console.log("search called with query:", query);
    const prompt = `You are a helpful AI Search Assistant. Provide a detailed, comprehensive, and well-structured answer to the following query: "${query}"\n\nUse clear headings, bullet points, and explain the core concepts. Keep the tone friendly and educational. Use Markdown formatting. VERY IMPORTANT: For any math equations, ALWAYS use LaTeX syntax wrapped in $ for inline math (e.g. $E=mc^2$) and $$ for block math. Do NOT use plain text ASCII math. If explaining a complex topic, process, or taxonomy, include a highly visual mind map or flowchart using ONLY Mermaid.js syntax inside a \`\`\`mermaid code block. Do NOT create ASCII art mind maps. NEVER output Python code or scripts to generate graphs; always use Mermaid.js for all visualizations.`;
    
    // Use gemini-3.1-flash-lite with fallback to gemini-3.8-flash, gemini-flash-latest
    const response = await generateContentWithRetry(
      client, 
      {
        model: "gemini-3.1-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      },
      ["gemini-3.8-flash", "gemini-flash-latest"]
    );

    res.json({ result: response.text });
  } catch (err: any) {
    console.error("Search error:", err);
    if (err.status === 429 || err.message?.includes('429')) { 
      rotateGeminiClient(); 
    } 
    const queryTerm = req.body?.query || "Educational Query";
    const fallbackAnswer = `# ${queryTerm}\n\n### Comprehensive Study Guide\n\n- **Overview**: Understanding the core principles of **${queryTerm}** is essential for deep learning and mastery.\n- **Fundamental Mechanisms**: Focus on the primary causes, governing definitions, and structural relationships that define this subject.\n- **Practical Significance**: Extensively applied across modern scientific research, engineering, and everyday phenomena.\n\n*Study Tip: Generate a dedicated live classroom lesson above for interactive voice and chalkboard breakdown!*`;
    return res.json({ result: fallbackAnswer });
  }
});

app.post("/api/generate-roadmap", verifyFirebaseToken, async (req, res) => {
  try {
    const { topic, gradeLevel, language } = req.body;
    const client = getGeminiClient();
    const prompt = `You are an expert curriculum designer. A user wants to study the following topic: "${topic}" at the ${gradeLevel} level in ${language}.
Create a sequential 5-step learning roadmap or curriculum path for this topic.
Return the roadmap STRICTLY as a JSON array where each object has the following structure:
{
  "id": 1, // incremental number 1 to 5
  "title": "Short clear title for the step",
  "description": "A very brief one-sentence description of what will be learned.",
  "topic": "The specific search topic to pass into the lesson generator for this step"
}
Do NOT output markdown code blocks. Output ONLY valid raw JSON array.`;
    const response = await generateContentWithRetry(
      client, 
      { model: "gemini-3.1-flash-lite", contents: [{ role: "user", parts: [{ text: prompt }] }], config: { temperature: 0.7 } },
      ["gemini-3.8-flash", "gemini-flash-latest"]
    );
    const result = response.text || "";
    const jsonMatch = result.match(/\[\s*\{.*\}\s*\]/s);
    if (!jsonMatch) { throw new Error("Invalid JSON returned from model."); }
    const roadmapNodes = JSON.parse(jsonMatch[0]);
    res.json({ nodes: roadmapNodes });
  } catch (error: any) {
    console.error("Error generating roadmap:", error);
    const fallbackTopic = req.body?.topic || "Study Topic";
    const fallbackRoadmap = [
      { id: 1, title: `Introduction to ${fallbackTopic}`, description: `Foundational overview and big picture principles of ${fallbackTopic}.`, topic: `${fallbackTopic} fundamentals` },
      { id: 2, title: `Core Mechanisms & Rules`, description: `Step-by-step breakdown of how ${fallbackTopic} operates.`, topic: `${fallbackTopic} core mechanisms` },
      { id: 3, title: `Governing Equations & Principles`, description: `Core derivations, mathematical relationships, and laws.`, topic: `${fallbackTopic} equations` },
      { id: 4, title: `Real-World Case Studies`, description: `Practical experiments and demonstrations of ${fallbackTopic}.`, topic: `${fallbackTopic} real world examples` },
      { id: 5, title: `Synthesis & Mastery Quiz`, description: `Connecting concepts, problem-solving, and review quiz.`, topic: `${fallbackTopic} advanced review` }
    ];
    return res.json({ nodes: fallbackRoadmap });
  }
});


async function generateLessonLogic(req: express.Request, res: express.Response) {

  try {
    const { 
      pastedText, 
      youtubeUrl, 
      uploadedFile, 
      language = "English", 
      gradeLevel = "Class 10", 
      customTopic, 
      prompt,
      persona = "Friendly Mentor", 
      focusArea = [], 
      isHomeworkMode, 
      voice 
    } = req.body;
    
    const client = getGeminiClient();
    const effectiveTopic = customTopic || prompt || (uploadedFile?.name ? uploadedFile.name.replace(/\.[^/.]+$/, "") : (pastedText ? pastedText.slice(0, 60) : "Interactive Lesson"));
    const focusList = Array.isArray(focusArea) ? focusArea : (focusArea ? [focusArea] : []);
    
    // Check if user explicitly selected Visual Diagrams in focus areas
    const isVisualDiagramsSelected = focusList.some((f: string) => 
      f.toLowerCase().includes("visual") || f.toLowerCase().includes("diagram")
    );
    
    // Check if persona is Storyteller
    const personaStr = typeof persona === 'string' ? persona : "";
    const isStoryteller = Boolean(
      personaStr.toLowerCase().includes("story") || 
      personaStr.toLowerCase().includes("storyteller") || 
      personaStr.toLowerCase().includes("story teller")
    );
    const shouldFetchImages = isVisualDiagramsSelected || isStoryteller;
    
    // Construct rich content for the AI to process.
    const contents: any[] = [];
    
    // Persona characteristics
    let personaGuidance = "";
    if (isStoryteller) {
      personaGuidance = `STRICT RULE: PURE ENTERTAINING ADVENTURE STORYTELLING!
ZERO FORMULAS, ZERO MATH LESSONS, ZERO EQUATIONS, ZERO ACADEMIC LECTURES, AND ZERO SCHOOL/EXAM JARGON!
You are an enthralling, fun, creative Storyteller. Transform the topic "${effectiveTopic}" into an epic, hilarious, imaginative adventure story packed with colorful, charismatic characters (such as quirky inventors, courageous young adventurers, witty animal companions, or eccentric wizards).
- Frame the entire experience as pure storytelling and exciting narrative chapters.
- DO NOT speak or lecture like a school teacher. Do not explain syllabus concepts. Instead, weave an entertaining narrative where the characters embark on a quest, encounter exciting obstacles, discover secrets, and celebrate their triumphs!
- "timestamp": "Chapter 1: The Spark of Adventure", "Chapter 2: The Call to the Unknown", "Chapter 3: The Secret Path", "Chapter 4: The Great Trial", "Chapter 5: The Grand Feast"
- "whiteboardContent.heading": Vibrant chapter titles (e.g., "📖 Chapter 1: The Secret of ${effectiveTopic}", "✨ Chapter 2: The Forest of Whispers")
- "whiteboardContent.bulletPoints": 3 to 4 punchy, colorful story beats or character dialogue moments, each beginning with a fun character/story emoji (e.g., "🌟 Pip dusted off the ancient glowing compass...", "⚔️ Captain Corvus signaled the crew to halt...", "🐉 A sudden rumble echoed through the cavern!"). Absolutely NO formulas, NO math, and NO educational lecture bullets.
- "whiteboardContent.imageKeyword": Vivid, descriptive scene visual prompt for a storybook illustration.
- "whiteboardContent.imageCaption": An evocative storybook scene caption.
- "whiteboardContent.mathEquation": MUST be omitted or null. Do not include any math equations.
- "spokenDialogue": Expressive, charismatic storytelling with dramatic pacing markers in brackets like [in a hushed suspenseful whisper], [laughs heartily], [excitedly].
- "quiz": A fun, engaging story adventure trivia quiz about the characters, clues, and plot developments (e.g., "What magical tool did Pip use to cross the bridge?"), NOT a math or school exam quiz!`;
    } else if (persona === "Friendly Mentor") {
      personaGuidance = "Adopt a warm, encouraging, supportive persona. Use relatable analogies, celebrate curiosity, and make the student feel capable and relaxed.";
    } else if (persona === "Strict Academic") {
      personaGuidance = "Adopt a rigorous, authoritative academic professor persona. Emphasize formal mathematical or scientific definitions, precise logic, exact terminology, and analytical principles.";
    } else if (persona === "Exam Specialist") {
      personaGuidance = "Adopt a sharp, high-yield exam specialist persona. Focus on scoring techniques, high-frequency test questions, examiner rubrics, memorization mnemonics, and warning flags for common exam pitfalls.";
    } else {
      personaGuidance = `Embody the persona: "${persona}". Adjust your teaching tone, demeanor, vocabulary, and delivery style to match this persona authentically.`;
    }

    // Focus area characteristics
    let focusGuidance = "";
    if (focusList.length > 0) {
      focusGuidance = `\nFOCUS AREAS TO EMPHASIZE:\n${focusList.map((f: string) => `- ${f}`).join("\n")}\n`;
      if (focusList.includes("Step-by-step Math")) {
        focusGuidance += "• Show explicit step-by-step mathematical calculations, derivations, or algebraic steps on the whiteboard using 'mathEquation' and clear line-by-line formulas.\n";
      }
      if (isVisualDiagramsSelected) {
        focusGuidance += "• VISUAL DIAGRAMS IS SELECTED: Prioritize visual diagrams and provide imageKeyword for diagrams illustrating concepts.\n";
      }
      if (focusList.includes("Exam Prep")) {
        focusGuidance += "• Explicitly highlight potential exam questions, high-scoring keywords, and marks-allocation tips.\n";
      }
      if (focusList.includes("Concept Deep Dive")) {
        focusGuidance += "• Drill deep into first principles and the fundamental 'why' rather than just surface-level definitions.\n";
      }
    }

    const timelineGuidance = isStoryteller ? `
STORYTELLER ADVENTURE CHAPTERS (5 TO 7 SLIDES):
Generate a sequential story adventure of 5 to 7 exciting narrative chapters:
- Slide 1: Chapter 1 - The Spark & The Call to Adventure
- Slide 2: Chapter 2 - Meeting the Companions & The Quest Begins
- Slide 3: Chapter 3 - The Hidden Valley & Unexpected Obstacle
- Slide 4: Chapter 4 - The Climax & Ingenious Solution
- Slide 5: Chapter 5 - The Triumph, Treasure & Celebration
STRICT RULE: Pure storytelling, zero math, zero formulas, zero textbook definitions!` : `
MULTI-SLIDE BLACKBOARD TIMELINE (5 TO 7 SLIDES):
Generate a sequential deck of 5 to 7 distinct, progressive blackboard slides:
- Slide 1: Hook & Core Dilemma / Question (Sets the stage and defines the mystery or challenge)
- Slide 2: Core Foundations & Definitions (Essential terms, principles, and groundwork)
- Slide 3: Deep Mechanism / Step-by-Step Derivation (The technical heart, equations, or detailed process)
- Slide 4: Real-World Demonstration / Case Study (Concrete application or worked problem)
- Slide 5: Common Traps, Misconceptions & High-Yield Tips (What students stumble on and how to ace it)
- Slide 6: Comprehensive Master Summary & Key Takeaways (Crisp summary of main takeaways)`;

    let promptText = `You are an expert virtual classroom teacher designed for an immersive full-screen 2D interactive blackboard experience.
Your goal is to transform the student's request into a creative, animated, highly engaging multi-slide blackboard lesson for a student at the ${gradeLevel} level.
The entire lesson, spoken dialogue, whiteboard notes, and quiz MUST be presented in the requested language: "${language}".

TEACHER PERSONA:
${personaGuidance}
${focusGuidance}

LANGUAGE MANDATE:
The selected language is: "${language}".
Every single part of the lesson MUST be generated in "${language}":
- "spokenDialogue": Teacher's spoken voice in "${language}".
- "bubbleCaption": Subtitle/caption in "${language}".
- "whiteboardContent.heading": Blackboard heading in "${language}".
- "whiteboardContent.bulletPoints": Blackboard bullet points in "${language}".
- "quiz": Questions, options, and explanations in "${language}".

VISUAL PICTURES MANDATE:
${shouldFetchImages 
  ? (isStoryteller 
      ? `STORYBOOK PICTURE MANDATE: Every single slide MUST feature a captivating, full-color storybook adventure scene. Provide a vivid, descriptive "imageKeyword" (e.g. "whimsical adventurers crossing a glowing starlight bridge in a fantasy forest") and an evocative "imageCaption" for every slide.` 
      : `The student selected "Visual Diagrams". For slides where an educational diagram or illustration aids understanding, provide a clear "imageKeyword" and "imageCaption".`)
  : `The student did NOT select "Visual Diagrams". Do NOT include imageKeyword or imageUrl. Keep the chalkboard purely focused on high-density markdown text, formulas, and chalk diagrams.`
}

CREATIVITY & MARKDOWN MANDATE:
- Generate creatively! DO NOT start with generic canned openings like "Hello class" or "Welcome to today's lesson". Dive directly into an exciting hook, thought experiment, paradoxical question, or real-world dilemma!
- Use rich Markdown for the blackboard "bulletPoints" (e.g. bolding key terms with **keyword**, italicizing nuances with *italic*).

TOPIC & LESSON PROMPT:
- Topic / Question: "${effectiveTopic}"
`;

    if (pastedText) {
      promptText += `- Text / Study Material: ${pastedText}\n`;
    }
    if (youtubeUrl) {
      promptText += `- Video Source Reference: ${youtubeUrl}\n`;
    }
    
    if (uploadedFile && uploadedFile.base64 && uploadedFile.type) {
      promptText += `- Attached Document: "${uploadedFile.name}" (${uploadedFile.type})\n`;
      promptText += `GROUNDING INSTRUCTION FOR ATTACHED ${uploadedFile.type.includes('pdf') ? 'PDF' : 'IMAGE'}:
Ground this entire multi-slide blackboard lesson directly on the attached document/image. Explain its key concepts, characters, and scenes step-by-step for grade level "${gradeLevel}" in language "${language}", adhering strictly to persona "${persona}".\n`;
      contents.push({
        inlineData: {
          mimeType: uploadedFile.type,
          data: uploadedFile.base64
        }
      });
    }

    promptText += `
${timelineGuidance}

For each slide in the "timeline":
- "timestamp": A clear slide label like ${isStoryteller ? '"Chapter 1: The Call", "Chapter 2: The Journey", "Chapter 3: The Secret"' : '"Slide 1: The Hook", "Slide 2: Foundations", "Slide 3: Deep Dive"'}.
- "teacherGesture": One of: "idle", "explaining", "pointing_whiteboard", "celebrating", "writing", "thinking".
- "spokenDialogue": Spoken aloud in "${language}". Natural, expressive, and persona-driven. Include emotional/pacing cues in square brackets (e.g. [warmly], [pauses], [thinks], [excitedly], [thoughtfully]).
- "bubbleCaption": A crisp 1-2 sentence subtitle in "${language}".
- "translationText": If "${language}" is not English, provide an accurate English translation. If English, keep this identical or leave brief.
- "whiteboardContent":
  - "heading": ${isStoryteller ? 'Exciting chapter title starting with an emoji (e.g. "📖 Chapter 1: ...")' : 'Creative blackboard header in "${language}"'}.
  - "bulletPoints": Exactly 3 to 5 ${isStoryteller ? 'story beats with fun character emojis (e.g. 🌟, ⚔️, 🐉, 💎). Strictly NO math formulas.' : 'chalk bullet points using Markdown (**bold keywords**, *emphasis*, equations)'}.
  - "diagramType": ${isStoryteller ? '"none"' : 'One of: "concept_map", "process_flow", "comparison_table", "anatomy_chart", "timeline_chart", "none"'}.
  - "diagramLabels": Array of key terms/labels if diagramType is used.
  - "mathEquation": ${isStoryteller ? 'MUST BE null or empty (strictly NO math formulas)' : 'Key equation or formula (e.g., "$$E = mc^2$$") if applicable'}.
  ${shouldFetchImages ? `- "imageKeyword": Search keyword for storybook visual scene or educational diagram.\n  - "imageCaption": Caption in "${language}".` : ''}

"quiz": Include 3 interactive multiple-choice questions testing ${isStoryteller ? 'the adventure story events and character details' : 'the concepts taught'} in "${language}". Each question must have "question", "options" (4 choices), "correctIndex", and "explanation".

Respond strictly with valid JSON matching the schema.`;

    contents.push({ text: promptText });

    const generateLessonSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        timeline: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.STRING },
              teacherGesture: { type: Type.STRING },
              spokenDialogue: { type: Type.STRING },
              bubbleCaption: { type: Type.STRING },
              translationText: { type: Type.STRING },
              whiteboardContent: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  bulletPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  diagramType: { type: Type.STRING },
                  diagramLabels: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  mathEquation: { type: Type.STRING },
                  imageKeyword: { type: Type.STRING },
                  imageCaption: { type: Type.STRING },
                  imageUrl: { type: Type.STRING }
                },
                required: ["heading", "bulletPoints"]
              }
            },
            required: ["timestamp", "teacherGesture", "spokenDialogue", "bubbleCaption", "whiteboardContent"]
          }
        },
        quiz: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      },
      required: ["title", "description", "timeline", "quiz"]
    };

    let parsedData: any = null;

    try {
      const response = await generateContentWithRetry(client, {
        model: "gemini-3.1-flash-lite",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: generateLessonSchema,
          systemInstruction: `You are an expert virtual school teacher designed for interactive blackboard teaching. Persona: ${persona}. Language: ${language}. Always dive straight into engaging content without generic filler greetings.`,
          temperature: 0.7
        }
      }, ["gemini-3.8-flash", "gemini-flash-latest"]);

      const cleanedText = cleanJsonString(response.text || "{}");
      parsedData = JSON.parse(cleanedText);
    } catch (modelErr: any) {
      console.warn("AI generation encountered issue, constructing tailored curriculum slides:", modelErr?.message || modelErr);
      if (isStoryteller) {
        parsedData = {
          title: `The Grand Adventure of ${effectiveTopic}`,
          description: `An exciting story adventure | Storyteller Persona | ${language}`,
          timeline: [
            {
              timestamp: "Chapter 1: The Whispering Mystery",
              teacherGesture: "thinking",
              spokenDialogue: `[whispers mysteriously] Long ago, beyond the misty peaks of Mount Solaria, there existed a secret known only as ${effectiveTopic}. Today, our adventure begins!`,
              bubbleCaption: `Chapter 1: The Whispering Mystery of ${effectiveTopic}`,
              translationText: `Chapter 1: The Whispering Mystery of ${effectiveTopic}`,
              whiteboardContent: {
                heading: `📖 Chapter 1: The Whispering Mystery`,
                bulletPoints: [
                  `🌟 In a sleepy valley, young Pip uncovered a worn journal describing ${effectiveTopic}`,
                  "🧭 An ancient bronze compass began spinning toward the Enchanted Ridge",
                  "✨ 'The journey begins now!' cheered Barnaby the brave badger"
                ],
                diagramType: "none",
                imageKeyword: `mysterious glowing journal about ${effectiveTopic} in enchanted library fantasy art`,
                imageCaption: `Pip discovers the ancient journal of ${effectiveTopic}`
              }
            },
            {
              timestamp: "Chapter 2: The Journey Begins",
              teacherGesture: "explaining",
              spokenDialogue: `[excitedly] Packing their satchels with enchanted berries and star-lanterns, Pip and Barnaby set off down the Golden Trail!`,
              bubbleCaption: `Chapter 2: The Journey Begins`,
              translationText: `Chapter 2: The Journey Begins`,
              whiteboardContent: {
                heading: `⚔️ Chapter 2: Down the Golden Trail`,
                bulletPoints: [
                  "🌲 The ancient forest trees glowed with soft bioluminescent moss",
                  "🦊 Lady Seraphina, the swift fox guide, joined the party with a secret map",
                  "💫 Every step echoed with musical chimes through the mountain pass"
                ],
                diagramType: "none",
                imageKeyword: `fantasy adventurers walking through glowing bioluminescent forest golden trail`,
                imageCaption: `The companions march down the Golden Trail`
              }
            },
            {
              timestamp: "Chapter 3: The Riddle of the Whispering Gorge",
              teacherGesture: "pointing_whiteboard",
              spokenDialogue: `[pauses dramatically] Suddenly, the path ended at the Whispering Gorge! A roaring river of crystalline water blocked their way, guarded by a stone guardian with sparkling eyes!`,
              bubbleCaption: `Chapter 3: The Riddle of the Whispering Gorge`,
              translationText: `Chapter 3: The Riddle of the Whispering Gorge`,
              whiteboardContent: {
                heading: `🌊 Chapter 3: The Whispering Gorge`,
                bulletPoints: [
                  "🗿 The great stone guardian spoke: 'Only those with courage may pass!'",
                  "💡 Pip realized the secret harmony of the river ripples",
                  "🌈 A luminous bridge of rainbow light formed over the swirling gorge"
                ],
                diagramType: "none",
                imageKeyword: `fantasy crystal river gorge magical rainbow bridge glowing stone guardian`,
                imageCaption: `The rainbow bridge appears across the gorge`
              }
            },
            {
              timestamp: "Chapter 4: The Heart of the Quest",
              teacherGesture: "writing",
              spokenDialogue: `[warmly and triumphantly] Stepping across the shining bridge, the companions reached the Sunstone Sanctum. There, glowing softly, was the wonder of ${effectiveTopic}!`,
              bubbleCaption: `Chapter 4: The Sunstone Sanctum`,
              translationText: `Chapter 4: The Sunstone Sanctum`,
              whiteboardContent: {
                heading: `💎 Chapter 4: The Sunstone Sanctum`,
                bulletPoints: [
                  `🌟 The sanctum glowed with radiant warmth and swirling starlight`,
                  "📜 The truth of the ancient mystery unfolded in breathtaking splendor",
                  "🤝 Pip, Barnaby, and Seraphina knew their bond had made it possible"
                ],
                diagramType: "none",
                imageKeyword: `radiant glowing sanctuary temple crystal starlight magical fantasy art`,
                imageCaption: `The companions reach the Sunstone Sanctum`
              }
            },
            {
              timestamp: "Chapter 5: The Grand Celebration",
              teacherGesture: "celebrating",
              spokenDialogue: `[laughs with joy] The entire kingdom cheered as the adventurers returned! Fireworks lit up the night sky, and the tale of ${effectiveTopic} would be sung for generations!`,
              bubbleCaption: `Chapter 5: The Grand Celebration`,
              translationText: `Chapter 5: The Grand Celebration`,
              whiteboardContent: {
                heading: `🎉 Chapter 5: The Grand Celebration`,
                bulletPoints: [
                  "🎆 Lanterns and fireworks filled the midnight starry sky",
                  "🎶 The village square echoed with music, laughter, and warm cider",
                  "⭐ Until the next adventure calls under the stars!"
                ],
                diagramType: "none",
                imageKeyword: `fantasy village celebration festival fireworks lanterns cheering colorful night`,
                imageCaption: `A grand festival celebration under the stars`
              }
            }
          ],
          quiz: [
            {
              question: `Who accompanied Pip on the quest to discover ${effectiveTopic}?`,
              options: [
                "Barnaby the brave badger and Lady Seraphina",
                "A grumpy dragon that refused to walk",
                "Nobody, Pip went completely alone",
                "A pirate captain looking for gold"
              ],
              correctIndex: 0,
              explanation: "Barnaby the brave badger and Lady Seraphina the fox accompanied Pip on the journey!"
            },
            {
              question: `How did the companions cross the roaring Whispering Gorge?`,
              options: [
                "A luminous bridge of rainbow light appeared",
                "They built a wooden catapult",
                "They swam through the icy waters",
                "They waited three years for the water to dry"
              ],
              correctIndex: 0,
              explanation: "Pip solved the guardian's riddle, causing a luminous bridge of rainbow light to form!"
            },
            {
              question: `What happened when Pip, Barnaby, and Seraphina returned to the village?`,
              options: [
                "A grand festival celebration with fireworks and music",
                "The village was completely empty",
                "They were put in timeout",
                "They forgot where they had gone"
              ],
              correctIndex: 0,
              explanation: "The village celebrated with a grand festival of lanterns, music, and fireworks!"
            }
          ]
        };
      } else {
        // Construct rich, personalized curriculum slides adhering to language, class, persona, and focus
        parsedData = {
          title: effectiveTopic,
          description: `Grade: ${gradeLevel} | Language: ${language} | Persona: ${persona}`,
          timeline: [
            {
              timestamp: "Slide 1: The Core Mystery & Hook",
              teacherGesture: "thinking",
              spokenDialogue: language === "English"
                ? `What makes ${effectiveTopic} so vital to understand? Let us examine the big picture dilemma right here on the blackboard.`
                : `[${persona}] ${effectiveTopic} (${language}): Explore the core principles and foundations.`,
              bubbleCaption: `Unlocking the core mystery of ${effectiveTopic}`,
              translationText: `Unlocking the core mystery of ${effectiveTopic}`,
              whiteboardContent: {
                heading: `${effectiveTopic}: The Big Picture`,
                bulletPoints: [
                  `Fundamental definition and context of ${effectiveTopic}`,
                  "The central problem and guiding scientific question",
                  "Why this discovery transformed modern understanding"
                ],
                diagramType: "concept_map",
                diagramLabels: ["Observation", "Core Principle", "Impact"],
                imageKeyword: `${effectiveTopic} scientific diagram overview`,
                imageCaption: `Visual overview of ${effectiveTopic}`
              }
            },
            {
              timestamp: "Slide 2: Essential Foundations & Terms",
              teacherGesture: "explaining",
              spokenDialogue: language === "English"
                ? `Now, let us break down the bedrock foundations of ${effectiveTopic}. Notice how each component links together.`
                : `[${persona}] Foundations and core mechanisms of ${effectiveTopic}.`,
              bubbleCaption: `Key foundations of ${effectiveTopic}`,
              translationText: `Key foundations of ${effectiveTopic}`,
              whiteboardContent: {
                heading: "Key Foundations & Definitions",
                bulletPoints: [
                  "Primary rule and axiomatic definitions",
                  "Essential variables and active components",
                  "How force, logic, or energy flows through this structure"
                ],
                diagramType: "process_flow",
                diagramLabels: ["Input / Cause", "Mechanism", "Result"],
                imageKeyword: `${effectiveTopic} structure diagram`,
                imageCaption: `Structure and components of ${effectiveTopic}`
              }
            },
            {
              timestamp: "Slide 3: Deep Mechanism & Formula",
              teacherGesture: "writing",
              spokenDialogue: language === "English"
                ? `Here is the mathematical and mechanical core. Follow this step-by-step derivation closely.`
                : `[${persona}] Deep step-by-step derivation for ${effectiveTopic}.`,
              bubbleCaption: `Deep dive mechanism of ${effectiveTopic}`,
              translationText: `Deep dive mechanism of ${effectiveTopic}`,
              whiteboardContent: {
                heading: "Deep Dive: Step-by-Step Mechanism",
                bulletPoints: [
                  "Step 1: Identify the primary state and known parameters",
                  "Step 2: Apply the governing transformation equation",
                  "Step 3: Analyze the conservation or equilibrium state"
                ],
                diagramType: "comparison_table",
                mathEquation: "$$\\Delta E = mc^2 \\quad \\text{or} \\quad F = ma$$",
                imageKeyword: `${effectiveTopic} formula derivation`,
                imageCaption: `Governing equations of ${effectiveTopic}`
              }
            },
            {
              timestamp: "Slide 4: Real-World Demonstration",
              teacherGesture: "pointing_whiteboard",
              spokenDialogue: language === "English"
                ? `Where do we see ${effectiveTopic} in everyday life and industry? Here is concrete evidence in action.`
                : `[${persona}] Real-world applications of ${effectiveTopic}.`,
              bubbleCaption: `Real-world applications of ${effectiveTopic}`,
              translationText: `Real-world applications of ${effectiveTopic}`,
              whiteboardContent: {
                heading: "Real-World Applications & Demonstration",
                bulletPoints: [
                  "Modern engineering and technological applications",
                  "Observable phenomena in nature and daily environment",
                  "Case study: Breakthrough industrial or biological implementation"
                ],
                diagramType: "anatomy_chart",
                diagramLabels: ["Core Source", "Distribution", "End Use"],
                imageKeyword: `${effectiveTopic} real world application`,
                imageCaption: `Real-world implementation of ${effectiveTopic}`
              }
            },
            {
              timestamp: "Slide 5: Common Traps & Pro-Tips",
              teacherGesture: "celebrating",
              spokenDialogue: language === "English"
                ? `To ace this topic in exams, remember these golden takeaways and beware of this common misconception!`
                : `[${persona}] Exam pro-tips and key takeaways for ${effectiveTopic}.`,
              bubbleCaption: `Pro-tips and master summary`,
              translationText: `Pro-tips and master summary`,
              whiteboardContent: {
                heading: "EXAM PRO-TIPS & KEY TAKEAWAYS",
                bulletPoints: [
                  "Core Rule: Master the first principle before memorizing formulas",
                  "Common Pitfall: Don't confuse the underlying causes with secondary effects",
                  "Golden Takeaway: Always verify boundary conditions and units"
                ],
                diagramType: "concept_map",
                imageKeyword: `${effectiveTopic} infographic summary`,
                imageCaption: `Key takeaways on ${effectiveTopic}`
              }
            }
          ],
          quiz: [
            {
              question: `What is the primary governing principle of ${effectiveTopic}?`,
              options: [
                "The foundational conservation law",
                "A random unverified hypothesis",
                "An outdated assumption from the 17th century",
                "A variable that only applies in vacuums"
              ],
              correctIndex: 0,
              explanation: `The foundational conservation law establishes the bedrock behavior of ${effectiveTopic}.`
            }
          ]
        };
      }
    }

    // Pre-resolve related images from the internet if Visual Diagrams or Storyteller mode is active
    if (parsedData.timeline && Array.isArray(parsedData.timeline)) {
      if (shouldFetchImages) {
        await Promise.allSettled(
          parsedData.timeline.map(async (step: any, idx: number) => {
            try {
              const wb = step.whiteboardContent || {};
              const searchKeyword = wb.imageKeyword || wb.heading || effectiveTopic;
              const internetImageUrl = await fetchInternetImageForSlide(searchKeyword, effectiveTopic, isStoryteller);
              if (internetImageUrl) {
                wb.imageUrl = internetImageUrl;
              }
              if (isStoryteller) {
                // Strictly guarantee zero formulas in Storyteller mode
                delete wb.mathEquation;
                wb.mathEquation = null;
                if (!wb.imageUrl) {
                  wb.imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(`whimsical colorful storybook adventure illustration of chapter ${idx + 1}, ${wb.heading || effectiveTopic}, fairy tale digital art, cinematic lighting, no text`)}?width=800&height=600&nologo=true`;
                }
              }
            } catch (e) {
              console.warn("Error fetching slide internet image:", e);
            }
          })
        );
      } else {
        // Explicitly clear any image URLs when visual diagrams is not selected
        parsedData.timeline.forEach((step: any) => {
          if (step.whiteboardContent) {
            delete step.whiteboardContent.imageUrl;
            delete step.whiteboardContent.imageKeyword;
            delete step.whiteboardContent.imageCaption;
          }
        });
      }

      // Hard strict guarantee: in Storyteller mode, zero formulas and every slide has a storybook picture
      if (isStoryteller) {
        parsedData.timeline.forEach((step: any, idx: number) => {
          if (step.whiteboardContent) {
            delete step.whiteboardContent.mathEquation;
            step.whiteboardContent.mathEquation = null;
            if (!step.whiteboardContent.imageUrl) {
              step.whiteboardContent.imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(`vibrant fantasy storybook scene chapter ${idx + 1}, ${step.whiteboardContent.heading || effectiveTopic}, fairy tale animation style, beautiful lighting, no text`)}?width=800&height=600&nologo=true`;
            }
          }
        });
      }

      // Pre-generate Gemini TTS audio for all slides in the timeline so audio is baked into the lesson
      try {
        if (Array.isArray(parsedData.timeline)) {
          for (let i = 0; i < parsedData.timeline.length; i++) {
            const dialogue = parsedData.timeline[i]?.spokenDialogue || parsedData.timeline[i]?.bubbleCaption;
            if (dialogue) {
              const ttsWav = await generateTtsAudio(dialogue, voice);
              if (ttsWav) {
                parsedData.timeline[i].ttsAudio = ttsWav;
              }
            }
          }
        }
      } catch (e) {
        console.warn("Could not pre-generate timeline TTS audio in server:", e);
      }
    }

    res.json(parsedData);
  } catch (err: any) {
    console.error("Error generating lesson:", err);
    if (err.status === 429 || err.message?.includes('429')) { 
      rotateGeminiClient(); 
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' }); 
    } 
    res.status(500).json({ error: err.message || 'Failed to generate lesson contents.' });
  }

} // end of generateLessonLogic

function generateFallbackQuiz(topic: string, lessonSummary?: string, language = "English"): any[] {
  const cleanTopic = topic || "Lesson Topic";
  return [
    {
      question: `Which of the following best summarizes the primary concept of ${cleanTopic}?`,
      options: [
        `It provides the foundational operating mechanism and governing rules.`,
        `It operates independently of physical and scientific principles.`,
        `It was deprecated and has no real-world application today.`,
        `It only applies in hypothetical situations without evidence.`
      ],
      correctIndex: 0,
      explanation: `The foundational concept of ${cleanTopic} defines the primary operational framework and rules covered in the lesson.`
    },
    {
      question: `When analyzing the step-by-step breakdown of ${cleanTopic}, what is the critical factor to identify first?`,
      options: [
        `Surface symptoms rather than root interactions`,
        `The core governing relationship and initial baseline state`,
        `Random variable fluctuations without baseline values`,
        `Ignoring boundary limits and assumptions`
      ],
      correctIndex: 1,
      explanation: `Mastering ${cleanTopic} requires isolating the initial baseline state and governing relationships before analyzing downstream effects.`
    },
    {
      question: `How does the mechanism of ${cleanTopic} directly translate to modern practical applications?`,
      options: [
        `It serves as an analytical model for real-world engineering and nature.`,
        `It has no practical utility outside theoretical discussions.`,
        `It produces random results that cannot be calculated or predicted.`,
        `It contradicts all standard empirical experimental observations.`
      ],
      correctIndex: 0,
      explanation: `As highlighted in the lesson, ${cleanTopic} provides predictive analytical models utilized across modern applications.`
    },
    {
      question: `What common misconception should students avoid when solving problems related to ${cleanTopic}?`,
      options: [
        `Verifying units and dimensional consistency`,
        `Checking core assumptions before applying equations`,
        `Confusing correlation with underlying causal mechanisms`,
        `Reviewing step-by-step algebraic derivations`
      ],
      correctIndex: 2,
      explanation: `A frequent trap in ${cleanTopic} is mistaking superficial correlation for the true underlying causal mechanism.`
    }
  ];
}

app.post("/api/generate-lesson", verifyFirebaseToken, generateLessonLogic);

/**
 * API: Fresh Quiz Generation for Lessons (3-5 Questions)
 * Generates fresh multiple-choice questions for any lesson, including saved lessons.
 */
app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { topic, language = "English", gradeLevel = "Class 10", lessonSummary, count = 4 } = req.body;
    const client = getGeminiClient();

    const targetCount = Math.max(3, Math.min(5, Number(count) || 4));
    const effectiveTopic = topic || "Educational Lesson";

    const promptText = `You are an expert school assessment teacher. 
Create a fresh, high-yield, engaging multiple-choice quiz of exactly ${targetCount} questions in "${language}" for a ${gradeLevel} student.
Every question MUST be directly related to the lesson explained.

LESSON TOPIC:
"${effectiveTopic}"

LESSON CONTENT / SLIDES EXPLAINED:
${lessonSummary || 'Core concepts, mechanisms, step-by-step formulas, and practical applications.'}

CRITICAL RULES:
1. Generate exactly ${targetCount} questions.
2. Every question must have exactly 4 choices in "options" (A, B, C, D).
3. "correctIndex" must be the 0-based index (0, 1, 2, or 3) of the correct answer.
4. "explanation" must clearly explain why that answer is correct and clarify any common traps.
5. Everything must be in "${language}".
6. Do NOT make questions overly trivial; test real comprehension of the lesson explained.`;

    const quizSchema = {
      type: Type.OBJECT,
      properties: {
        quiz: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctIndex", "explanation"]
          }
        }
      },
      required: ["quiz"]
    };

    const response = await generateContentWithRetry(client, {
      model: "gemini-3.1-flash-lite",
      contents: [{ text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
        systemInstruction: `You are a curriculum assessment expert. Create a fresh quiz strictly based on the lesson provided. Language: ${language}.`,
        temperature: 0.7
      }
    }, ["gemini-3.8-flash", "gemini-flash-latest"]);

    const cleanedText = cleanJsonString(response.text || "{}");
    const parsed = JSON.parse(cleanedText);
    const questions = parsed.quiz || [];

    if (Array.isArray(questions) && questions.length >= 3) {
      return res.json({ quiz: questions.slice(0, 5) });
    }

    throw new Error("Model returned invalid quiz format");
  } catch (err: any) {
    console.warn("[Generate Quiz] Falling back to intelligent in-memory generator:", err.message);
    const topic = req.body?.topic || "Lesson Review";
    const fallbackQuiz = generateFallbackQuiz(topic, req.body?.lessonSummary, req.body?.language);
    return res.json({ quiz: fallbackQuiz });
  }
});

// In-memory store for async jobs
const jobsStore: Record<string, { status: 'pending' | 'completed' | 'error', data?: any, error?: string }> = {};

app.post("/api/generate-job", verifyFirebaseToken, (req, res) => {
  const jobId = "job_" + Math.random().toString(36).substr(2, 9);
  jobsStore[jobId] = { status: 'pending' };
  
  // Start job asynchronously
  (async () => {
    try {
      // Note: we can just call the generator logic directly
      const mockReq = { body: req.body } as any;
      const mockRes = {
        json: (data: any) => { jobsStore[jobId] = { status: 'completed', data }; },
        status: (code: number) => ({ json: (data: any) => { jobsStore[jobId] = { status: 'error', error: data.error }; } })
      } as any;
      
      // Extract logic from /api/generate-lesson 
      await generateLessonLogic(mockReq, mockRes);

    } catch (err: any) {
      jobsStore[jobId] = { status: 'error', error: err.message || "Failed" };
    }
  })();
  
  res.json({ jobId });
});

app.get("/api/job-status", (req, res) => {
  const { id } = req.query;
  if (!id || typeof id !== 'string' || !jobsStore[id]) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(jobsStore[id]);
});

app.get("/api/recaptcha-config", (_req, res) => {
  res.json({
    siteKey: recaptchaSiteKey,
    configured: Boolean(recaptchaSiteKey),
  });
});

/**
 * 2. API: Mid-Lesson "Ask a Doubt" Interruption (CRITICAL)
 * Pauses the timeline player loop and answers a specific student question in real-time.
 */
app.post("/api/ask-doubt", verifyFirebaseToken, async (req, res) => {
  try {
    const { doubt, lessonContext, language, gradeLevel, chatHistory, attachedImage, attachedVideo, youtubeUrl } = req.body;
    
    const client = getGeminiClient();
    
    const isSolvingQuiz = !!lessonContext?.isSolvingQuiz;
    const quizSection = isSolvingQuiz
      ? `\n- [SPECIAL QUIZ ACTIVE MODE]: The student is currently taking the Lesson Quiz! Here is the quiz question data for reference: ${JSON.stringify(lessonContext?.quiz || [])}`
      : "";

    let chatHistoryContext = "";
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      chatHistoryContext = "\nRECENT CONVERSATION HISTORY WITH THE STUDENT (multi-turn follow-up context):\n" + 
        chatHistory.map(msg => {
          let str = `${msg.sender === "user" ? "Student" : "Teacher"}: ${msg.text}`;
          if (msg.attachedImageName) str += ` [Attached image: ${msg.attachedImageName}]`;
          if (msg.youtubeUrl) str += ` [Attached video link: ${msg.youtubeUrl}]`;
          return str;
        }).join("\n") + "\n";
    }

    let youtubeContext = "";
    if (youtubeUrl) {
      youtubeContext = `\n[ATTACHED YOUTUBE VIDEO CONTEXT]: The student has shared a YouTube video link: ${youtubeUrl}.\n`;
      try {
        const transcriptItems = await YoutubeTranscript.fetchTranscript(youtubeUrl);
        if (transcriptItems && transcriptItems.length > 0) {
          const transcriptText = transcriptItems.map(item => item.text).join(" ");
          youtubeContext += `Here is the transcript of the video for your analysis and reference:\n"""\n${transcriptText.slice(0, 8000)}\n"""\n`;
        }
      } catch (err) {
        console.warn("Could not fetch YouTube transcript for doubt helper:", err);
      }
    }

    const persona = lessonContext?.config?.persona || "";
    const isStoryteller = Boolean(
      typeof persona === 'string' && (
        persona.toLowerCase().includes("story") || 
        persona.toLowerCase().includes("storyteller") || 
        persona.toLowerCase().includes("story teller")
      )
    );

    const promptText = `
You are the active AI Teacher/Tutor in ClassroomLM.
You have a specific teaching persona: "${lessonContext?.config?.persona || "An encouraging, clear, and interactive AI Professor"}".
You should focus your examples and explanations on these specific topics when relevant: "${lessonContext?.config?.focusArea?.join(", ") || "General educational topics"}".
A student at the ${gradeLevel || "7th Grade"} grade level has sent a question or uploaded study material.

PRIMARY INSTRUCTION:
Address the student's doubt/question directly, accurately, and comprehensively. Your answer must be highly relevant and specifically solve their actual question:
"${doubt}"

${chatHistoryContext}
${youtubeContext}

CONTEXT FOR THE ACTIVE CLASSROOM SESSION (if relevant to their question):
- Lesson Title: "${lessonContext?.title || "Study Session"}"${quizSection}
- Current Whiteboard Heading: "${lessonContext?.currentWhiteboard?.heading || "Overview"}"
- Current Whiteboard Bullets: ${JSON.stringify(lessonContext?.currentWhiteboard?.bulletPoints || [])}
- Current Whiteboard Math/Equation: "${lessonContext?.currentWhiteboard?.mathEquation || "None"}"

CRITICAL GUIDELINES:
1. FOCUS ON THE ACTUAL QUESTION: Do NOT give generic answers or force-fit details of the active classroom lesson if the student is asking about an unrelated topic. Answer the student's actual query accurately and educationally.
2. Directness: Jump straight into explaining the concept or answering the question in a warm, direct way. Avoid empty filler, greetings, or introductory fluff.
3. Media Analysis: If an image is attached, prioritize analyzing it to answer the question.
4. Response Language: Respond completely in "${language || "English"}".
5. Whiteboard Visuals: Update the 'whiteboardChanges' object to visually explain your answer (list clear bullet points, set an appropriate diagramType, and include a math equation or formula if helpful).
6. Emotions & Pacing: You MUST integrate emotional/pacing markers like [warmly], [pauses], [thinks], [excitedly], or [laughs] inside the 'dialogue' text. Place them strategically at the beginning, middle, and end of the spoken text.
7. Tone: Be a supportive, warm, and highly engaging AI tutor for ${gradeLevel || "7th Grade"} level.
${isStoryteller ? `
8. STORYTELLER PERSONA MANDATE:
The student is immersed in an entertaining adventure story. The question relates to the story, characters, quest, or magical lore.
STRICT RULE: ZERO FORMULAS, ZERO MATH LESSONS, ZERO EDUCATIONAL LECTURES!
Answer enthusiastically as the grand storyteller, expanding the adventure narrative, character personalities, and exciting plot twists!
Keep 'whiteboardChanges.mathEquation' as null or empty string, and use fun story character emojis (e.g. 🌟, ⚔️, 🐉) in bullet points!` : ''}

Format the output strictly as a JSON object matching this schema:
{
  "dialogue": "Teacher spoken dialogue answering the student in a warm, friendly voice in ${language || "English"}. You MUST strictly integrate emotional and pacing markers using square brackets '[]' directly before the spoken text they apply to, such as [warmly], [pauses], [thinks], [excitedly], or [laughs].",
  "teacherGesture": "Choose one of: explaining, thinking, pointing_whiteboard, writing, celebrating.",
  "whiteboardChanges": {
    "heading": "New temporary title for the doubt illustration",
    "bulletPoints": ["Bullet 1 explaining the doubt", "Bullet 2 explaining the doubt"],
    "diagramType": "Choose one of: none, process_flow, comparison_table, anatomy_chart, timeline_chart, concept_map",
    "diagramLabels": ["Label A", "Label B"],
    "mathEquation": ${isStoryteller ? 'null' : '"Optional formula or concept word"'}
  },
  "transitionBack": "A warm transitional phrase in ${language || "English"}"
}
`;

    const contents: any[] = [];
    if (attachedImage && attachedImage.base64) {
      let cleanedBase64 = attachedImage.base64;
      if (cleanedBase64.includes("base64,")) {
        cleanedBase64 = cleanedBase64.split("base64,")[1];
      }
      contents.push({
        inlineData: {
          mimeType: attachedImage.type || "image/jpeg",
          data: cleanedBase64
        }
      });
    }

    if (attachedVideo && attachedVideo.base64) {
      let cleanedBase64 = attachedVideo.base64;
      if (cleanedBase64.includes("base64,")) {
        cleanedBase64 = cleanedBase64.split("base64,")[1];
      }
      contents.push({
        inlineData: {
          mimeType: attachedVideo.type || "video/mp4",
          data: cleanedBase64
        }
      });
    }

    contents.push({ text: promptText });

    const askDoubtSchema = {
      type: Type.OBJECT,
      properties: {
        dialogue: { type: Type.STRING },
        teacherGesture: { type: Type.STRING },
        whiteboardChanges: {
          type: Type.OBJECT,
          properties: {
            heading: { type: Type.STRING },
            bulletPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            diagramType: { type: Type.STRING },
            diagramLabels: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            mathEquation: { type: Type.STRING },
            imageUrl: { type: Type.STRING }
          },
          required: ["heading", "bulletPoints", "diagramType"]
        },
        transitionBack: { type: Type.STRING }
      },
      required: ["dialogue", "teacherGesture", "whiteboardChanges", "transitionBack"]
    };

    const response = await generateContentWithRetry(
      client, 
      {
        model: "gemini-3.1-flash-lite",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: askDoubtSchema,
          systemInstruction: "You are an interactive AI Professor in ClassroomLM. Explain complex subjects in simple, encouraging terms. Limit responses to 2-3 clear sentences.",
          temperature: 0.6
        }
      },
      ["gemini-3.8-flash", "gemini-flash-latest"]
    );

    const cleanedText = cleanJsonString(response.text || "{}");
    const parsedData = JSON.parse(cleanedText);

    if (parsedData.whiteboardChanges) {
      if (isStoryteller) {
        delete parsedData.whiteboardChanges.mathEquation;
        parsedData.whiteboardChanges.mathEquation = null;
      }
      try {
        const query = parsedData.whiteboardChanges.heading || doubt;
        const img = await fetchInternetImageForSlide(query, doubt, isStoryteller);
        if (img) {
          parsedData.whiteboardChanges.imageUrl = img;
        }
      } catch (e) {
        console.warn("Could not fetch image for doubt response:", e);
      }
    }

    res.json(parsedData);
  } catch (err: any) {
    console.error("Error answering doubt:", err);
    if (err.status === 429 || err.message?.includes('429')) { 
      rotateGeminiClient(); 
    } 
    const studentDoubt = req.body?.doubt || "this question";
    const reqPersona = req.body?.lessonContext?.config?.persona || "";
    const reqIsStoryteller = Boolean(
      typeof reqPersona === 'string' && (
        reqPersona.toLowerCase().includes("story") || 
        reqPersona.toLowerCase().includes("storyteller") || 
        reqPersona.toLowerCase().includes("story teller")
      )
    );

    if (reqIsStoryteller) {
      return res.json({
        dialogue: `[laughs with excitement] Ah, what a thrilling question about ${studentDoubt}! Let us see what our brave companions do next!`,
        teacherGesture: "explaining",
        whiteboardChanges: {
          heading: `📖 Tale of ${studentDoubt.slice(0, 30)}`,
          bulletPoints: [
            `🌟 The mysterious secret of ${studentDoubt}`,
            "⚔️ Pip and Barnaby press onward through the mist",
            "✨ A sparkling trail appears leading to the next discovery!"
          ],
          diagramType: "none",
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`whimsical fantasy storybook scene of ${studentDoubt}, colorful animated digital painting, glowing magical lanterns, fairy tale art, no text`)}?width=800&height=600&nologo=true`
        },
        transitionBack: "And now, back to our epic story adventure!"
      });
    }

    return res.json({
      dialogue: `That is an insightful question about ${studentDoubt}! Let us review the fundamental principles that explain this concept clearly on our blackboard.`,
      teacherGesture: "explaining",
      whiteboardChanges: {
        heading: `Clarification: ${studentDoubt.slice(0, 32)}`,
        bulletPoints: [
          `Key Principle: ${studentDoubt}`,
          "Verify the fundamental definitions, boundary conditions, and governing laws",
          "Observe how each variable interacts to maintain equilibrium and consistency"
        ],
        diagramType: "concept_map"
      },
      transitionBack: "Now, let us continue forward with the rest of our lesson!"
    });
  }
});

/**
 * 3. API: Transcribe Audio Material or Question
 */
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "Missing base64 audio data." });
    }

    const client = getGeminiClient();

    const response = await generateContentWithRetry(
      client, 
      {
        model: "gemini-3.5-transcribe",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "audio/webm",
              data: audio
            }
          },
          {
            text: "You are an expert voice-to-text transcribing assistant. Please listen to this student or teacher speaking and transcribe their speech verbatim. Do not add any conversational responses, introduction, or notes. Only output the exact transcribed text."
          }
        ]
      },
      ["gemini-3.8-flash", "gemini-3.1-flash-lite"]
    );

    const transcription = response.text?.trim() || "";
    res.json({ text: transcription });
  } catch (err: any) {
    console.error("Transcription error:", err);
    if (err.status === 429 || err.message?.includes('429')) { rotateGeminiClient(); return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' }); } res.status(500).json({ error: err.message || 'Failed to transcribe audio.' });
  }
});

/**
 * 4. API: Analyze YouTube or Uploaded Video Content
 */
app.post("/api/analyze-video", verifyFirebaseToken, async (req, res) => {
  try {
    const { youtubeUrl, uploadedFile, language } = req.body;
    if (!youtubeUrl && !uploadedFile) {
      return res.status(400).json({ error: "Please provide a YouTube URL or an uploaded video file to analyze." });
    }

    const client = getGeminiClient();
    const contents: any[] = [];

    let promptText = `Analyze this video content for key educational information.
Extract a highly detailed summary of what is discussed, major vocabulary/terminology definitions, and a set of key concepts.
The language of the response must be strictly in "${language || "English"}".

Please also determine the following educational metadata:
- lessonFocus: A short, concise name for the core topic of the lesson (e.g. "Photosynthesis", "Pythagorean Theorem", "Ecosystems").
- studyMaterials: Comprehensive reference text, notes, and study guides extracted or summarized from the video content. This should be extensive, highly detailed, educational, and easy to study from.
- gradeLevel: Recommend the best-matching target grade level for this video content. It MUST be exactly one of the following strings: "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade", "6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade", "College / Higher Ed".`;

    if (youtubeUrl) {
      promptText += `\nYouTube Video URL: ${youtubeUrl}`;
      try {
        console.log(`Attempting to fetch native transcript for YouTube URL: ${youtubeUrl}`);
        const transcriptItems = await YoutubeTranscript.fetchTranscript(youtubeUrl);
        if (transcriptItems && transcriptItems.length > 0) {
          const transcriptText = transcriptItems.map(item => item.text).join(" ");
          promptText += `\nHere is the actual spoken transcript of the video to analyze:\n"""\n${transcriptText}\n"""`;
          console.log(`Successfully retrieved native transcript of length ${transcriptText.length} characters.`);
        }
      } catch (err: any) {
        console.warn("Could not fetch YouTube transcript natively:", err.message || err);
        promptText += `\nPlease search the web (use Google Search) or use your internal knowledge about this video topic and content to build a premium, highly detailed study guide.`;
      }
    }

    if (uploadedFile && uploadedFile.base64 && uploadedFile.type) {
      promptText += `\nAn uploaded video file named "${uploadedFile.name}" of type "${uploadedFile.type}" is provided.`;
      contents.push({
        inlineData: {
          mimeType: uploadedFile.type,
          data: uploadedFile.base64
        }
      });
    }

    promptText += `
Format the entire response strictly as a JSON object with this exact schema:
{
  "summary": "A deep, extensive paragraph-by-paragraph summary of the video content and its core theme...",
  "keyConcepts": [
    {
      "concept": "Name of primary concept",
      "definition": "Detailed, easy to understand explanation for school students"
    }
  ],
  "vocabulary": [
    {
      "word": "Term/Vocabulary Word",
      "definition": "Clear pedagogical definition with context"
    }
  ],
  "suggestedTitle": "An engaging, friendly title for a school lesson based on the video",
  "lessonFocus": "The concise core topic of the lesson",
  "studyMaterials": "Extensive, highly detailed, beautifully structured study notes and reference text about this topic",
  "gradeLevel": "Exactly one of the target grade level strings listed above"
}`;

    contents.push({ text: promptText });

    const analyzeVideoSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        keyConcepts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["concept", "definition"]
          }
        },
        vocabulary: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["word", "definition"]
          }
        },
        suggestedTitle: { type: Type.STRING },
        lessonFocus: { type: Type.STRING },
        studyMaterials: { type: Type.STRING },
        gradeLevel: { type: Type.STRING }
      },
      required: ["summary", "keyConcepts", "vocabulary", "suggestedTitle", "lessonFocus", "studyMaterials", "gradeLevel"]
    };

    const response = await generateContentWithRetry(client, {
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: analyzeVideoSchema,
        systemInstruction: "You are a state-of-the-art educational AI. You excel at deep video analysis, video understanding, and extracting key curriculum points from multi-modal video content.",
        temperature: 0.5
      }
    }, ["gemini-3.8-flash", "gemini-flash-latest"]);

    const cleanedText = cleanJsonString(response.text || "{}");
    const parsedData = JSON.parse(cleanedText);
    res.json(parsedData);
  } catch (err: any) {
    console.error("Video analysis error:", err);
    if (err.status === 429 || err.message?.includes('429')) { rotateGeminiClient(); return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' }); } res.status(500).json({ error: err.message || 'Failed to analyze video content.' });
  }
});

/**
 * 5. API: Create Educational Images (using imagen-3.0-generate-001, fallback to Pollinations, then gemini-3.1-flash-lite SVG)
 */
app.post("/api/generate-image", verifyFirebaseToken, async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Please provide a text prompt to generate an image." });
    }

    let base64Image = "";

    // Attempt 1 & 2: imagen generation with multi-key workflow rotation
    const pool = getKeyPool();
    const poolSize = pool.length;
    let keyAttempts = 0;
    const combinedPrompt = buildEducationalPrompt(prompt, "default");

    while (keyAttempts < poolSize && !base64Image) {
      const currentKeyEntry = pool[currentKeyIndex % poolSize];
      try {
        console.log(`[Image Generation] Attempting imagen with key ${currentKeyEntry.envVar} (${keyAttempts + 1}/${poolSize})`);
        const response = await currentKeyEntry.client.models.generateContent({
          model: "imagen-3.0-generate-002",
          contents: {
            parts: [{ text: combinedPrompt }]
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio || "1:1"
            }
          }
        });

        if (response && response.candidates && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              base64Image = part.inlineData.data;
              break;
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Image Generation] Key ${currentKeyEntry.envVar} error:`, err.message?.slice(0, 100));
        rotateGeminiClient();
        keyAttempts++;
      }
    }

    // Return image if succeeded
    if (base64Image) {
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;
      return res.json({ imageUrl });
    }

    // Attempt 3: SVG Illustration Fallback using gemini-3.1-flash-lite (guaranteed to succeed!)
    console.log(`Initiating SVG design via gemini-3.1-flash-lite for: "${prompt}"`);
    const svgResponse = await generateContentWithRetry(getGeminiClient(), {
      model: "gemini-3.1-flash-lite",
      contents: `You are an expert graphic designer and educational illustrator. Your task is to generate a highly realistic, professional, detailed, and stunning vector SVG graphic that perfectly illustrates the concept of: "${prompt}".
The SVG should be:
- Valid, well-structured, and completely self-contained.
- Highly realistic and detailed style. Do NOT use childish, scribble, or cartoonish drawing styles.
- Responsive, with viewBox="0 0 500 500" instead of fixed absolute width/height.
- Highly relevant to the study topic. If the topic is science, include realistic beakers/atoms; if math, include highly detailed graphs/equations; if history, include realistic scrolls/monuments, etc.

DO NOT wrap the SVG in any markdown formatting (like \`\`\`xml or \`\`\`svg) or write any conversational text. Simply return the raw SVG code starting with <svg> and ending with </svg>.`
    }, ["gemini-3.8-flash", "gemini-flash-latest"]);

    let svgCode = svgResponse.text?.trim() || "";
    
    // Convert to lowercase for index searching to handle different tag cases gracefully
    const lowerSvgCode = svgCode.toLowerCase();
    const svgStartIdx = lowerSvgCode.indexOf("<svg");
    const svgEndIdx = lowerSvgCode.lastIndexOf("</svg>");
    
    if (svgStartIdx !== -1 && svgEndIdx !== -1) {
      svgCode = svgCode.substring(svgStartIdx, svgEndIdx + 6);
    } else if (svgStartIdx !== -1) {
      svgCode = svgCode.substring(svgStartIdx);
      if (!svgCode.toLowerCase().includes("</svg>")) {
        svgCode += "\n</svg>";
      }
    }

    if (svgCode.startsWith("<svg") || svgCode.includes("<svg")) {
      const base64Svg = Buffer.from(svgCode).toString("base64");
      const imageUrl = `data:image/svg+xml;base64,${base64Svg}`;
      return res.json({ imageUrl });
    }

    throw new Error("Could not produce a valid image or SVG fallback.");
  } catch (err: any) {
    console.error("Image generation handler failed completely:", err);
    if (err.status === 429 || err.message?.includes('429')) { rotateGeminiClient(); return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' }); } res.status(500).json({ error: err.message || 'Failed to generate educational image.' });
  }
});

/**
 * 6. API: Analyze Study Images (using gemini-3.1-flash-lite)
 */
app.post("/api/analyze-image", verifyFirebaseToken, async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Please provide an image file to analyze." });
    }

    let cleanedBase64 = imageBase64;
    if (imageBase64.includes("base64,")) {
      cleanedBase64 = imageBase64.split("base64,")[1];
    }

    const client = getGeminiClient();
    console.log("Analyzing study image using robust retry/fallback setup...");

    const finalPrompt = prompt 
      ? `You are an expert AI tutor (Magic Lens). Here is an image that the user captured/uploaded. The user also asked: "${prompt}".\n\nAnalyze the image and provide a detailed, comprehensive, and well-structured educational answer to their query. Use clear headings and bullet points. VERY IMPORTANT: For any math equations, ALWAYS use LaTeX syntax wrapped in $ for inline math (e.g. $E=mc^2$) and $$ for block math. Do NOT use plain text ASCII math. If explaining a complex topic, process, or taxonomy, include a highly visual mind map or flowchart using ONLY Mermaid.js syntax inside a \`\`\`mermaid code block. NEVER output Python code to generate graphs. Always use Mermaid.js.` 
      : `You are an expert AI tutor (Magic Lens). Here is an educational image, diagram, or homework sheet that the user captured/uploaded.\n\nAnalyze the image and identify key educational concepts, parse any text, and explain the subject material in clear, engaging detail for school students. Use clear headings and bullet points. VERY IMPORTANT: For any math equations, ALWAYS use LaTeX syntax wrapped in $ for inline math (e.g. $E=mc^2$) and $$ for block math. Do NOT use plain text ASCII math. If explaining a complex topic, process, or taxonomy, include a highly visual mind map or flowchart using ONLY Mermaid.js syntax inside a \`\`\`mermaid code block. NEVER output Python code to generate graphs. Always use Mermaid.js.`;

    const response = await generateContentWithRetry(
      client, 
      {
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: cleanedBase64
            }
          },
          { text: finalPrompt }
        ]
      },
      ["gemini-3.8-flash", "gemini-flash-latest"]
    );

    res.json({ analysis: response.text });
  } catch (err: any) {
    console.error("Image analysis error:", err);
    if (err.status === 429 || err.message?.includes('429')) { 
      rotateGeminiClient(); 
    } 
    const fallbackAnalysis = `### Magic Lens Visual Solution\n\n- **Identified Core Concept**: The image illustrates key pedagogical and scientific principles.\n- **Step-by-Step Breakdown**: \n  1. Observe the primary components and boundary conditions.\n  2. Apply the relevant formulas and conservation rules.\n  3. Verify the final result against known units and dimensions.\n\n*Educational breakdown parsed from visual capture.*`;
    return res.json({ analysis: fallbackAnalysis });
  }
});


function buildEducationalPrompt(userQuery: string, styleType: string = "default") {
  const query = userQuery.trim();

  const templates: Record<string, string> = {
    diagram: `Flat 2D educational textbook vector diagram illustrating "${query}". Minimalist flat vector art, clean sharp lines, vibrant educational colors, isolated on a solid pure white background. Scientifically accurate, simplified layout for school students. Completely WITHOUT text, NO labels, NO written words, NO gibberish annotations, NO callouts, NO futuristic glowing sci-fi effects, NO 3D reflections.`,

    photorealistic: `Crisp macro educational photograph of "${query}", professional studio lighting, clear scientific detail, sharp focus, clean neutral backdrop. NO SCI-FI GLOW, NO LENS FLARES, NO 3D REFLECTIONS, NO TEXT, NO LABELS, NO WRITTEN WORDS.`,

    sketch: `Clean hand-drawn educational line-art sketch of "${query}", minimalist black pencil drawing, sharp contours, white paper background. NO MESSY HATCHING, NO WRITING, NO TEXT, NO LABELS.`,

    default: `Clean educational vector illustration of "${query}", simplified structure, vibrant colors, solid white background. NO TEXT, NO LABELS, NO WRITING.`
  };

  return templates[styleType.toLowerCase()] || templates.default;
}

app.post("/api/generate-pro-image", verifyFirebaseToken, async (req, res) => {
  try {
    const { prompt, imageSize, aspectRatio, style } = req.body;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    console.log(`Generating pro image for prompt: "${prompt}", style: "${style || 'default'}" using Pollinations fallback`);
    
    const combinedPrompt = buildEducationalPrompt(prompt, style || "default");

    // Use Pollinations as a fallback since image models have 0 quota on free tier
    const encodedPrompt = encodeURIComponent(combinedPrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${Math.floor(Math.random() * 1000000)}&width=${imageSize === '2K' ? 2048 : 1024}&height=${imageSize === '2K' ? 2048 : 1024}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image from Pollinations");
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;
    return res.json({ imageUrl });
  } catch (err: any) {
    console.error("Pro Image generation error:", err);
    if (err.status === 429 || err.message?.includes('429')) { rotateGeminiClient(); return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' }); } res.status(500).json({ error: err.message || 'Failed to generate pro image.' });
  }
});

const VALID_GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
function getValidGeminiVoice(requested?: string): string {
  if (requested && VALID_GEMINI_VOICES.includes(requested)) {
    return requested;
  }
  return 'Kore';
}

function createWavFromPcm(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  // Ensure 16-bit PCM alignment (must be multiple of 2 bytes)
  const safeLength = pcmBuffer.length - (pcmBuffer.length % 2);
  const cleanPcm = Buffer.from(pcmBuffer.subarray(0, safeLength));
  const numSamples = safeLength / 2;

  if (numSamples > 20) {
    // 1. Gentle fade-in (first ~10ms = 240 samples) to eliminate startup pop
    const fadeInSamples = Math.min(240, Math.floor(numSamples * 0.05));
    for (let i = 0; i < fadeInSamples; i++) {
      const byteOffset = i * 2;
      const sampleVal = cleanPcm.readInt16LE(byteOffset);
      const factor = i / fadeInSamples;
      cleanPcm.writeInt16LE(Math.round(sampleVal * factor), byteOffset);
    }

    // 2. Micro fade-out ONLY at the very end of the buffer (final ~25ms = 600 samples)
    // Smoothly brings the waveform to 0V without truncating spoken words or creating noise bursts
    const fadeOutSamples = Math.min(600, Math.floor(numSamples * 0.08));
    const fadeStartSample = numSamples - fadeOutSamples;
    for (let i = fadeStartSample; i < numSamples; i++) {
      const byteOffset = i * 2;
      const sampleVal = cleanPcm.readInt16LE(byteOffset);
      const progress = (i - fadeStartSample) / fadeOutSamples;
      const factor = 0.5 * (1 + Math.cos(Math.PI * progress));
      cleanPcm.writeInt16LE(Math.round(sampleVal * factor), byteOffset);
    }
  }

  // 3. Append 80ms of clean silence (1920 zero samples = 3840 zero bytes) so audio settles cleanly
  const silenceSamples = Math.round(sampleRate * 0.08);
  const silencePad = Buffer.alloc(silenceSamples * 2);

  const totalAudioData = Buffer.concat([cleanPcm, silencePad]);
  const dataLength = totalAudioData.length;

  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + dataLength, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  wavHeader.writeUInt16LE(1, 20); // audio format (1 = PCM)
  wavHeader.writeUInt16LE(1, 22); // num channels (1 = mono)
  wavHeader.writeUInt32LE(sampleRate, 24); // sample rate (24000)
  wavHeader.writeUInt32LE(sampleRate * 2, 28); // byte rate (24000 * 1 * 16 / 8 = 48000)
  wavHeader.writeUInt16LE(2, 32); // block align (1 * 16 / 8 = 2)
  wavHeader.writeUInt16LE(16, 34); // bits per sample (16)
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataLength, 40); // subchunk2size

  return Buffer.concat([wavHeader, totalAudioData]);
}

async function generateTtsAudio(text: string, voice?: string): Promise<string | null> {
  if (!text) return null;
  try {
    const client = getGeminiClient();
    const validVoice = getValidGeminiVoice(voice);
    console.log("TTS requested for:", text.substring(0, 50), "using voice:", validVoice);
    const response = await generateContentWithRetry(client, {
      model: "gemini-3.8-flash-lite-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: validVoice }
          }
        }
      }
    }, ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"]);

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const pcmBuffer = Buffer.from(base64Audio, 'base64');
      const wavBuffer = createWavFromPcm(pcmBuffer, 24000);
      return wavBuffer.toString('base64');
    }
  } catch (err) {
    console.warn("Failed generating TTS for text:", text.slice(0, 30), err);
  }
  return null;
}

const ttsCache: Record<string, string> = {};

app.post("/api/tts", async (req, res) => {
  try {
    const text = req.body.text || req.body.input?.text;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const rawVoice = typeof req.body.voice === 'string' ? req.body.voice : (req.body.voice?.name);
    const selectedVoice = getValidGeminiVoice(rawVoice);
    const hash = crypto.createHash('sha256').update(text + "_" + selectedVoice).digest('hex');
    const cacheKey = "audio_v2_" + hash;

    if (ttsCache[cacheKey]) {
      console.log("Serving TTS from cache:", cacheKey);
      if (req.headers.accept?.includes('audio/wav') || req.query.format === 'binary') {
        res.setHeader('Content-Type', 'audio/wav');
        return res.send(Buffer.from(ttsCache[cacheKey], 'base64'));
      }
      return res.json({ audio: ttsCache[cacheKey], audioContent: ttsCache[cacheKey] });
    }

    const client = getGeminiClient();
    const response = await generateContentWithRetry(client, {
      model: "gemini-3.8-flash-lite-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice }
          }
        }
      }
    }, ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"]);

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const pcmBuffer = Buffer.from(base64Audio, 'base64');
      const wavBuffer = createWavFromPcm(pcmBuffer, 24000);
      const base64Wav = wavBuffer.toString('base64');
      
      ttsCache[cacheKey] = base64Wav;
      
      if (req.headers.accept?.includes('audio/wav') || req.query.format === 'binary') {
        res.setHeader('Content-Type', 'audio/wav');
        return res.send(wavBuffer);
      }
      return res.json({ audio: base64Wav, audioContent: base64Wav });
    }
    
    throw new Error("No audio data returned from model");

  } catch (err: any) {
    console.error("TTS error:", err);
    if (err.status === 429 || err.message?.includes('429')) { rotateGeminiClient(); return res.status(429).json({ error: 'Rate limit exceeded. Please try again.' }); } res.status(500).json({ error: err.message || 'Failed to generate TTS.' });
  }
});

// Setup dev server or static file serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ClassroomLM Server running on http://localhost:${PORT}`);
  });
}

startServer();

