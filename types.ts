
export interface UserProfile {
  name: string;
  nickname: string;
  email?: string;
  pin?: string;
  experienceYears: number;
  ridingStyle: string;
  avatar?: string;
  isPublic?: boolean;
  publicBikes?: boolean;
  isAdmin?: boolean;
  isDeactivated?: boolean;
  following?: string[]; // List of syncCodes
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

export type TransportMode = 'moto' | 'car' | 'walk' | 'cablecar';

export interface Accommodation {
  name: string;
  type: string;
  rating: string;
  url: string;
  priceEstimate?: string;
}

export interface CountryInfo {
  name: string;
  speedLimits: string;
  alcoholLimit: string;
  mandatoryEquipment: string[];
  tolls: string;
  customRules: string[];
}

export interface ExpeditionBudget {
  plannedFuel: number;
  plannedAccommodation: number;
  plannedFood: number;
  plannedTolls: number;
  actualFuel?: number;
  actualAccommodation?: number;
  actualFood?: number;
  actualTolls?: number;
}

export interface TripDay {
  dayNumber: number;
  mode: TransportMode;
  startLocation: string;
  endLocation: string;
  distance: string;
  distanceKm?: number;
  estimatedTimeMins?: number;
  fuelLiters?: number;
  fuelCost?: number;
  countries?: string[];
  description: string;
  activities: string[];
  accommodation?: Accommodation;
  waypoints: [number, number][];
}

export interface ExpeditionPreferences {
  accommodation: 'wild' | 'camp' | 'pension' | 'hotel';
  experiences: string[]; // e.g., ['curves', 'history', 'food', 'offroad', 'views']
  pace: 'chill' | 'standard' | 'fast';
  budget: 'low' | 'mid' | 'high';
  customNote: string;
}

export interface Expedition {
  id: string;
  name: string;
  startDate: string;
  days: TripDay[];
  transportMode: TransportMode;
  totalDistance: string;
  totalDistanceKm?: number;
  budget?: ExpeditionBudget;
  countriesInfo?: CountryInfo[];
  preferences: ExpeditionPreferences;
  travelersCount: number;
  tripType?: 'ride' | 'expedition';
  sharedBy?: string;
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
  isFull: boolean;
  receiptImage?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface RideChallenge {
  id: string;
  creatorSyncCode: string;
  creatorNickname: string;
  title: string;
  dateTime: string;
  meetingPoint: string;
  style: string;
  description: string;
  route?: Expedition;
  participants: string[]; // List of syncCodes
  createdAt: string;
}

export interface POI {
  name: string;
  description: string;
  type: 'gas' | 'food' | 'view' | 'point' | 'service' | 'hotel';
  lat: number;
  lon: number;
  rating?: string;
  bikerTip?: string;
  url?: string;
}
