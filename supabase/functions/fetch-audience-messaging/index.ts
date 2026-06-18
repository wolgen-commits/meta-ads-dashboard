// supabase/functions/fetch-audience-messaging/index.ts
// Mengambil data messaging_conversations per breakdown dari Meta API
// dan mengupdate kolom messaging_conversations di tabel audience_insights.
//
// Cara invoke:
//   curl -X POST https://visicwecchgxonxnwmwd.supabase.co/functions/v1/fetch-audience-messaging \
//     -H "Authorization: Bearer <service_role_key>" \
//     -H "Content-Type: application/json" \
//     -d '{"date_start":"2026-05-01","date_stop":"2026-06-18"}'

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_BASE = "https://graph.facebook.com/v22.0";
const META_TOKEN    = Deno.env.get("META_ACCESS_TOKEN")!;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ad accounts Magenta Indopack
const AD_ACCOUNTS = [
  "act_273164165039726",   // MAGENTA INDOPACK SEJAHTERA PT
  "act_1176736889879033",  // Kemasan Rotogravure
];

const BREAKDOWN_TYPES = [
  { type: "age,gender",         dimKeys: ["age", "gender"]           },
  { type: "region",             dimKeys: ["region"]                  },
  { type: "publisher_platform", dimKeys: ["publisher_platform"]      },
  { type: "impression_device",  dimKeys: ["impression_device"]       },
] as const;

function isoDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function extractMessagingConversations(actions: Array<{ action_type: string; value: string }> | undefined): number {
  if (!actions) return 0;
  const mc = actions.find(a =>
    a.action_type === "onsite_conversion.messaging_conversation_started_7d"
  );
  return mc ? parseInt(mc.value, 10) : 0;
}

Deno.serve(async (req: Request) => {
  let body: { date_start?: string; date_stop?: string } = {};
  try { body = await req.json(); } catch { /* pakai default */ }

  const dateStart = body.date_start ?? isoDate(-30);
  const dateStop  = body.date_stop  ?? isoDate(0);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let totalUpdated = 0;
  const errors: string[] = [];
  const log: string[] = [];

  for (const accountId of AD_ACCOUNTS) {
    for (const breakdown of BREAKDOWN_TYPES) {
      try {
        const url = new URL(`${META_API_BASE}/${accountId}/insights`);
        url.searchParams.set("fields", "campaign_id,date_start,date_stop,impressions,reach,clicks,spend,ctr,actions");
        url.searchParams.set("breakdowns", breakdown.type);
        url.searchParams.set("time_range", JSON.stringify({ since: dateStart, until: dateStop }));
        url.searchParams.set("time_increment", "1");
        url.searchParams.set("level", "campaign");
        url.searchParams.set("limit", "500");
        url.searchParams.set("access_token", META_TOKEN);

        let cursor: string | null = url.toString();
        let pageUpdated = 0;

        while (cursor) {
          const res = await fetch(cursor);
          const json = await res.json();
          if (json.error) throw new Error(`Meta API: ${json.error.message}`);

          type MetaRow = {
            campaign_id: string;
            date_start: string;
            actions?: Array<{ action_type: string; value: string }>;
            age?: string; gender?: string;
            region?: string;
            publisher_platform?: string;
            impression_device?: string;
          };

          for (const row of ((json.data || []) as MetaRow[])) {
            const mcVal = extractMessagingConversations(row.actions);
            const now   = new Date().toISOString();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let q: any = supabase
              .from("audience_insights")
              .update({ messaging_conversations: mcVal, synced_at: now })
              .eq("campaign_id", row.campaign_id)
              .eq("date_start", row.date_start)
              .eq("breakdown_type", breakdown.type);

            // Filter sesuai dimensi breakdown agar UPDATE tepat sasaran
            if (breakdown.type === "age,gender") {
              q = row.age    ? q.eq("age", row.age)       : q.is("age", null);
              q = row.gender ? q.eq("gender", row.gender) : q.is("gender", null);
            } else if (breakdown.type === "region") {
              q = row.region ? q.eq("region", row.region) : q.is("region", null);
            } else if (breakdown.type === "publisher_platform") {
              q = row.publisher_platform
                ? q.eq("publisher_platform", row.publisher_platform)
                : q.is("publisher_platform", null);
            } else if (breakdown.type === "impression_device") {
              q = row.impression_device
                ? q.eq("impression_device", row.impression_device)
                : q.is("impression_device", null);
            }

            const { error: updErr } = await q;
            if (updErr) throw updErr;
            pageUpdated++;
          }

          totalUpdated += pageUpdated;
          cursor = json.paging?.next ?? null;
          pageUpdated = 0;
        }

        log.push(`✓ ${accountId} / ${breakdown.type}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${accountId}/${breakdown.type}: ${msg}`);
        log.push(`✗ ${accountId} / ${breakdown.type}: ${msg}`);
      }
    }
  }

  return new Response(
    JSON.stringify({ success: errors.length === 0, totalUpdated, dateStart, dateStop, log, errors }),
    { headers: { "Content-Type": "application/json" } },
  );
});
