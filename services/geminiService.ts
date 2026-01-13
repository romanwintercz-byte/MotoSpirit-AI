
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
    
    const systemInstruction = `Jsi elitní motocyklový navigátor pro Českou republiku a Evropu. 
    Tvým úkolem je vytvořit itinerář a seznam GPS souřadnic, které se k němu VÁŽOU.

    KRITICKÁ PRAVIDLA:
    1. Pokud je start v ${origin}, souřadnice MUSÍ začínat v této lokalitě.
    2. Před vygenerováním GPS dat si ověř (pomocí interních znalostí a Google Maps), zda souřadnice [lat, lon] odpovídají popsaným místům v textu.
    3. Pokud píšeš o Teplicích, souřadnice nesmí být v Rakousku (lat ~47), ale v severních Čechách (lat ~50.6).
    4. Vygeneruj plynulou sekvenci cca 40-60 bodů v sekci "GPS_ROUTE_DATA".
    
    FORMÁT:
    [Textový itinerář s tipy na zatáčky a zastávky]
    
    GPS_ROUTE_DATA
    [50.640, 13.824], [50.651, 13.835], ...`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: `Naplánuj trasu: ${origin}. Preference: ${preferences}. Dbej na to, aby souřadnice přesně kopírovaly popsaný itinerář a region.`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });
    
    const fullText = response.text || "";
    const gpsMarker = "GPS_ROUTE_DATA";
    const parts = fullText.split(gpsMarker);
    const textPart = parts[0];
    const gpsPart = parts.length > 1 ? parts[1] : fullText;
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const waypoints: [number, number][] = [];
    
    // Vylepšený regex pro zachycení souřadnic i s volitelnými znaménky a mezerami
    const coordRegex = /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
    
    let match;
    while ((match = coordRegex.exec(gpsPart)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      // Základní sanity check (v rámci Evropy/Světa dle potřeby, zde širší rozsah)
      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push([lat, lon]);
      }
    }

    return { text: textPart, links: chunks, waypoints };
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
