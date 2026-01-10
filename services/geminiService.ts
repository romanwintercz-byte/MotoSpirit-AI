
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Handle API errors including the requirement to re-select API keys if needed.
 */
const handleApiError = (error: any) => {
  console.error("MotoSpirit API Error:", error);
  const msg = error.message || error.toString();
  
  // Guideline: If the request fails with "Requested entity was not found.", prompt to select key again.
  if (msg.includes("Requested entity was not found.")) {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      window.aistudio.openSelectKey();
    }
    return "❌ Vyberte prosím platný API klíč v nastavení.";
  }

  const lowerMsg = msg.toLowerCase();
  if (lowerMsg.includes("403") || lowerMsg.includes("billing")) {
    return "❌ Chyba platby: Gemini vyžaduje aktivní Billing v Google Cloud pro provoz na této doméně.";
  }
  return "❌ Chyba AI: " + (msg || "Zkuste to za chvíli.");
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    // Guideline: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        // Guideline: Use systemInstruction in config
        systemInstruction: "Jsi MotoSpirit, drsný ale moudrý český motorkář. Mluv česky, stručně, používej slang."
      }
    });
    return response.text || "Zrovna ladím motor, zkus to za chvilku.";
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string) => {
  try {
    // Guideline: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Jako motorkář navrhni trasu z ${origin}. Chci: ${preferences}. Vyhledej reálná místa přes Google Search.`,
      // Guideline: Only googleSearch is permitted for Search Grounding
      config: { tools: [{ googleSearch: {} }] },
    });
    return {
      text: response.text || "Trasa se nepodařila vygenerovat.",
      // Guideline: Always extract URLs from groundingChunks
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    return { text: handleApiError(error), links: [] };
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    // Guideline: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Záznamy: ${JSON.stringify(records)}. Navrhni údržbu.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    return response.text || "Analýza se nezdařila.";
  } catch (error: any) {
    return handleApiError(error);
  }
};
