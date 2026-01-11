
import { GoogleGenAI, Type } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage } from "../types";

const MODEL_2_5 = 'gemini-2.5-flash';
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
  if (msg.includes("400")) return "❌ Chyba 400: Neplatný požadavek.";
  return "❌ Došlo k chybě při komunikaci s AI.";
};

export const processReceiptAI = async (input: { base64?: string, mimeType?: string, text?: string }): Promise<any> => {
  try {
    const ai = getAI();
    const parts: any[] = [];
    if (input.base64 && input.mimeType) {
      parts.push({ inlineData: { data: input.base64, mimeType: input.mimeType } });
    }
    const prompt = input.text 
      ? `Z tohoto popisu extrahuj data o výdaji: "${input.text}".`
      : `Z této účtenky extrahuj data o výdaji.`;

    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: { parts: [...parts, { text: `${prompt} Vrať JSON: type (fuel/service/other), cost, liters, mileage, date (YYYY-MM-DD), description.` }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            cost: { type: Type.NUMBER },
            liters: { type: Type.NUMBER },
            mileage: { type: Type.NUMBER },
            date: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["type", "cost"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return null;
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const recordsText = records.map(r => `- ${r.date}: ${r.type}`).join('\n');
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: `Jsi mechanik. Analyzuj stav: ${bike.brand} ${bike.model}, ${bike.mileage} km. Servis: ${recordsText || 'žádný'}. Navrhni údržbu česky.`,
    });
    return response.text || "Zkus to později.";
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string): Promise<{ text: string, links: any[], waypoints: [number, number][] }> => {
  try {
    const ai = getAI();
    
    // Maximálně detailní instrukce pro hustotu a přesnost bodů
    const systemInstruction = `Jsi profesionální plánovač motocyklových tras. 
    Tvým úkolem je navrhnout trasu, která se vyhýbá dálnicím a hledá nejzajímavější okresky (zatáčky, vyhlídky).
    MUSÍŠ vrátit minimálně 25 až 40 GPS souřadnic, které přesně kopírují reálný průběh silnice (včetně průjezdních bodů v zatáčkách), aby výsledná čára na mapě nebyla zubatá, ale plynulá.
    
    Formát odpovědi:
    1. Textový popis výletu (itinerář, tipy na jídlo, zajímavosti).
    2. Sekce "GPS_DATA" obsahující seznam souřadnic ve formátu: [lat, lon], [lat, lon], ...`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: `Navrhni detailní motovýlet z: ${origin}. Preference: ${preferences}.`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });
    
    const fullText = response.text || "";
    const parts = fullText.split("GPS_DATA");
    const text = parts[0];
    const gpsPart = parts[1] || "";
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Extrakce souřadnic pomocí regexu
    const waypoints: [number, number][] = [];
    // Regex hledá [číslo.číslo, číslo.číslo]
    const coordRegex = /\[(\d+\.\d+),\s*(\d+\.\d+)\]/g;
    let match;
    while ((match = coordRegex.exec(gpsPart || fullText)) !== null) {
      waypoints.push([parseFloat(match[1]), parseFloat(match[2])]);
    }

    // Pokud AI vrátilo málo bodů, zkusíme prohledat celý text odpovědi
    if (waypoints.length < 5) {
      const backupMatch = fullText.matchAll(/\[(\d+\.\d+),\s*(\d+\.\d+)\]/g);
      for (const m of backupMatch) {
         const lat = parseFloat(m[1]);
         const lon = parseFloat(m[2]);
         if (!waypoints.some(w => w[0] === lat && w[1] === lon)) {
           waypoints.push([lat, lon]);
         }
      }
    }

    return { text, links: chunks, waypoints };
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
        systemInstruction: "Jsi MotoSpirit, český biker. Mluv slangem, buď stručný."
      }
    });
    return response.text || "Chyba komunikace.";
  } catch (error) {
    return handleApiError(error);
  }
};
