
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Získá klíč s prioritou pro aktuální session.
 */
const getActiveKey = (): string => {
  // 1. Zkusíme process.env (Vercel injection)
  const envKey = process.env.API_KEY;
  if (envKey && envKey !== 'undefined' && envKey.length > 5) return envKey;

  // 2. Zkusíme globální window bridge (AI Studio)
  const windowKey = (window as any).process?.env?.API_KEY;
  if (windowKey && windowKey !== 'undefined' && windowKey.length > 5) return windowKey;

  return '';
};

const createClient = () => {
  const key = getActiveKey();
  if (!key) throw new Error("NO_KEY_AVAILABLE");
  return new GoogleGenAI({ apiKey: key });
};

const handleApiError = async (error: any) => {
  console.error("MotoSpirit Engine Error:", error);
  
  // Pokud entita nebyla nalezena (častá chyba po vypršení session), zkusíme re-auth
  if (error?.message?.includes("Requested entity was not found") || error?.status === 404) {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
  throw error;
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = createClient();
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Jsi MotoSpirit, riderův asistent. Odpovídej česky, stručně, motorkářsky.",
      },
      history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
    });

    const response = await chat.sendMessage({ message: prompt });
    return response.text;
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string, location?: { lat: number; lng: number }) => {
  try {
    const ai = createClient();
    const contents = `Trasa z: ${origin}. Preference: ${preferences}.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: location ? {
          retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } }
        } : undefined
      },
    });

    return {
      text: response.text || "Zkus to znovu, motor AI vynechal.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    return handleApiError(error);
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = createClient();
    const recordsText = records.map(r => `${r.date}: ${r.type}`).join(', ');
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Servis: ${recordsText}. Doporučení?`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    return handleApiError(error);
  }
};
