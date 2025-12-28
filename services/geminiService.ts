
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  const model = "gemini-3-flash-preview";
  const chat = ai.chats.create({
    model: model,
    config: {
      systemInstruction: "Jsi MotoSpirit, inteligentní asistent pro motorkáře. Jsi expert na mechaniku, bezpečnost, techniku jízdy a cestování. Odpovídej česky, stručně a s nadšením pro motocykly.",
    },
  });

  // Re-build history format if needed, but for simplicity:
  const response = await chat.sendMessage({ message: prompt });
  return response.text;
};

export const planTripWithGrounding = async (
  origin: string, 
  preferences: string,
  location?: { lat: number; lng: number }
) => {
  const model = "gemini-2.5-flash"; // Required for Google Maps grounding
  
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
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  const model = "gemini-3-flash-preview";
  const recordsText = records.map(r => `${r.date}: ${r.type} (${r.description})`).join('\n');
  
  const prompt = `Mám motorku ${bike.brand} ${bike.model} (${bike.year}) s nájezdem ${bike.mileage} km. 
  Historie údržby:
  ${recordsText}
  Co bych měl v nejbližší době zkontrolovat nebo vyměnit? Odpověz v bodech česky.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};
