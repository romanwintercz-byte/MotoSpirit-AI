
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

// Pomocná funkce pro vytvoření instance přímo před voláním
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = getAI();
    // Pro chat používáme nejnovější flash model
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [{ text: "Jsi MotoSpirit, zkušený motorkář. Mluv česky, používej slang, buď stručný." }] },
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    return response.text || "MotoSpirit zrovna čistí svíčky, zkus to za chvíli.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("API_KEY_MISSING")) {
      return "⚠️ API klíč není nastaven v prostředí Vercelu.";
    }
    return "❌ Chyba spojení. Ujisti se, že máš v Google Cloud aktivovaný Billing (platby).";
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string, location?: { lat: number; lng: number }) => {
  try {
    const ai = getAI();
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
    console.error("Grounding Error:", error);
    return { text: "⚠️ Plánování vyžaduje aktivní Billing v Google Cloud.", links: [] };
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = getAI();
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Doporuč údržbu na základě těchto záznamů: ${JSON.stringify(records)}.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Komplexnější úkol vyžaduje Pro model
      contents: prompt,
    });
    
    return response.text || "Analýza se nezdařila.";
  } catch (error) {
    return "⚠️ Servisní rádce vyžaduje správně nastavený API klíč.";
  }
};
