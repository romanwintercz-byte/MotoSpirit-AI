import { supabase } from './supabaseClient';
import { Expedition, Motorcycle, MaintenanceRecord, FuelRecord, UserProfile } from '../types';

export const generateSyncCode = () => {
  const adjectives = ['RYCHLY', 'DIVOKY', 'SILNY', 'MODRY', 'ORANZOVY', 'HORSKY'];
  const nouns = ['PIST', 'RETEZ', 'VYFUK', 'MOTOR', 'JEZDEC', 'SPIRIT'];
  const num = Math.floor(100 + Math.random() * 899);
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}-${noun}-${num}`;
};

export const syncDataToCloud = async (syncCode: string, data: {
  user?: UserProfile;
  bikes?: Motorcycle[];
  records?: MaintenanceRecord[];
  fuel?: FuelRecord[];
  expeditions?: Expedition[];
}) => {
  if (!syncCode) return;

  try {
    // 1. Update Profile & User Data
    if (data.user) {
      const { error } = await supabase
        .from('moto_sync_profiles')
        .upsert({ sync_code: syncCode, user_data: data.user }, { onConflict: 'sync_code' });
      if (error) throw new Error(`Profile sync failed: ${error.message}`);
    }

    // 2. Update Garage (Bikes, Records, Fuel)
    if (data.bikes || data.records || data.fuel) {
      const existingGarage = await supabase
        .from('moto_garage')
        .select('*')
        .eq('sync_code', syncCode)
        .single();

      const updateData = {
        sync_code: syncCode,
        bikes_data: data.bikes || (existingGarage.data?.bikes_data || []),
        records_data: data.records || (existingGarage.data?.records_data || []),
        fuel_data: data.fuel || (existingGarage.data?.fuel_data || []),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('moto_garage')
        .upsert(updateData, { onConflict: 'sync_code' });
      if (error) throw new Error(`Garage sync failed: ${error.message}`);
    }

    // 3. Update Expeditions
    if (data.expeditions) {
      const { error } = await supabase
        .from('moto_expeditions')
        .upsert({ 
          sync_code: syncCode, 
          expedition_data: data.expeditions 
        }, { onConflict: 'sync_code' });
      if (error) throw new Error(`Expedition sync failed: ${error.message}`);
    }
  } catch (error) {
    console.error("Sync error:", error);
    throw error; // Re-throw to be caught by the UI
  }
};

export const fetchDataFromCloud = async (syncCode: string) => {
  try {
    const [profile, garage, expeditions] = await Promise.all([
      supabase.from('moto_sync_profiles').select('user_data').eq('sync_code', syncCode).single(),
      supabase.from('moto_garage').select('*').eq('sync_code', syncCode).single(),
      supabase.from('moto_expeditions').select('expedition_data').eq('sync_code', syncCode).single()
    ]);

    // We don't throw if data is missing, as a new user might not have all tables populated yet.
    // But we should log errors if they are not "PGRST116" (row not found).
    if (profile.error && profile.error.code !== 'PGRST116') throw new Error(`Profile fetch error: ${profile.error.message}`);
    if (garage.error && garage.error.code !== 'PGRST116') throw new Error(`Garage fetch error: ${garage.error.message}`);
    if (expeditions.error && expeditions.error.code !== 'PGRST116') throw new Error(`Expeditions fetch error: ${expeditions.error.message}`);

    return {
      user: profile.data?.user_data as UserProfile | null,
      bikes: garage.data?.bikes_data as Motorcycle[] | null,
      records: garage.data?.records_data as MaintenanceRecord[] | null,
      fuel: garage.data?.fuel_data as FuelRecord[] | null,
      expeditions: expeditions.data?.expedition_data as Expedition[] | null
    };
  } catch (error) {
    console.error("Fetch sync error:", error);
    throw error;
  }
};

export const shareExpeditionPublicly = async (syncCode: string, expedition: Expedition) => {
  const slug = `${expedition.name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(2, 7)}`;
  
  try {
    await supabase.from('moto_shared_trips').insert({
      slug,
      expedition_data: expedition,
      created_by: syncCode
    });
    return slug;
  } catch (error) {
    console.error("Sharing error:", error);
    return null;
  }
};
