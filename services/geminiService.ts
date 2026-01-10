
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage } from "../types";

/**
 * Pro Maps Grounding je nutné použít řadu 2.5.
 */
const MODEL_2_5 = 'gemini-2.5-flash-preview-09-2025';
const MODEL_3_FLASH = 'gemini-3-flash-preview';

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.error("MotoSpirit: API_KEY nebyl nalezen");
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.group("MotoSpirit AI Diagnostic");
  console.error(error);
  console.groupEnd();
  
  const msg = error.message || error.toString();
  if (msg.includes("404")) return "❌ Model nenalezen. Zkontrolujte API_KEY.";
  if (msg.includes("403")) return "❌ Chyba 403: Nedostatečná oprávnění klíče.";
  return "❌ Došlo k chybě při komunikaci s AI.";
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const recordsText = records.map(r => `- ${r.date}: ${r.type}`).join('\n');
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: `Jsi mechanik. Analyzuj stav motorky: ${bike.brand} ${bike.model}, najeto ${bike.mileage}km. Předchozí servis: ${recordsText || 'žádný'}. Buď stručný a věcný v češtině.`,
    });
    return response.text || "Zkus to později.";
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string): Promise<{ text: string, links: any[] }> => {
  try {
    const ai = getAI();
    // Maps grounding vyžaduje řadu 2.5
    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: `Navrhni detailní motovýlet z místa: ${origin}. Moje preference jsou: ${preferences}. Najdi reálné trasy, vyhlídky a motorkářské zastávky. Odpovídej v češtině.`,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });

    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text, links: chunks };
  } catch (error) {
    throw new Error(handleApiError(error));
  }
};

export const getBikerAdvice = async (message: string, history: ChatMessage[]): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: message,
      config: {
        systemInstruction: "Jsi MotoSpirit, zkušený český biker. Odpovídej kamarádsky, používej motorkářský slang, buď užitečný a stručný."
      }
    });
    return response.text || "Teď mi to nějak vynechává, zkus to znovu.";
  } catch (error) {
    return handleApiError(error);
  }
};
