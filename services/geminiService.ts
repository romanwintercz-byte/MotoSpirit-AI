
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

/**
 * AI extrakce dat z účtenky (obrázek nebo hlas)
 */
export const processReceiptAI = async (input: { base64?: string, mimeType?: string, text?: string }): Promise<any> => {
  try {
    const ai = getAI();
    const parts: any[] = [];
    
    if (input.base64 && input.mimeType) {
      parts.push({
        inlineData: { data: input.base64, mimeType: input.mimeType }
      });
    }
    
    const prompt = input.text 
      ? `Z tohoto hlasového popisu nebo textu extrahuj data o výdaji na motorku: "${input.text}".`
      : `Z této účtenky (český daňový doklad) extrahuj data o výdaji. Zaměř se na celkovou částku, počet litrů (pokud jde o palivo) a stav tachometru (pokud je na účtence ručně dopsán nebo vytištěn).`;

    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: { parts: [...parts, { text: `${prompt} Vrať JSON s poli: type (hodnoty: "fuel" pro benzín, "service" pro opravy, "other" pro zbytek), cost (číslo - celková cena v Kč), liters (číslo - počet litrů, jen u fuel), mileage (číslo - stav tachometru v km), date (YYYY-MM-DD), description (stručný český popis). Pokud hodnotu nevidíš, dej null. Buď přesný.` }] },
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
    console.error("AI Receipt Error:", error);
    return null;
  }
};

export const analyzeMaintenance = async (bike: Motorcycle, records: MaintenanceRecord[]): Promise<string> => {
  try {
    const ai = getAI();
    const recordsText = records.map(r => `- ${r.date}: ${r.type}`).join('\n');
    const response = await ai.models.generateContent({
      model: MODEL_3_FLASH,
      contents: `Jsi zkušený motocyklový mechanik. Analyzuj stav motorky: ${bike.brand} ${bike.model}, najeto ${bike.mileage} km. Předchozí servis: ${recordsText || 'žádný záznam'}. Navrhni, co by měl majitel zkontrolovat nebo vyměnit v nejbližší době. Buď stručný, kamarádský a věcný v češtině.`,
    });
    return response.text || "Zkus to později.";
  } catch (error) {
    return handleApiError(error);
  }
};

export const planTripWithGrounding = async (origin: string, preferences: string): Promise<{ text: string, links: any[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: MODEL_2_5,
      contents: `Navrhni detailní motovýlet z místa: ${origin}. Moje preference jsou: ${preferences}. Najdi reálné trasy, vyhlídky a motorkářské zastávky. Odpovídej v češtině.`,
      config: {
        tools: [{ googleSearch: {} }, { googleMaps: {} }],
      },
    });
    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { text, links: chunks };
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
        systemInstruction: "Jsi MotoSpirit, zkušený český biker. Odpovídej kamarádsky, používej motorkářský slang (mašina, naložit tomu, zatáčky, plexi), buď užitečný a stručný."
      }
    });
    return response.text || "Teď mi to nějak vynechává, zkus to znovu.";
  } catch (error) {
    return handleApiError(error);
  }
};
