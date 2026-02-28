
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

(Deno as any).serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload_data = await req.json()
    console.log('Incoming notification payload:', JSON.stringify(payload_data))

    const denoAny = Deno as any;
    const vapid_pub = denoAny.env.get('CAROM_VAPID_PUBLIC_KEY');
    const vapid_priv = denoAny.env.get('CAROM_VAPID_PRIVATE_KEY');

    if (!vapid_pub || !vapid_priv) {
      return new Response(JSON.stringify({ error: 'Missing VAPID keys' }), { status: 500, headers: corsHeaders })
    }

    webpush.setVapidDetails(
      denoAny.env.get('CAROM_VAPID_SUBJECT') || 'mailto:roman.winter.cz@gmail.com',
      vapid_pub,
      vapid_priv
    )

    const supabase = createClient(
      denoAny.env.get('SUPABASE_URL')!,
      denoAny.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. TEST LOGIC
    if (payload_data.type === 'test') {
      const notificationPayload = JSON.stringify({
        title: payload_data.title || 'Test Win3 Carom Pro',
        body: payload_data.body || 'Notifikace fungují!',
        url: '/'
      });
      
      const { data: subs } = await supabase.from('push_subscriptions').select('subscription').eq('user_id', payload_data.user_id)
      if (!subs || subs.length === 0) return new Response(JSON.stringify({ sent: 0, error: 'No subs' }), { headers: corsHeaders })

      const results = await Promise.allSettled(subs.map((s: any) => webpush.sendNotification(s.subscription, notificationPayload)))
      return new Response(JSON.stringify({ sent: results.filter(r => r.status === 'fulfilled').length }), { headers: corsHeaders })
    }

    // 2. DATABASE WEBHOOK LOGIC (Match Requests)
    const { type, record, old_record } = payload_data;
    if (!record) return new Response('No record', { status: 400, headers: corsHeaders })

    let title = '';
    let body = '';
    let target_users_query = supabase.from('push_subscriptions').select('subscription');

    if (type === 'INSERT') {
      // Nová výzva: Informujeme celou komunitu kromě tvůrce
      title = 'Nová výzva ke hře! 🎱';
      body = `Někdo vypsal nový zápas v herně ${record.community_id}. Přijmi výzvu!`;
      target_users_query = target_users_query
        .eq('community_id', record.community_id)
        .neq('user_id', record.created_by);
    } 
    else if (type === 'UPDATE' && old_record) {
      // Výzva přijata: Informujeme pouze tvůrce výzvy
      const justAccepted = !old_record.accepted_by_player_id && record.accepted_by_player_id;
      
      if (justAccepted) {
        title = 'Zápas potvrzen! ✅';
        body = `Tvůj zápas v herně ${record.community_id} byl právě přijat. Jdi ke stolu!`;
        target_users_query = target_users_query.eq('user_id', record.created_by);
      } else {
        return new Response('Update not relevant', { status: 200, headers: corsHeaders });
      }
    } else {
      return new Response('Event type not supported', { status: 200, headers: corsHeaders });
    }

    const { data: targetSubs, error: subError } = await target_users_query;
    if (subError) throw subError;

    if (!targetSubs || targetSubs.length === 0) {
      console.log('No subscribers found for this event.');
      return new Response(JSON.stringify({ sent: 0, message: 'No recipients' }), { headers: corsHeaders });
    }

    const notificationPayload = JSON.stringify({ title, body, url: '/?view=lobby' });
    const results = await Promise.allSettled(targetSubs.map((s: any) => webpush.sendNotification(s.subscription, notificationPayload)));
    
    console.log(`Successfully sent ${results.filter(r => r.status === 'fulfilled').length} notifications.`);
    return new Response(JSON.stringify({ sent: results.length }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error('Edge Function Error:', (err as any).message)
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500, headers: corsHeaders })
  }
})
