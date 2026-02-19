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
      await supabase
        .from('moto_sync_profiles')
        .upsert({ sync_code: syncCode, user_data: data.user }, { onConflict: 'sync_code' });
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

      await supabase
        .from('moto_garage')
        .upsert(updateData, { onConflict: 'sync_code' });
    }

    // 3. Update Expeditions
    if (data.expeditions) {
      // For simplicity, we store all expeditions in one JSON for the sync profile
      // or we could store them individually. Let's do a single record for now to keep it simple.
      await supabase
        .from('moto_expeditions')
        .upsert({ 
          sync_code: syncCode, 
          expedition_data: data.expeditions 
        }, { onConflict: 'sync_code' });
    }
  } catch (error) {
    console.error("Sync error:", error);
  }
};

export const fetchDataFromCloud = async (syncCode: string) => {
  try {
    const [profile, garage, expeditions] = await Promise.all([
      supabase.from('moto_sync_profiles').select('user_data').eq('sync_code', syncCode).single(),
      supabase.from('moto_garage').select('*').eq('sync_code', syncCode).single(),
      supabase.from('moto_expeditions').select('expedition_data').eq('sync_code', syncCode).single()
    ]);

    return {
      user: profile.data?.user_data as UserProfile | null,
      bikes: garage.data?.bikes_data as Motorcycle[] | null,
      records: garage.data?.records_data as MaintenanceRecord[] | null,
      fuel: garage.data?.fuel_data as FuelRecord[] | null,
      expeditions: expeditions.data?.expedition_data as Expedition[] | null
    };
  } catch (error) {
    console.error("Fetch sync error:", error);
    return null;
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
