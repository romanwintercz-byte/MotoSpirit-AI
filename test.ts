import { supabase } from './services/supabaseClient';
supabase.from('moto_challenges').select('*').limit(1).then(console.log).catch(console.error);
