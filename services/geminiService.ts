
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

const createClient = () => {
  const key = process.env.API_KEY;
  if (!key || key === 'undefined' || key.length < 10) {
    throw new Error("MISSING_KEY");
  }
  return new GoogleGenAI({ apiKey: key });
};

const handleGeneralError = (err: any) => {
  console.error("MotoSpirit API Error:", err);
  if (err.message === "MISSING_KEY") {
    return "⚠️ API klíč není nastaven ve Vercelu (Environment Variables).";
  }
  return "❌ AI vyžaduje Google Cloud projekt s aktivovaným Billingem (platbami) pro provoz mimo Studio.";
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = createClient();
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Jsi MotoSpirit, drsný ale férový motorkářský asistent. Mluv česky, stručně, používej motorkářský slang.",
      },
      history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
    });

    const response = await chat.sendMessage({ message: prompt });
    return response.text;
  } catch (error) {
    return handleGeneralError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string, location?: { lat: number; lng: number }) => {
  try {
    const ai = createClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Navrhni motorkářskou trasu z ${origin}. Chci: ${preferences}.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: location ? {
          retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } }
        } : undefined
      },
    });

    return {
      text: response.text || "Nepodařilo se vygenerovat trasu.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    return { text: handleGeneralError(error), links: [] };
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]) => {
  try {
    const ai = createClient();
    const recordsText = records.length > 0 
      ? `Historie: ${records.map(r => r.type).join(", ")}` 
      : "Žádná historie údržby.";
    
    const prompt = `Motorka: ${bike.brand} ${bike.model}, rok ${bike.year}, nájezd ${bike.mileage}km. ${recordsText}. Co bys doporučil zkontrolovat?`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return handleGeneralError(error);
  }
};
