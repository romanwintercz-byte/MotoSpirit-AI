import { supabase } from './services/supabaseClient.ts';

async function wipe() {
  await supabase.from('moto_sync_profiles').delete().neq('sync_code', 'dummy');
  await supabase.from('moto_garage').delete().neq('sync_code', 'dummy');
  await supabase.from('moto_expeditions').delete().neq('sync_code', 'dummy');
  await supabase.from('moto_shared_trips').delete().neq('slug', 'dummy');
  await supabase.from('moto_inbox').delete().neq('id', 'dummy');
  console.log('Wiped');
}
wipe();
