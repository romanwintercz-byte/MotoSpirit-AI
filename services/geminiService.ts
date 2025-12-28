
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord } from "../types";

/**
 * Získá API klíč s maximální odolností vůči prostředí (Vercel/PWA)
 */
const getApiKey = (): string | undefined => {
  // Zkusíme všechny možné cesty, kde by klíč mohl být schovaný
  return (window as any).process?.env?.API_KEY || 
         (process.env as any).API_KEY || 
         undefined;
};

const getAiInstance = () => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'undefined') {
    console.error("MotoSpirit: API klíč nenalezen v systému.");
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

const handleRequestError = async (error: any) => {
  console.error("MotoSpirit AI Error Detail:", error);
  
  // Pokud je chyba v autorizaci, zkusíme vyvolat dialog klíče
  if (error.message === "MISSING_API_KEY" || error?.status === 401 || error?.status === 404) {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      console.warn("Pokouším se o re-autorizaci přes most...");
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  }
  throw error;
};

export const getBikerAdvice = async (prompt: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const ai = getAiInstance();
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "Jsi MotoSpirit, inteligentní asistent pro motorkáře. Odpovídej česky, stručně a technicky správně. Používej motorkářský slang, ale zůstaň profesionální.",
      },
      history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
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
    const contents = `Naplánuj vyjížďku na motorce začínající v: ${origin}. Preference: ${preferences}. Najdi konkrétní silnice a zastávky.`;
    
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
      text: response.text || "Omlouvám se, trasa nebyla vygenerována.",
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
    const prompt = `Motorka: ${bike.brand} ${bike.model}, rok ${bike.year}, nájezd ${bike.mileage}km. Předchozí servis: ${recordsText || 'žádné záznamy'}. Jaké úkony údržby doporučuješ v nejbližší době?`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    return handleRequestError(error);
  }
};
