
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

// Funkce vytvoří novou instanci při každém volání, což zaručuje, 
// že se použije nejaktuálnější injektovaný klíč z process.env.API_KEY.
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.error("MotoSpirit API Error Detail:", error);
  
  // Detekce specifických stavů Google API
  const errorMsg = error.toString().toLowerCase();
  
  if (errorMsg.includes("403") || errorMsg.includes("billing")) {
    return "❌ AI vyžaduje aktivní Billing v Google Cloud pro provoz na Vercelu. Zkontroluj kartu v Google Console.";
  }
  if (errorMsg.includes("404") || errorMsg.includes("model not found")) {
    return "❌ Model nenalezen nebo API klíč nemá přístup k Gemini 3.";
  }
  if (error.message === "API_KEY_MISSING") {
    return "⚠️ API_KEY nebyl nalezen v nastavení Vercelu (Environment Variables).";
  }
  
  return "❌ Chyba AI: " + (error.message || "Zkuste to za chvíli.");
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [{ text: "Jsi MotoSpirit, drsný ale moudrý motorkář. Mluv česky, stručně, používej slang." }] },
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    return response.text || "Zrovna ladím karburátor, zkus to znovu.";
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
      text: response.text || "Nepodařilo se vygenerovat trasu.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    return { text: handleApiError(error), links: [] };
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = getAIClient();
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Doporuč údržbu na základě těchto záznamů: ${JSON.stringify(records)}.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    
    return response.text || "Analýza se nezdařila.";
  } catch (error: any) {
    return handleApiError(error);
  }
};
