
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
  tripType: 'ride' | 'expedition' = 'expedition',
  startDate?: string
): Promise<Expedition> => {
  try {
    const ai = getAI();
    
    const durationText = tripType === 'ride' ? `${days}-hodinovou vyjížďku` : `${days}-denní expedici`;

    const typeContext = tripType === 'ride' 
      ? `Jedná se o jednodenní vyjížďku (ride) na cca ${days} hodin. Zaměř se na scénický okruh se startem i cílem v místě startu. Hledej nejlepší asfalt a 'Coffee & Cake' zastávky. Vrať PŘESNĚ 1 den v poli "days". Název (name) musí odrážet, že jde o vyjížďku (např. "Odpolední okruh Kokořínskem"), NEPOUŽÍVEJ slovo "Expedice".`
      : `Jedná se o vícedenní expedici na ${days} dní. Naplánuj denní etapy, přesuny a logistiku ubytování. Vrať PŘESNĚ ${days} dní v poli "days".`;

    const prompt = `Jsi expert na plánování motorkářských tras a expedic. Naplánuj detailní ${durationText} z ${origin} pro ${travelers} osoby/osob. 
    Dopravní prostředek: ${mode}. 
    ${typeContext}
    
    PREFERENCE:
    - Ubytování: ${preferences.accommodation} (wild=nadivoko, camp=kemp, pension=penzion, hotel=hotel)
    - Zážitky: ${preferences.experiences.join(', ')}
    - Tempo: ${preferences.pace} (chill=kochačka, standard=běžné, fast=rychlé/dlouhé přejezdy)
    - Rozpočet: ${preferences.budget}
    - Poznámka: ${preferences.customNote}
    
    Dynamický Checklist výbavy:
    Vygeneruj v poli "checklist" seznam vybavení šitý na míru této expedici. Pokud je v preferencích kempování nebo spaní nadivoko, přidej stan, spacák, vařič atd. Pokud se jede přes země s určitou povinnou výbavou (Rakousko -> lékárnička, reflexní vesta), zohledni to. Každá položka musí mít 'id', 'category', 'name' a 'checked' nastaveno na false.

    DŮLEŽITÉ K ROZPOČTU:
    Rozpočet (v objektu "budget" a "fuelCost" u každého dne) MUSÍ BÝT VYPOČÍTÁN STRICTNĚ PRO 1 OSOBU (1 motocykl, 1 jezdec), i když se expedice účastní ${travelers} lidí! Nikdy nenásob náklady počtem osob. Ceny jsou per capita.
    
    KRITICKÁ PRAVIDLA PRO GEOGRAFII A TRASU:
    1. Trasa MUSÍ dávat absolutní geografický smysl. Cesta musí vést logicky z bodu A do bodu B.
    2. ZABRAŇ NESMYSLNÝM ZAJÍŽĎKÁM! (Např. z Teplic na Oravu se nejezdí přes východní Polsko, ze Slovenska do ČR se nejezdí přes Německo).
    3. Trasa musí kopírovat reálné silnice, ideálně ty nejhezčí pro motorkáře (pokud není zvoleno tempo "fast" pro dálnice).
    4. U waypoints vygeneruj PŘESNĚ 25 bodů (souřadnic [latitude, longitude]) pro každý den. Tyto body musí být přesně na silnici, kudy má trasa vést. Nevymýšlej si body mimo silnice.
    5. Zkontroluj si, že souřadnice opravdu leží na trase a neodhazují trasu do jiných států.
    6. První bod musí být přesně startLocation a poslední bod přesně endLocation. Ostatních 23 bodů rozprostři rovnoměrně po trase.
    
    Vrať POUZE validní JSON objekt s následující strukturou (bez markdown bloků, jen čistý JSON):
    {
      "name": "Název trasy/expedice",
      "totalDistanceKm": 1200,
      "budget": {
        "plannedFuel": 3500,
        "plannedAccommodation": 4000,
        "plannedFood": 3000,
        "plannedTolls": 500
      },
      "checklist": [
        { "id": "uuid-1", "category": "Kempování", "name": "Stan", "checked": false },
        { "id": "uuid-2", "category": "Oblečení", "name": "Nepromokavá kombinéza", "checked": false },
        { "id": "uuid-3", "category": "Povinná výbava", "name": "Reflexní vesta (Rakousko)", "checked": false }
      ],
      "countriesInfo": [
        {
          "name": "Rakousko",
          "speedLimits": "50 / 100 / 130",
          "alcoholLimit": "0.5 ‰",
          "mandatoryEquipment": ["Lékárnička", "Reflexní vesta"],
          "tolls": "Dálniční známka 10 dní (cca 11.50 EUR), mýto Grossglockner",
          "customRules": ["Zákaz palubních kamer", "Zákaz hlučných výfuků v některých oblastech"]
        }
      ],
      "days": [
        {
          "dayNumber": 1,
          "startLocation": "Praha",
          "endLocation": "Salzburg",
          "distanceKm": 380,
          "estimatedTimeMins": 300,
          "fuelLiters": 19,
          "fuelCost": 750,
          "countries": ["Česká republika", "Rakousko"],
          "dayTitle": "Cesta na jih",
          "description": "Detailní popis trasy, zajímavosti cestou...",
          "activities": ["Zastávka na kávu v ČB", "Prohlídka centra Salzburgu"],
          "accommodation": {
            "name": "Kemp u jezera",
            "type": "camp",
            "rating": "4.5",
            "url": "https://maps.google.com/...",
            "priceEstimate": "500 Kč"
          },
          "waypoints": [[49.8, 14.4], [48.9, 14.4], [47.8, 13.0]]
        }
      ]
    }
    
    DŮLEŽITÉ: U waypoints vygeneruj alespoň 15-20 bodů pro každý den, aby trasa na mapě byla plynulá.`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      },
    });

    const fullText = response.text || "";
    let parsedData: any;
    try {
      const jsonStr = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from AI response", e, fullText);
      throw new Error("AI vrátila neplatný formát dat.");
    }

    const tripDays: TripDay[] = parsedData.days.map((d: any) => ({
      dayNumber: d.dayNumber,
      mode,
      startLocation: d.startLocation || origin,
      endLocation: d.endLocation || "Cíl",
      distance: `${d.distanceKm || 0} km`,
      distanceKm: d.distanceKm,
      estimatedTimeMins: d.estimatedTimeMins,
      fuelLiters: d.fuelLiters,
      fuelCost: d.fuelCost,
      countries: d.countries || [],
      description: `### ${d.dayTitle || `Den ${d.dayNumber}`}\n\n${d.description || ''}`,
      activities: d.activities || [],
      accommodation: d.accommodation || { name: "Neznámé ubytování", type: "Přenocování", url: "", rating: "4.0" },
      waypoints: d.waypoints || []
    }));

    return {
      id: Date.now().toString(),
      name: parsedData.name || `Expedice z ${origin} (${days} dní)`,
      startDate: startDate || new Date().toISOString().split('T')[0],
      days: tripDays,
      transportMode: mode,
      totalDistance: `${parsedData.totalDistanceKm || 0} km`,
      totalDistanceKm: parsedData.totalDistanceKm,
      budget: parsedData.budget,
      checklist: parsedData.checklist || [],
      countriesInfo: parsedData.countriesInfo || [],
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
    
    const strippedExpedition = { ...currentExpedition, days: currentExpedition.days.map(day => { const { gpxRoute, elevationProfile, ...rest } = day; return rest; }) };
    const prompt = `Jsi expert na plánování motocyklových expedic. Máš stávající itinerář (ve formátu JSON) a uživatel ho chce upravit.
    
    STÁVAJÍCÍ EXPEDICE:
    ${JSON.stringify(strippedExpedition, null, 2)}
    
    POŽADAVEK NA ÚPRAVU:
    "${refinementPrompt}"
    
    ÚKOL:
    Přeplánuj expedici podle požadavku. Můžeš změnit trasy, ubytování, popisy nebo i počet dní, pokud je to nutné.
    
    DŮLEŽITÉ K ROZPOČTU:
    Rozpočet (v objektu "budget" a "fuelCost" u každého dne) MUSÍ BÝT VYPOČÍTÁN STRICTNĚ PRO 1 OSOBU (1 motocykl, 1 jezdec), i když se expedice účastní ${currentExpedition.travelersCount} lidí! Nikdy nenásob náklady počtem osob. Pokud je požadavek na změnu, předělej ceny striktně pro 1 osobu!
    
    KRITICKÁ PRAVIDLA PRO GEOGRAFII A TRASU:
    1. Trasa MUSÍ dávat absolutní geografický smysl. Cesta musí vést logicky z bodu A do bodu B.
    2. ZABRAŇ NESMYSLNÝM ZAJÍŽĎKÁM! (Např. z Teplic na Oravu se nejezdí přes východní Polsko, ze Slovenska do ČR se nejezdí přes Německo).
    3. Trasa musí kopírovat reálné silnice, ideálně ty nejhezčí pro motorkáře.
    4. U waypoints vygeneruj alespoň 20-30 bodů (souřadnic [latitude, longitude]) pro každý den. Tyto body musí tvořit plynulou a reálnou křivku po silnicích.
    5. Zkontroluj si, že souřadnice opravdu leží na trase a neodhazují trasu do jiných států.
    
    Vrať POUZE validní JSON objekt se stejnou strukturou jako původní expedice (bez markdown bloků, jen čistý JSON).`;

    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      },
    });

    const fullText = response.text || "";
    let parsedData: any;
    try {
      const jsonStr = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON from AI response", e, fullText);
      throw new Error("AI vrátila neplatný formát dat.");
    }

    return {
      ...currentExpedition,
      ...parsedData,
      id: currentExpedition.id, // keep original ID
      days: parsedData.days.map((d: any) => {
        const existingDay = currentExpedition.days.find(cd => cd.dayNumber === d.dayNumber);
        return {
          ...d,
          gpxRoute: d.gpxRoute || (existingDay ? existingDay.gpxRoute : undefined),
          elevationProfile: d.elevationProfile || (existingDay ? existingDay.elevationProfile : undefined),
          maxElevation: d.maxElevation !== undefined ? d.maxElevation : (existingDay ? existingDay.maxElevation : undefined),
          minElevation: d.minElevation !== undefined ? d.minElevation : (existingDay ? existingDay.minElevation : undefined),
          startElevation: d.startElevation !== undefined ? d.startElevation : (existingDay ? existingDay.startElevation : undefined),
          endElevation: d.endElevation !== undefined ? d.endElevation : (existingDay ? existingDay.endElevation : undefined),
          mode: currentExpedition.transportMode,
          distance: `${d.distanceKm || (existingDay ? existingDay.distanceKm : 0)} km`,
          description: d.description && !d.description.startsWith('###') ? `### ${d.dayTitle || `Den ${d.dayNumber}`}\n\n${d.description}` : d.description
        };
      })
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
    Dále pro každé místo uveď "distance" - odhadovanou vzdálenost od ${locationName || 'zadané polohy'} (např. "5 km", "12 km").
    Vrať JSON pole (name, description, type, lat, lon, rating, bikerTip, url, distance).`;
    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
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
