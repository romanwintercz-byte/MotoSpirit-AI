
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage } from "../types";

/**
 * Dynamická inicializace klienta.
 */
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Detailní ošetření chyb.
 */
const handleApiError = (error: any) => {
  console.group("MotoSpirit AI Error Diagnostic");
  console.error("Original Error Object:", error);
  const msg = error.message || error.toString();
  console.log("Error Message:", msg);
  console.groupEnd();

  if (msg.includes("Requested entity was not found.")) {
    return "❌ Klíč nebyl v projektu nalezen (404). Ujistěte se, že Gemini API je v daném projektu aktivní.";
  }

  if (msg === "API_KEY_MISSING") {
    return "❌ API klíč chybí v konfiguraci aplikace (process.env).";
  }

  if (msg.toLowerCase().includes("api key not valid")) {
    return "❌ API klíč je neplatný. Zkontrolujte, zda jste jej zkopírovali správně.";
  }

  if (msg.toLowerCase().includes("restricted") || msg.includes("403")) {
    return "❌ Přístup zamítnut. Pravděpodobně nemáte v Google Console povolenou adresu vaší aplikace (Referrer restriction).";
  }

  return "❌ Problém s AI: " + (msg.length > 60 ? msg.substring(0, 60) + "..." : msg);
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const recordsText = records.map(r => `- ${r.date}: ${r.type} (${r.description})`).join('\n');
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Jako motorkářský mechanik analyzuj stav stroje ${bike.brand} ${bike.model} (${bike.mileage} km) na základě: ${recordsText || 'žádné záznamy'}. Buď stručný, mluv česky a motorkářským slangem.`,
    });
    return response.text || "Mechanik má plné ruce práce, zkus to později.";
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string): Promise<{ text: string, links: any[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Naplánuj motovýlet z: ${origin}. Preference: ${preferences}. Najdi reálné zajímavé body na trase.`,
      config: { tools: [{ googleSearch: {} }] },
    });
    return {
      text: response.text || "Trasu se nepodařilo naplánovat.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    throw new Error(handleApiError(error));
  }
};

export const getBikerAdvice = async (message: string, history: ChatMessage[]): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Uživatel píše: ${message}`,
      config: {
        systemInstruction: "Jsi MotoSpirit, drsný český motorkář. Raď riderům s technikou a stroji. Buď stručný."
      }
    });
    return response.text || "Něco mi vletělo do helmy, napiš to znovu.";
  } catch (error) {
    return handleApiError(error);
  }
};
