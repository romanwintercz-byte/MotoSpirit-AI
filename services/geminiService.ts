
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Inicializuje klienta pokaždé znovu, aby využil nejaktuálnější klíč z prostředí/dialogu.
 */
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.error("MotoSpirit API Error:", error);
  const msg = error.message || error.toString();
  
  // Pravidlo: Při chybě "Requested entity was not found." vyvolat znovu výběr klíče
  if (msg.includes("Requested entity was not found.")) {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      window.aistudio.openSelectKey();
    }
    return "❌ Relace vypršela nebo je klíč neplatný. Vyberte jej prosím znovu v dialogu.";
  }

  if (msg === "API_KEY_MISSING") {
    return "❌ API klíč nebyl nalezen. Zkuste aplikaci restartovat.";
  }

  const lowerMsg = msg.toLowerCase();
  if (lowerMsg.includes("403") || lowerMsg.includes("billing")) {
    return "❌ Chyba autorizace/platby: Zkontrolujte nastavení projektu a povolené domény v Google Console.";
  }
  
  return "❌ Chyba AI: " + (msg.substring(0, 50) || "Zkuste to za chvíli.");
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = getAI();
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
        systemInstruction: "Jsi MotoSpirit, drsný ale moudrý český motorkář. Mluv česky, stručně, používej slang a emotikony spojené s motorkami. Jsi expert na techniku i bezpečné ježdění."
      }
    });
    return response.text || "Zrovna mi došel benzín, zkus to za chvilku.";
  } catch (error: any) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Jako motorkář navrhni trasu z ${origin}. Chci: ${preferences}. Vyhledej reálná místa přes Google Search a popiš proč tam jet.`,
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
    const ai = getAI();
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Záznamy v servisní knížce: ${JSON.stringify(records)}. Jako zkušený mechanik mi napiš, co bych měl teď zkontrolovat nebo vyměnit.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    return response.text || "Analýza se nezdařila.";
  } catch (error: any) {
    return handleApiError(error);
  }
};
