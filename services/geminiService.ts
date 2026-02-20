
import { GoogleGenAI, Type } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage, POI, Expedition, TransportMode, TripDay, ExpeditionPreferences } from "../types";

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

export const planExpedition = async (
  origin: string, 
  days: number, 
  mode: TransportMode, 
  preferences: ExpeditionPreferences,
  travelers: number,
  tripType: 'ride' | 'expedition' = 'expedition'
): Promise<Expedition> => {
  try {
    const ai = getAI();
    
    const typeContext = tripType === 'ride' 
      ? `Jedná se o jednodenní vyjížďku (ride) trvající cca ${days} hodin. ${preferences.isRoundTrip ? "MUSÍ se jednat o OKRUH - start i cíl jsou v místě: " + origin + "." : "Start je v místě: " + origin + "."} Zaměř se na scénické cesty, hledej nejlepší asfalt a 'Coffee & Cake' zastávky.`
      : `Jedná se o vícedenní expedici na ${days} dní. Naplánuj denní etapy, přesuny a logistiku ubytování. Start je v místě: ${origin}.`;

    const prompt = `Naplánuj detailní ${tripType === 'ride' ? 'vyjížďku' : 'expedici'} z ${origin} pro ${travelers} osoby/osob. 
    Dopravní prostředek: ${mode}. 
    ${typeContext}
    
    PREFERENCE:
    - Ubytování: ${preferences.accommodation} (wild=nadivoko, camp=kemp, pension=penzion, hotel=hotel)
    - Zážitky: ${preferences.experiences.join(', ')}
    - Tempo: ${preferences.pace} (chill=kochačka, standard=běžné, fast=rychlé/dlouhé přejezdy)
    - Rozpočet: ${preferences.budget}
    - Poznámka: ${preferences.customNote}
    
    Pro každý den uveď:
    - Název dne (např. "Cesta přes Alpy").
    - Podrobný popis cesty a zajímavostí (v češtině).
    - Sekci "ACCOMMODATION_INFO" s názvem hotelu/kempu v cíli dne a odkazem na mapu.
    - Sekci "GPS_DATA" se seznamem souřadnic [lat, lon] (alespoň 15-20 bodů na den pro plynulou trasu na mapě).
    
    Výstup strukturuj přesně takto (pro každý den): 
    DEN X: [Název]
    POPIS_X: ... text ...
    ACCOMMODATION_X: {"name": "Název", "type": "Hotel/Kemp", "url": "odkaz"}
    GPS_X: [lat, lon], [lat, lon]...`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
        temperature: 0.7,
      },
    });

    const fullText = response.text || "";
    const tripDays: TripDay[] = [];
    
    for (let i = 1; i <= (tripType === 'ride' ? 1 : days); i++) {
      const dayMarker = `DEN ${i}:`;
      const descMarker = `POPIS_${i}:`;
      const accomMarker = `ACCOMMODATION_${i}:`;
      const gpsMarker = `GPS_${i}:`;
      const nextDayMarker = `DEN ${i+1}:`;

      const dayTitle = fullText.split(dayMarker)[1]?.split(descMarker)[0]?.trim() || `Den ${i}`;
      const dayText = fullText.split(descMarker)[1]?.split(accomMarker)[0] || "";
      const accomText = fullText.split(accomMarker)[1]?.split(gpsMarker)[0] || "{}";
      const gpsText = fullText.split(gpsMarker)[1]?.split(nextDayMarker)[0]?.split('ACCOMMODATION_')[0] || "";

      let accommodation = { name: "Neznámé ubytování", type: "Přenocování", url: "", rating: "4.0" };
      try {
        const parsed = JSON.parse(accomText.trim().match(/\{[\s\S]*\}/)?.[0] || "{}");
        if (parsed.name) accommodation = { ...accommodation, ...parsed };
      } catch (e) {}

      const waypoints: [number, number][] = [];
      const coordRegex = /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
      let match;
      while ((match = coordRegex.exec(gpsText)) !== null) {
        waypoints.push([parseFloat(match[1]), parseFloat(match[2])]);
      }

      tripDays.push({
        dayNumber: i,
        mode,
        description: `### ${dayTitle}\n\n${dayText.trim()}`,
        waypoints,
        activities: [],
        accommodation,
        startLocation: origin,
        endLocation: tripType === 'ride' && preferences.isRoundTrip ? origin : "Cíl dne",
        distance: "Vypočítávám..."
      });
    }

    let dynamicName = `Expedice z ${origin} (${days} dní)`;
    if (tripType === 'ride') {
      if (days < 3) dynamicName = `Kolem komína z ${origin}`;
      else if (days <= 6) dynamicName = `Pořádnej švih z ${origin}`;
      else dynamicName = `Celodenní tah z ${origin}`;
      
      if (preferences.isRoundTrip) dynamicName += " (Okruh)";
    }

    return {
      id: Date.now().toString(),
      name: dynamicName,
      startDate: new Date().toISOString().split('T')[0],
      days: tripDays,
      transportMode: mode,
      totalDistance: "Kalkuluji...",
      preferences,
      travelersCount: travelers,
      tripType
    };
  } catch (error) {
    throw new Error(handleApiError(error));
  }
};

