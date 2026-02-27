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

export const checkProfileExists = async (email: string) => {
  try {
    const { data, error } = await supabase
      .from('moto_sync_profiles')
      .select('sync_code')
      .eq('sync_code', email)
      .maybeSingle();
    
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error("Error checking profile:", error);
    return false;
  }
};

export const authenticateProfile = async (email: string, pin: string) => {
  try {
    const { data, error } = await supabase
      .from('moto_sync_profiles')
      .select('user_data')
      .eq('sync_code', email)
      .maybeSingle();
    
    if (error) throw error;
    if (!data || !data.user_data) return false;
    
    const userData = data.user_data as UserProfile;
    return userData.pin === pin;
  } catch (error) {
    console.error("Error authenticating profile:", error);
    return false;
  }
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
    // 1. Ensure Profile exists (Upsert)
    // We do this first because other tables have a foreign key to this
    if (data.user) {
      const { error: profileError } = await supabase
        .from('moto_sync_profiles')
        .upsert({ 
          sync_code: syncCode, 
          user_data: data.user 
        }, { onConflict: 'sync_code' });
      
      if (profileError) throw new Error(`Profile sync failed: ${profileError.message}`);
    } else {
      // If user data isn't provided, we still need to ensure the profile record exists 
      // so foreign keys don't fail.
      await supabase.from('moto_sync_profiles').upsert({ sync_code: syncCode }, { onConflict: 'sync_code' });
    }

    // 2. Update Garage (Direct Upsert)
    // Since handleSyncPush sends all local data, we can safely overwrite the cloud state
    if (data.bikes || data.records || data.fuel) {
      const updateData: any = {
        sync_code: syncCode,
        updated_at: new Date().toISOString()
      };
      
      if (data.bikes) updateData.bikes_data = data.bikes;
      if (data.records) updateData.records_data = data.records;
      if (data.fuel) updateData.fuel_data = data.fuel;

      const { error: garageError } = await supabase
        .from('moto_garage')
        .upsert(updateData, { onConflict: 'sync_code' });
        
      if (garageError) throw new Error(`Garage sync failed: ${garageError.message}`);
    }

    // 3. Update Expeditions
    if (data.expeditions) {
      const { error: expError } = await supabase
        .from('moto_expeditions')
        .upsert({ 
          sync_code: syncCode, 
          expedition_data: data.expeditions,
          updated_at: new Date().toISOString()
        }, { onConflict: 'sync_code' });
        
      if (expError) throw new Error(`Expedition sync failed: ${expError.message}`);
    }
  } catch (error) {
    console.error("Sync error details:", error);
    throw error;
  }
};

