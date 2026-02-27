import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.join('=').trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
  await supabase.from('moto_sync_profiles').delete().neq('sync_code', 'dummy');
  await supabase.from('moto_garage').delete().neq('sync_code', 'dummy');
  await supabase.from('moto_expeditions').delete().neq('sync_code', 'dummy');
  await supabase.from('moto_shared_trips').delete().neq('slug', 'dummy');
  await supabase.from('moto_inbox').delete().neq('id', 'dummy');
  console.log('Wiped');
}
wipe();
