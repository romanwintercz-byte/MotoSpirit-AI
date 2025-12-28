
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

// Helper to get fresh AI instance
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  // Convert history to the format expected by the SDK
  const formattedHistory = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  try {
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
    console.error("Gemini API Error (Advice):", error);
    throw error;
  }
};

export const planTripWithGrounding = async (
  origin: string, 
  preferences: string,
  location?: { lat: number; lng: number }
) => {
  const ai = getAI();
  const model = "gemini-2.5-flash-preview"; // Enhanced for grounding
  
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

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const text = response.text || "Nepodařilo se vygenerovat trasu.";
    const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, links };
  } catch (error) {
    console.error("Gemini API Error (Grounding):", error);
    throw error;
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  const recordsText = records.map(r => `${r.date}: ${r.type} (${r.description})`).join('\n');
  
  const prompt = `Mám motorku ${bike.brand} ${bike.model} (${bike.year}) s nájezdem ${bike.mileage} km. 
  Historie údržby:
  ${recordsText || 'Žádné záznamy'}
  Co bych měl v nejbližší době zkontrolovat nebo vyměnit? Odpověz v bodech česky.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error (Maintenance):", error);
    throw error;
  }
};