export const fetchDataFromCloud = async (syncCode: string) => {
  try {
    const [profile, garage, expeditions] = await Promise.all([
      supabase.from('moto_sync_profiles').select('user_data').eq('sync_code', syncCode).maybeSingle(),
      supabase.from('moto_garage').select('*').eq('sync_code', syncCode).maybeSingle(),
      supabase.from('moto_expeditions').select('expedition_data').eq('sync_code', syncCode).maybeSingle()
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
    throw error;
  }
};

export const subscribeToCloudChanges = (syncCode: string, callback: (data: any) => void) => {
  if (!syncCode) return null;

  // Fetch initial data on subscription
  fetchDataFromCloud(syncCode).then(data => {
    if (data) callback(data);
  }).catch(console.error);

  const channel = supabase
    .channel(`sync-${syncCode}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'moto_garage', filter: `sync_code=eq.${syncCode}` },
      async () => {
        const data = await fetchDataFromCloud(syncCode);
        callback(data);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'moto_expeditions', filter: `sync_code=eq.${syncCode}` },
      async () => {
        const data = await fetchDataFromCloud(syncCode);
        callback(data);
      }
    )
    .subscribe();

  return channel;
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

export const getAllPublicProfiles = async () => {
  try {
    const { data: profiles, error: pError } = await supabase
      .from('moto_sync_profiles')
      .select('sync_code, user_data');
    
    if (pError) throw pError;

    const { data: garages, error: gError } = await supabase
      .from('moto_garage')
      .select('sync_code, bikes_data');
    
    if (gError) throw gError;

    return (profiles || []).map(p => {
      const userData = p.user_data as UserProfile;
      const garage = (garages || []).find(g => g.sync_code === p.sync_code);
      return {
        syncCode: p.sync_code,
        user: userData,
        bikes: (garage?.bikes_data as Motorcycle[]) || []
      };
    });
  } catch (error) {
    console.error("Error fetching public profiles:", error);
    return [];
  }
};

export const updateProfileStatus = async (syncCode: string, userData: UserProfile) => {
  try {
    const { error } = await supabase
      .from('moto_sync_profiles')
      .update({ user_data: userData })
      .eq('sync_code', syncCode);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating profile status:", error);
    return false;
  }
};

export const deleteProfile = async (syncCode: string) => {
  try {
    // Delete from all related tables
    await Promise.all([
      supabase.from('moto_sync_profiles').delete().eq('sync_code', syncCode),
      supabase.from('moto_garage').delete().eq('sync_code', syncCode),
      supabase.from('moto_expeditions').delete().eq('sync_code', syncCode)
    ]);
    return true;
  } catch (error) {
    console.error("Error deleting profile:", error);
    return false;
  }
};

export const sendTripToRider = async (fromSyncCode: string, toSyncCode: string, expedition: Expedition) => {
  try {
    const { error } = await supabase.from('moto_inbox').insert({
      from_code: fromSyncCode,
      to_code: toSyncCode,
      expedition_data: expedition,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error sending trip:", error);
    return false;
  }
};

export const fetchInbox = async (syncCode: string) => {
  try {
    const { data, error } = await supabase
      .from('moto_inbox')
      .select('*')
      .eq('to_code', syncCode)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching inbox:", error);
    return [];
  }
};

export const deleteInboxMessage = async (id: string) => {
  try {
    const { error } = await supabase.from('moto_inbox').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting inbox message:", error);
    return false;
  }
};

export const sendWave = async (fromSyncCode: string, toSyncCode: string, fromNickname: string) => {
  try {
    const { error } = await supabase.from('moto_inbox').insert({
      from_code: fromSyncCode,
      to_code: toSyncCode,
      type: 'wave',
      message: `${fromNickname} ti mává! ✌️`,
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error sending wave:", error);
    return false;
  }
};

export const createRideChallenge = async (challenge: any) => {
  try {
    const { error } = await supabase.from('moto_shared_trips').insert({
      slug: `challenge-${challenge.id}`,
      expedition_data: challenge,
      created_by: challenge.creatorSyncCode
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error creating challenge:", error);
    return false;
  }
};

export const fetchRideChallenges = async () => {
  try {
    const { data, error } = await supabase
      .from('moto_shared_trips')
      .select('expedition_data')
      .like('slug', 'challenge-%');
    if (error) throw error;
    
    const challenges = data.map(d => d.expedition_data) || [];
    return challenges.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return [];
  }
};

export const subscribeToNewChallenges = (callback: (challenge: any) => void) => {
  const channel = supabase
    .channel('public:moto_shared_trips')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'moto_shared_trips', filter: "slug=like.challenge-%" },
      (payload) => {
        callback(payload.new.expedition_data);
      }
    )
    .subscribe();

  return channel;
};

export const joinRideChallenge = async (challengeId: string, participants: string[]) => {
  try {
    const { data, error: fetchError } = await supabase
      .from('moto_shared_trips')
      .select('expedition_data')
      .eq('slug', `challenge-${challengeId}`)
      .single();
      
    if (fetchError) throw fetchError;
    
    const updatedChallenge = {
      ...data.expedition_data,
      participants
    };

    const { error } = await supabase
      .from('moto_shared_trips')
      .update({ expedition_data: updatedChallenge })
      .eq('slug', `challenge-${challengeId}`);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error joining challenge:", error);
    return false;
  }
};

export const deleteRideChallenge = async (challengeId: string) => {
  try {
    const { error } = await supabase
      .from('moto_shared_trips')
      .delete()
      .eq('slug', `challenge-${challengeId}`);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting challenge:", error);
    return false;
  }
};

export const wipeDatabase = async () => {
  try {
    await supabase.from('moto_sync_profiles').delete().neq('sync_code', 'dummy');
    await supabase.from('moto_garage').delete().neq('sync_code', 'dummy');
    await supabase.from('moto_expeditions').delete().neq('sync_code', 'dummy');
    await supabase.from('moto_shared_trips').delete().neq('slug', 'dummy');
    await supabase.from('moto_inbox').delete().neq('id', 'dummy');
    return true;
  } catch (error) {
    console.error("Error wiping database:", error);
    return false;
  }
};