export const refineExpedition = async (
  currentExpedition: Expedition,
  refinementPrompt: string
): Promise<Expedition> => {
  try {
    const ai = getAI();
    
    const prompt = `Jsi expert na plánování motocyklových expedic. Máš stávající itinerář a uživatel ho chce upravit.
    
    STÁVAJÍCÍ EXPEDICE:
    ${JSON.stringify(currentExpedition, null, 2)}
    
    POŽADAVEK NA ÚPRAVU:
    "${refinementPrompt}"
    
    ÚKOL:
    Přeplánuj expedici podle požadavku. Můžeš změnit trasy, ubytování, popisy nebo i počet dní, pokud je to nutné.
    Zachovej strukturu výstupu jako u původního plánování.
    
    Výstup strukturuj přesně takto (pro každý den): 
    DEN X: [Název]
    POPIS_X: ... text ...
    ACCOMMODATION_X: {"name": "Název", "type": "Hotel/Kemp", "url": "odkaz"}
    GPS_X: [lat, lon], [lat, lon]...`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
        temperature: 0.7,
      },
    });

    const fullText = response.text || "";
    const tripDays: TripDay[] = [];
    
    // Parse the response (similar logic to planExpedition)
    // We assume the number of days might have changed, so we look for all DEN X markers
    const dayMarkers = fullText.match(/DEN \d+:/g) || [];
    const totalDays = dayMarkers.length;

    for (let i = 1; i <= totalDays; i++) {
      const dayMarker = `DEN ${i}:`;
      const descMarker = `POPIS_${i}:`;
      const accomMarker = `ACCOMMODATION_${i}:`;
      const gpsMarker = `GPS_${i}:`;
      const nextDayMarker = `DEN ${i+1}:`;

      const dayTitle = fullText.split(dayMarker)[1]?.split(descMarker)[0]?.trim() || `Den ${i}`;
      const dayText = fullText.split(descMarker)[1]?.split(accomMarker)[0] || "";
      const accomText = fullText.split(accomMarker)[1]?.split(gpsMarker)[0] || "{}";
      const gpsText = fullText.split(gpsMarker)[1]?.split(nextDayMarker)[0]?.split('ACCOMMODATION_')[0] || "";

      let accommodation = { name: "Neznámé ubytování", type: "Přenocování", url: "", rating: "4.0" };
      try {
        const parsed = JSON.parse(accomText.trim().match(/\{[\s\S]*\}/)?.[0] || "{}");
        if (parsed.name) accommodation = { ...accommodation, ...parsed };
      } catch (e) {}

      const waypoints: [number, number][] = [];
      const coordRegex = /\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*\]/g;
      let match;
      while ((match = coordRegex.exec(gpsText)) !== null) {
        waypoints.push([parseFloat(match[1]), parseFloat(match[2])]);
      }

      tripDays.push({
        dayNumber: i,
        mode: currentExpedition.transportMode,
        description: `### ${dayTitle}\n\n${dayText.trim()}`,
        waypoints,
        activities: [],
        accommodation,
        startLocation: currentExpedition.days[0]?.startLocation || "Start",
        endLocation: "Cíl dne",
        distance: "Vypočítávám..."
      });
    }

    return {
      ...currentExpedition,
      id: Date.now().toString(),
      days: tripDays,
    };
  } catch (error) {
    throw new Error(handleApiError(error));
  }
};

export const searchNearbyPOI = async (category: string, lat?: number, lon?: number, locationName?: string): Promise<POI[]> => {
  try {
    const ai = getAI();
    let locationContext = locationName ? `v lokalitě: ${locationName}` : `v okolí [${lat}, ${lon}]`;
    const prompt = `Najdi ${locationContext} nejlepší ${category}. 
    Pro každé místo uveď i "bikerTip" - užitečnou radu pro motorkáře (např. o parkování, povrchu cesty, atmosféře).
    Vrať JSON pole (name, description, type, lat, lon, rating, bikerTip, url).`;
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
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: input.base64 ? [{ inlineData: { data: input.base64, mimeType: input.mimeType || 'image/jpeg' } }, { text: "Extrahuj JSON." }] : "Extrahuj JSON.",
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
      contents: `Analyzuj stav ${bike.brand} ${bike.model}.`,
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
      config: { systemInstruction: "Jsi SpiritWanderer asistent. Mluv česky." }
    });
    return response.text || "";
  } catch (error) { return ""; }
};
