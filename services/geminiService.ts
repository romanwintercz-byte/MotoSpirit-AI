
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage } from "../types";

/**
 * Pro produkční nasazení doporučujeme gemini-2.5-flash, 
 * který je nejvíce kompatibilní se všemi typy klíčů.
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    // Pro lokální vývoj, pokud zapomeneš na .env
    console.error("MotoSpirit: API_KEY nebyl nalezen v process.env");
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.group("MotoSpirit AI Diagnostic");
  console.error(error);
  console.groupEnd();
  
  const msg = error.message || error.toString();
  
  if (msg.includes("404") || msg.includes("not found")) {
    return "❌ Model nenalezen. Zkuste v nastavení Vercelu zkontrolovat API_KEY.";
  }
  if (msg.includes("403") || msg.includes("permission")) {
    return "❌ Chyba 403: Klíč nemá oprávnění. Zkontrolujte Google AI Studio.";
  }
  return "❌ Chyba: " + msg.substring(0, 100);
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const recordsText = records.map(r => `- ${r.date}: ${r.type}`).join('\n');
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Jsi mechanik. Analyzuj stav motorky: ${bike.brand} ${bike.model}, najeto ${bike.mileage}km. Předchozí servis: ${recordsText || 'žádný'}. Buď stručný a věcný.`,
    });
    return response.text || "Zkus to později.";
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string): Promise<{ text: string, links: any[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Navrhni motovýlet z: ${origin}. Preference: ${preferences}. Najdi reálné trasy a body zájmu pro motorkáře.`,
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
      model: DEFAULT_MODEL,
      contents: message,
      config: {
        systemInstruction: "Jsi MotoSpirit, český biker asistent. Mluv k věci, používej slang, ale buď užitečný."
      }
    });
    return response.text || "Teď mi to nějak vynechává, zkus to znovu.";
  } catch (error) {
    return handleApiError(error);
  }
};
