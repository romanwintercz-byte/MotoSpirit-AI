
import { GoogleGenAI } from "@google/genai";
import { Motorcycle, MaintenanceRecord, ChatMessage } from "../types";

/**
 * Inicializuje klienta pokaždé znovu, aby využil nejaktuálnější klíč z prostředí/dialogu.
 * Tím se vyhneme zastaralým klíčům po přepnutí uživatelem.
 */
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.error("CRITICAL: API_KEY is missing in process.env. Ensure it is set.");
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Centrální ošetření chyb pro Gemini API.
 */
const handleApiError = (error: any) => {
  console.error("MotoSpirit Full Error Context:", error);
  const msg = error.message || error.toString();
  
  // Detekce specifických stavů
  if (msg.includes("Requested entity was not found.")) {
    const aiWin = window as any;
    if (aiWin.aistudio && typeof aiWin.aistudio.openSelectKey === 'function') {
      aiWin.aistudio.openSelectKey();
    }
    return "❌ Klíč nebyl v projektu nalezen. Vyberte platný klíč s povoleným Gemini API v Google AI Studio.";
  }

  if (msg === "API_KEY_MISSING") {
    return "❌ API klíč nebyl nalezen v prostředí aplikace. Zkontrolujte Environment Variables.";
  }

  if (msg.includes("API key not valid")) {
    return "❌ Neplatný API klíč. Zkontrolujte nastavení v Google AI Studio.";
  }

  return "❌ Došlo k chybě při komunikaci s AI: " + msg;
};

// Fix: Přidán export analyzeMaintenance pro stránku Garage
/**
 * Analyzuje servisní historii motocyklu a poskytuje doporučení.
 */
export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const recordsText = records.map(r => `- ${r.date}: ${r.type} (${r.description}) při ${r.mileage} km, cena ${r.cost} Kč`).join('\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Jsi expert na motocykly a servisní technik. Analyzuj stav stroje ${bike.brand} ${bike.model} (rok ${bike.year}, najeto ${bike.mileage} km) podle těchto záznamů:\n${recordsText || 'Žádné historické záznamy nejsou v databázi.'}\n\nNapiš krátké, úderné doporučení, co by měl majitel zkontrolovat nebo udělat v nejbližší době. Mluv jako zkušený motorkář (tykání, slang).`,
    });
    
    return response.text || "Nepodařilo se vygenerovat analýzu. Zkus to později.";
  } catch (error) {
    return handleApiError(error);
  }
};

// Fix: Přidán export planTripWithGrounding pro stránku TripPlanner
/**
 * Plánuje výlet s využitím Google Search grounding pro aktuální data.
 */
export const planTripWithGrounding = async (origin: string, preferences: string): Promise<{ text: string, links: any[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Naplánuj nejlepší motorkářskou trasu ze startu: ${origin}. Preference jezdce: ${preferences}. Najdi zatáčky, kvalitní asfalt a zajímavé zastávky.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return {
      text: response.text || "Trasu se nepodařilo naplánovat.",
      links: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    // Pro komponentu TripPlanner vyhazujeme chybu, aby se zobrazil alert
    throw new Error(handleApiError(error));
  }
};

// Fix: Přidán export getBikerAdvice pro stránku Assistant
/**
 * Poskytuje rady uživateli v chatu s přihlédnutím k historii konverzace.
 */
export const getBikerAdvice = async (message: string, history: ChatMessage[]): Promise<string> => {
  try {
    const ai = getAI();
    // Konverze historie do textového kontextu pro jednoduchost v rámci generateContent
    const historyContext = history.map(m => `${m.role === 'user' ? 'Rider' : 'MotoSpirit'}: ${m.text}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${historyContext}\nRider: ${message}`,
      config: {
        systemInstruction: "Jsi MotoSpirit, drsný ale přátelský motorkářský asistent. Radíš s technikou jízdy, servisem a výběrem výbavy. Používej motorkářský slang, buď stručný a věcný. Nikdy neodpovídej jako robot, buď parťák na cestách."
      }
    });

    return response.text || "MotoSpirit teď ladí motor a nemůže mluvit. Zkus to za chvilku.";
  } catch (error) {
    return handleApiError(error);
  }
};
