
import { GoogleGenAI, Type } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage, POI, Expedition, TransportMode } from "../types";

const MODEL_2_5 = 'gemini-2.5-flash';
const MODEL_3_FLASH = 'gemini-3-flash-preview';

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = (error: any) => {
  console.error("AI Error:", error);
  return "❌ Došlo k chybě při komunikaci s AI.";
};

/**
 * Plánuje komplexní vícedenní expedici.
 */
export const planExpedition = async (
  origin: string, 
  days: number, 
  mode: TransportMode, 
  preferences: string
): Promise<Expedition> => {
  try {
    const ai = getAI();
    
    const prompt = `Naplánuj vícedenní výlet (expedici) na ${days} dní začínající v ${origin}. 
    Dopravní prostředek: ${mode}. 
    Preference uživatele: ${preferences}.
    
    Pro každý den vygeneruj:
    1. Popis trasy a cíl dne.
    2. Seznam 3-4 hlavních aktivit (včetně pěších výletů nebo lanovek, pokud se hodí).
    3. Doporučení na ubytování v cíli dne (název, typ, orientační cena).
    4. Geografické body trasy pro mapu (GPS_ROUTE_DATA).
    
    VÝSTUP MUSÍ BÝT STRUKTUROVANÝ TEXT, kde pro každý den bude sekce "DEN X", pak popis a nakonec sekce "GPS_DATA_X" se seznamem souřadnic [lat, lon].
    Na konci přidej sekci "ACCOMMODATION_JSON" s JSON polem objektů ubytování pro každý den.
    
    Pamatuj: Pokud je mód 'walk', hledej turistické trasy. Pokud 'moto', hledej zatáčky. Pokud 'car', hledej komfortní cesty.`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
        temperature: 0.7,
      },
    });

    const fullText = response.text || "";
    
    // Parsování dní (velmi zjednodušená verze pro demo, v produkci by byl lepší responseSchema)
    const tripDays: any[] = [];
    for (let i = 1; i <= days; i++) {
      const dayMarker = `DEN ${i}`;
      const nextDayMarker = `DEN ${i + 1}`;
      const gpsMarker = `GPS_DATA_${i}`;
      
      const daySection = fullText.split(dayMarker)[1]?.split(nextDayMarker)[0]?.split(gpsMarker)[0] || "Popis dne nebyl vygenerován.";
      const gpsSection = fullText.split(gpsMarker)[1]?.split(`DEN ${i + 1}`)[0]?.split("ACCOMMODATION_JSON")[0] || "";
      
      const waypoints: [number, number][] = [];
      const coordRegex = /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
      let match;
      while ((match = coordRegex.exec(gpsSection)) !== null) {
        waypoints.push([parseFloat(match[1]), parseFloat(match[2])]);
      }

      tripDays.push({
        dayNumber: i,
        mode,
        description: daySection.trim(),
        waypoints,
        activities: [], // Mohlo by se dále parsovat
        startLocation: i === 1 ? origin : "Cíl předchozího dne",
        endLocation: "Cíl dne",
        distance: "Dle trasy"
      });
    }

    return {
      id: Date.now().toString(),
      name: `Expedice z ${origin}`,
      startDate: new Date().toISOString().split('T')[0],
      days: tripDays,
      transportMode: mode,
      totalDistance: "Kalkuluji...",
      preferences
    };
  } catch (error) {
    throw new Error(handleApiError(error));
  }
};

export const searchNearbyPOI = async (category: string, lat?: number, lon?: number, locationName?: string): Promise<POI[]> => {
  try {
    const ai = getAI();
    let locationContext = locationName ? `v lokalitě: ${locationName}` : `v okolí [${lat}, ${lon}]`;
    const prompt = `Jsi cestovní průvodce. Najdi ${locationContext} nejlepší ${category}. Vrať čisté JSON pole objektů (name, description, type, lat, lon, rating, url). Typy: gas, food, view, point, service, hotel.`;
    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: { tools: [{ googleMaps: {} }] }
    });
    const jsonStr = (response.text?.match(/\[[\s\S]*\]/) || ["[]"])[0];
    return JSON.parse(jsonStr);
  } catch (error) { return []; }
};

export const processReceiptAI = async (input: { base64?: string, mimeType?: string, text?: string }): Promise<any> => {
  try {
    const ai = getAI();
    const prompt = input.text ? `Extrahuj výdaj z: ${input.text}` : `Extrahuj výdaj z účtenky.`;
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: input.base64 ? [{ inlineData: { data: input.base64, mimeType: input.mimeType || 'image/jpeg' } }, { text: prompt }] : prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) { return null; }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: `Analyzuj stav ${bike.brand} ${bike.model}, ${bike.mileage}km. Servis: ${JSON.stringify(records)}.`,
    });
    return response.text || "";
  } catch (error) { return ""; }
};

export const getBikerAdvice = async (message: string, history: ChatMessage[]): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: message,
      config: { systemInstruction: "Jsi MotoSpirit/SpiritWanderer, cestovní asistent. Mluv česky, stručně, slangem." }
    });
    return response.text || "";
  } catch (error) { return ""; }
};
