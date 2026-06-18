// supabase/functions/ad-library-search/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const META_TOKEN = Deno.env.get("META_ACCESS_TOKEN")!;
const META_API   = "https://graph.facebook.com/v22.0/ads_archive";

const AD_FIELDS = [
  "id",
  "ad_creation_time",
  "ad_creative_bodies",
  "ad_creative_link_captions",
  "ad_creative_link_titles",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "currency",
  "funding_entity",
  "impressions",
  "page_id",
  "page_name",
  "publisher_platforms",
  "spend",
].join(",");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const url    = new URL(req.url);
    const q         = url.searchParams.get("q")?.trim()         ?? "";
    const page_name = url.searchParams.get("page_name")?.trim() ?? "";
    const country   = url.searchParams.get("country")           ?? "ID";
    const ad_type   = url.searchParams.get("ad_type")           ?? "ALL";
    const after     = url.searchParams.get("after")             ?? "";
    const platform  = url.searchParams.get("platform")          ?? "";

    if (!q && !page_name) {
      return new Response(
        JSON.stringify({ error: "Isi minimal salah satu: kata kunci (q) atau nama halaman (page_name)" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const metaUrl = new URL(META_API);
    metaUrl.searchParams.set("access_token", META_TOKEN);
    metaUrl.searchParams.set("ad_reached_countries", JSON.stringify([country]));
    metaUrl.searchParams.set("ad_type", ad_type);
    metaUrl.searchParams.set("fields", AD_FIELDS);
    metaUrl.searchParams.set("limit", "25");

    if (q)         metaUrl.searchParams.set("search_terms", q);
    if (page_name) metaUrl.searchParams.set("search_page_names", page_name);
    if (after)     metaUrl.searchParams.set("after", after);
    if (platform && platform !== "all") {
      metaUrl.searchParams.set("publisher_platforms", JSON.stringify([platform]));
    }

    const res = await fetch(metaUrl.toString());

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ad-library-search] Meta API error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: `Meta API mengembalikan error ${res.status}` }),
        { status: res.status, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[ad-library-search] exception:", err);
    return new Response(
      JSON.stringify({ error: "Gagal terhubung ke Meta API" }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
