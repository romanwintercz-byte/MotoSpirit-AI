
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Bezpečné vytvoření klienta. Pokud klíč chybí, vyhodí srozumitelnou chybu
 * místo vnitřního pádu SDK.
 */
const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("KEY_NOT_SET");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.error("MotoSpirit API Error:", error);
  const msg = error.message || error.toString();
  
  if (msg === "KEY_NOT_SET") {
    return "❌ API klíč není nakonfigurován. Klikněte prosím na tlačítko nastavení.";
  }

  if (msg.includes("Requested entity was not found.")) {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      window.aistudio.openSelectKey();
    }
    return "❌ API klíč je neplatný nebo expiroval. Vyberte ho prosím znovu.";
  }

  const lowerMsg = msg.toLowerCase();
  if (lowerMsg.includes("403") || lowerMsg.includes("billing")) {
    return "❌ Chyba platby: Ujistěte se, že máte v Google Cloud Console aktivní Billing pro vybraný projekt.";
  }
  return "❌ Chyba AI: " + (msg || "Zkuste to za chvíli.");
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = createClient();
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
    const ai = createClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Jako motorkář navrhni trasu z ${origin}. Chci: ${preferences}. Vyhledej reálná místa přes Google Search.`,
      config: { tools: [{ googleSearch: {} }] },
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
    const ai = createClient();
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
