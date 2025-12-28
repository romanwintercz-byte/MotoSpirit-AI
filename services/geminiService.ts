
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Creates a fresh instance of GoogleGenAI.
 * Fetches the API key from process.env.API_KEY at runtime.
 */
const createClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // If the guard somehow let us through but the key is gone (common in some PWA contexts)
    console.error("MotoSpirit: API_KEY is undefined at runtime.");
    throw new Error("API_KEY_NOT_FOUND");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Handles common API errors.
 */
const handleApiError = async (error: any) => {
  console.error("Gemini API Error:", error);
  // Specifically handle the "entity not found" error which often means the key is invalid or lost in PWA transition
  if (error?.message?.includes("Requested entity was not found") || error?.status === 404) {
    // @ts-ignore
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
  throw error;
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = createClient();
    const model = "gemini-3-flash-preview";
    
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: "Jsi MotoSpirit, inteligentní asistent pro motorkáře. Jsi expert na mechaniku, bezpečnost, techniku jízdy a cestování. Odpovídej česky, stručně a s nadšením pro motocykly.",
      },
      history: formattedHistory,
    });

    const response = await chat.sendMessage({ message: prompt });
    return response.text;
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (
  origin: string, 
  preferences: string,
  location?: { lat: number; lng: number }
) => {
  try {
    const ai = createClient();
    const model = "gemini-2.5-flash"; 
    
    const contents = `Naplánuj vyjížďku na motorce začínající v ${origin}. Preference: ${preferences}. Najdi zajímavé zastávky, vyhlídky a motorkářské hospody v okolí.`;

    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (location) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: location.lat,
            longitude: location.lng
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const text = response.text || "Nepodařilo se vygenerovat trasu.";
    const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, links };
  } catch (error) {
    return handleApiError(error);
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = createClient();
    const model = "gemini-3-flash-preview";
    const recordsText = records.map(r => `${r.date}: ${r.type} (${r.description})`).join('\n');
    
    const prompt = `Mám motorku ${bike.brand} ${bike.model} (${bike.year}) s nájezdem ${bike.mileage} km. 
    Historie údržby:
    ${recordsText || 'Žádné záznamy'}
    Co bych měl v nejbližší době zkontrolovat nebo vyměnit? Odpověz v bodech česky.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    return handleApiError(error);
  }
};
