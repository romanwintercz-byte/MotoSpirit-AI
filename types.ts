
export interface UserProfile {
  name: string;
  nickname: string;
  experienceYears: number;
  ridingStyle: string;
  avatar?: string;
}

export interface Motorcycle {
  id: string;
  brand: string;
  model: string;
  year: number;
  vin?: string;
  mileage: number;
  image?: string;
}

export interface MaintenanceRecord {
  id: string;
  bikeId: string;
  date: string;
  type: string;
  description: string;
  mileage: number;
  cost: number;
  receiptImage?: string;
}

export interface FuelRecord {
  id: string;
  bikeId: string;
  date: string;
  mileage: number;
  liters: number;
  cost: number;
  isFull: boolean; // Předpokládáme true podle zadání
  receiptImage?: string;
}

export interface RouteSuggestion {
  name: string;
  description: string;
  stops: string[];
  distance: string;
  difficulty: 'Snadná' | 'Střední' | 'Náročná';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
