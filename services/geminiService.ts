
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Re-instantiates AI client for every request to ensure the latest API_KEY 
 * from the environment/bridge is captured, especially in PWA mode.
 */
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

const handleRequestError = async (error: any) => {
  console.error("MotoSpirit AI Error:", error);
  
  // If unauthorized or key missing, try to re-trigger selection
  if (error.message === "MISSING_API_KEY" || error?.status === 401 || error?.status === 403) {
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
    const ai = getAiInstance();
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Jsi MotoSpirit, inteligentní asistent pro motorkáře. Odpovídej česky, stručně a technicky správně.",
      },
      history: formattedHistory,
    });

    const response = await chat.sendMessage({ message: prompt });
    return response.text;
  } catch (error) {
    return handleRequestError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string, location?: { lat: number; lng: number }) => {
  try {
    const ai = getAiInstance();
    const contents = `Naplánuj vyjížďku na motorce z: ${origin}. Preference: ${preferences}.`;
    
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
      text: response.text || "Trasa nebyla vygenerována.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    return handleRequestError(error);
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = getAiInstance();
    const recordsText = records.map(r => `${r.date}: ${r.type}`).join(', ');
    const prompt = `Motorka: ${bike.brand} ${bike.model}, nájezd ${bike.mileage}km. Servis: ${recordsText || 'žádný'}. Co doporučuješ?`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    return handleRequestError(error);
  }
};
