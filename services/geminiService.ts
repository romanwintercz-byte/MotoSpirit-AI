
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Klíč MUSÍ být ve Vercelu nastaven jako API_KEY.
 * Pokud jsi ho pojmenoval GOOGLE_AI_API_KEY, přejmenuj ho.
 */
const getAIClient = () => {
  // Přístup k environmentální proměnné, kterou Vercel injektuje
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    throw new Error("CONFIG_MISSING");
  }
  
  // Vždy vytváříme novou instanci, aby se zajistilo čerstvé spojení
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.error("MotoSpirit Diagnostic Error:", error);
  
  const errorStr = error.toString();
  
  if (error.message === "CONFIG_MISSING") {
    return "⚠️ CHYBA NASTAVENÍ: Ve Vercelu musíš mít Environment Variable s názvem 'API_KEY' (ne GOOGLE_...). Po přidání musíš dát 'Redeploy'.";
  }
  
  if (errorStr.includes("403") || errorStr.includes("billing")) {
    return "❌ CHYBA PLATBY: Google API zamítlo přístup. Zkontroluj v Google Cloud Console, zda máš u projektu aktivní Billing a povolené 'Generative Language API'.";
  }

  if (errorStr.includes("429")) {
    return "❌ LIMIT: Příliš mnoho požadavků. Počkej minutu.";
  }

  return "❌ CHYBA AI: " + (error.message || "Nepodařilo se spojit s mozkem MotoSpirita.");
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [{ text: "Jsi MotoSpirit, zkušený motorkář. Mluv česky, stručně, používej slang. Pokud nevíš, přiznej to." }] },
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    return response.text || "MotoSpirit zrovna čistí řetěz, zkus to za chvíli.";
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Jako motorkář navrhni trasu z ${origin}. Chci: ${preferences}. Vyhledej reálná místa přes Google Search.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return {
      text: response.text || "Trasa se nepodařila vygenerovat.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    return { text: handleApiError(error), links: [] };
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = getAIClient();
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Poslední záznamy: ${JSON.stringify(records)}. Navrhni údržbu.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    
    return response.text || "Analýza se nezdařila.";
  } catch (error: any) {
    return handleApiError(error);
  }
};
