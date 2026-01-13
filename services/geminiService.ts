
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
    
    // Klíčová změna: Prompt vyžaduje, aby GPS data byla EXAKTNÍM odrazem textu
    const systemInstruction = `Jsi profesionální motocyklový navigátor. Tvým úkolem je vytvořit detailní itinerář a PŘESNĚ ODPOVÍDAJÍCÍ seznam GPS souřadnic.

    POSTUP:
    1. Pomocí nástroje Google Maps najdi reálnou trasu z bodu ${origin} podle preferencí: ${preferences}.
    2. Napiš čtivý itinerář (itinerář musí obsahovat názvy měst a silnic, které reálně existují).
    3. Na konci odpovědi vytvoř sekci "GPS_ROUTE_DATA".
    4. Do této sekce vlož seznam souřadnic [lat, lon], které TVOŘÍ PRÁVĚ TU CESTU, kterou jsi popsal v textu.
    5. Musí jít o plynulou sekvenci (aspoň 50-80 bodů), které na sebe navazují a přesně kopírují silnice zmíněné v itineráři. 
    6. Nepřidávej body mimo popsanou trasu.
    
    Formát sekce GPS:
    GPS_ROUTE_DATA
    [lat1, lon1], [lat2, lon2], [lat3, lon3] ...`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: `Naplánuj výlet z: ${origin}. Preference: ${preferences}. Zajisti, aby GPS body v sekci GPS_ROUTE_DATA přesně odpovídaly popsanému itineráři.`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });
    
    const fullText = response.text || "";
    // Hledáme začátek GPS dat
    const gpsMarker = "GPS_ROUTE_DATA";
    const parts = fullText.split(gpsMarker);
    const textPart = parts[0];
    const gpsPart = parts.length > 1 ? parts[1] : fullText; // Pokud marker chybí, prohledáme vše
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const waypoints: [number, number][] = [];
    // Regex, který ignoruje okolní text a najde jen dvojice v závorkách
    const coordRegex = /\[\s*(\d+\.\d+)\s*,\s*(\d+\.\d+)\s*\]/g;
    
    let match;
    while ((match = coordRegex.exec(gpsPart)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      // Validace pro střední Evropu + okraj
      if (lat > 34 && lat < 72 && lon > -12 && lon < 45) {
        waypoints.push([lat, lon]);
      }
    }

    // Pokud se nepodařilo najít body v gpsPart, zkusíme prohledat celý text jako fallback
    if (waypoints.length < 5 && parts.length === 1) {
       let fallbackMatch;
       while ((fallbackMatch = coordRegex.exec(fullText)) !== null) {
         waypoints.push([parseFloat(fallbackMatch[1]), parseFloat(fallbackMatch[2])]);
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
