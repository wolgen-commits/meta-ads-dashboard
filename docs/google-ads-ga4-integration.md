![alt text](image.png)# Integrasi Google Ads + Google Analytics 4 (GA4)

Dokumen ini menjelaskan langkah-langkah lengkap untuk menambahkan dashboard Google Ads dan performa website magentaindopack.com ke dalam sistem yang sudah ada.

---

## Gambaran Umum Arsitektur

```
Google Ads API  ─┐
                  ├─→ Supabase Edge Functions → Postgres tables → Views → Next.js tab baru
GA4 Data API   ─┘
```

**Tabel baru:** `google_campaigns`, `google_ad_performance`, `ga4_website_daily`
**View baru:** `v_google_adperf_daily`, `v_ga4_traffic_summary`
**Edge Functions baru:** `fetch-google-ads`, `fetch-ga4`
**Frontend baru:** `GoogleAdsTab.tsx`, `useGoogleData.ts`

---

## Fase 1: Persiapan Google Cloud (Lakukan Sebelum Coding)

### A. Buat Google Cloud Project
1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Klik dropdown project di atas → **New Project**
3. Nama: `magenta-dashboard` → Create
4. Catat **Project ID**

> **Gunakan akun Google yang sama** dengan yang mengelola Google Ads Magenta Indopack,
> agar saat generate Refresh Token tidak perlu setup izin tambahan.

---

### B. Setup Google Ads API

**Step 1 — Aktifkan Google Ads API:**
1. Di Google Cloud Console → **APIs & Services > Library**
2. Cari "Google Ads API" → klik → **Enable**

**Step 2 — Dapatkan Developer Token:**
1. Buka [ads.google.com](https://ads.google.com) → login dengan akun MCC/Manager
2. Tools & Settings (ikon kunci inggris) → **API Center**
3. Catat **Developer Token** (status awal: Test Account)
4. Klik **Apply for Basic Access** agar bisa akses data nyata (proses 1–2 hari kerja)

**Step 3 — Catat Customer ID:**
- Lihat angka di pojok kanan atas Google Ads (format: `123-456-7890`)
- Simpan **tanpa tanda pisah**: `1234567890`

**Step 4 — Buat OAuth2 Credentials:**
1. Google Cloud Console → **APIs & Services > Credentials**
2. **Create Credentials > OAuth client ID**
3. Application type: **Web application** (atau Desktop app)
4. Redirect URI (untuk Web): tambahkan `https://developers.google.com/oauthplayground`
5. Klik Create → catat **Client ID** dan **Client Secret**

**Step 5 — Generate Refresh Token:**
1. Buka [OAuth2 Playground](https://developers.google.com/oauthplayground)
2. Klik ikon gear (⚙️) di kanan atas → centang **Use your own OAuth credentials**
3. Masukkan Client ID dan Client Secret tadi
4. Di kolom kiri, cari dan pilih scope: `https://www.googleapis.com/auth/adwords`
5. Klik **Authorize APIs** → login dengan akun Google Ads
6. Klik **Exchange authorization code for tokens**
7. Catat **Refresh Token** (tidak kedaluwarsa selama tidak dicabut)

---

### C. Setup Google Analytics 4

**Step 1 — Aktifkan GA4 Data API:**
1. Google Cloud Console → **APIs & Services > Library**
2. Cari "Google Analytics Data API" → **Enable**

**Step 2 — Buat Service Account:**
1. Google Cloud Console → **IAM & Admin > Service Accounts**
2. **Create Service Account** → nama: `ga4-dashboard-reader`
3. Klik service account yang baru dibuat → tab **Keys**
4. **Add Key > Create new key > JSON** → download file
5. Buka file JSON, catat dua nilai ini:
   - `client_email` — contoh: `ga4-dashboard-reader@magenta-dashboard.iam.gserviceaccount.com`
   - `private_key` — string panjang mulai dari `-----BEGIN PRIVATE KEY-----`

**Step 3 — Tambahkan Service Account ke GA4:**
1. Buka [analytics.google.com](https://analytics.google.com) → login
2. **Admin** (ikon gear) → **Property Access Management**
3. Klik **+** → **Add users**
4. Masukkan email service account → Role: **Viewer** → Add

**Step 4 — Catat GA4 Property ID:**
1. Di GA4 Admin → **Property Settings**
2. Catat **Property ID** (angka saja, contoh: `123456789`)

---

## Fase 2: Database — Jalankan SQL di Supabase

Buka **Supabase Dashboard > SQL Editor** dan jalankan SQL berikut:

```sql
-- ============================================================
-- TABEL 1: google_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS google_campaigns (
  id                        TEXT PRIMARY KEY,
  customer_id               TEXT NOT NULL,
  name                      TEXT NOT NULL,
  status                    TEXT,
  advertising_channel_type  TEXT,
  synced_at                 TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE google_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_campaigns"
  ON google_campaigns FOR SELECT TO anon USING (true);

-- ============================================================
-- TABEL 2: google_ad_performance
-- cost_micros = IDR × 1.000.000 (JANGAN bagi 100, mata uang IDR tidak punya sub-unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS google_ad_performance (
  id                    TEXT PRIMARY KEY,
  campaign_id           TEXT NOT NULL REFERENCES google_campaigns(id),
  customer_id           TEXT NOT NULL,
  date                  DATE NOT NULL,
  impressions           BIGINT DEFAULT 0,
  clicks                BIGINT DEFAULT 0,
  cost_micros           BIGINT DEFAULT 0,
  conversions           NUMERIC(10,2) DEFAULT 0,
  conversions_value     NUMERIC(15,2) DEFAULT 0,
  ctr                   NUMERIC(8,6) DEFAULT 0,
  average_cpc           BIGINT DEFAULT 0,
  cost_per_conversion   NUMERIC(15,2) DEFAULT 0,
  synced_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (campaign_id, date)
);
ALTER TABLE google_ad_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_google_ad_performance"
  ON google_ad_performance FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_google_adperf_date ON google_ad_performance (date);
CREATE INDEX IF NOT EXISTS idx_google_adperf_campaign ON google_ad_performance (campaign_id, date);

-- ============================================================
-- TABEL 3: ga4_website_daily
-- 1 baris = 1 hari × source × medium
-- ============================================================
CREATE TABLE IF NOT EXISTS ga4_website_daily (
  id                    TEXT PRIMARY KEY,
  property_id           TEXT NOT NULL,
  date                  DATE NOT NULL,
  source                TEXT NOT NULL DEFAULT '(direct)',
  medium                TEXT NOT NULL DEFAULT '(none)',
  sessions              INTEGER DEFAULT 0,
  users                 INTEGER DEFAULT 0,
  new_users             INTEGER DEFAULT 0,
  bounce_rate           NUMERIC(8,6) DEFAULT 0,
  engagement_rate       NUMERIC(8,6) DEFAULT 0,
  avg_session_duration  NUMERIC(10,2) DEFAULT 0,
  conversions           INTEGER DEFAULT 0,
  synced_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (date, source, medium)
);
ALTER TABLE ga4_website_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_ga4_website_daily"
  ON ga4_website_daily FOR SELECT TO anon USING (true);
CREATE INDEX IF NOT EXISTS idx_ga4_date ON ga4_website_daily (date);
CREATE INDEX IF NOT EXISTS idx_ga4_source_medium ON ga4_website_daily (source, medium, date);

-- ============================================================
-- VIEW 1: v_google_adperf_daily
-- Biaya sudah dikonversi ke IDR (dibagi 1.000.000)
-- ============================================================
CREATE OR REPLACE VIEW v_google_adperf_daily AS
SELECT
  p.campaign_id,
  c.name                                          AS campaign_name,
  c.status                                        AS campaign_status,
  c.advertising_channel_type,
  p.date,
  p.impressions,
  p.clicks,
  ROUND(p.cost_micros::NUMERIC / 1000000, 0)     AS cost_idr,
  p.conversions,
  p.conversions_value,
  ROUND(p.ctr * 100, 4)                           AS ctr_pct,
  ROUND(p.average_cpc::NUMERIC / 1000000, 0)     AS avg_cpc_idr,
  ROUND(p.cost_per_conversion / 1000000, 0)      AS cost_per_conversion_idr
FROM google_ad_performance p
JOIN google_campaigns c ON c.id = p.campaign_id;

-- ============================================================
-- VIEW 2: v_ga4_traffic_summary
-- Klasifikasi channel + rate dalam %
-- ============================================================
CREATE OR REPLACE VIEW v_ga4_traffic_summary AS
SELECT
  date, source, medium,
  CASE
    WHEN medium IN ('cpc','ppc','paid')           THEN 'Paid Search'
    WHEN medium = 'organic'                        THEN 'Organic Search'
    WHEN medium IN ('social','social-media')       THEN 'Social Media'
    WHEN medium = 'referral'                       THEN 'Referral'
    WHEN medium = 'email'                          THEN 'Email'
    WHEN source = '(direct)' OR medium = '(none)' THEN 'Direct'
    ELSE 'Other'
  END                                              AS channel_group,
  sessions,
  users,
  new_users,
  ROUND(bounce_rate * 100, 2)                     AS bounce_rate_pct,
  ROUND(engagement_rate * 100, 2)                 AS engagement_rate_pct,
  ROUND(avg_session_duration, 0)                  AS avg_session_duration_sec,
  conversions
FROM ga4_website_daily;
```

---

## Fase 3: Secrets di Supabase

Buka **Supabase Dashboard > Settings > Edge Functions > Secrets** → tambahkan:

| Nama Secret | Nilai |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer Token dari Google Ads API Center |
| `GOOGLE_ADS_CUSTOMER_ID` | Customer ID tanpa tanda pisah, contoh `1234567890` |
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 Client ID dari Google Cloud |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 Client Secret dari Google Cloud |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh Token dari OAuth Playground |
| `GA4_PROPERTY_ID` | GA4 Property ID (angka saja) |
| `GA4_SERVICE_ACCOUNT_EMAIL` | Email service account dari JSON key |
| `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` | Seluruh isi `private_key` dari JSON key, termasuk `-----BEGIN PRIVATE KEY-----` |

---

## Fase 4: Test Edge Functions via curl

Setelah Edge Functions di-deploy, test dengan perintah ini (ganti `YOUR_PROJECT` dan `YOUR_SERVICE_ROLE_KEY`):

```bash
# Test fetch-google-ads
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fetch-google-ads \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date_start":"2026-06-01","date_stop":"2026-06-22"}'

# Test fetch-ga4
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/fetch-ga4 \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date_start":"2026-06-01","date_stop":"2026-06-22"}'
```

Response sukses:
```json
{ "ok": true, "campaigns": 5, "performance_rows": 150 }
{ "ok": true, "rows_upserted": 80 }
```

---

## Fase 5: Jadwal Sinkronisasi Otomatis (Opsional)

Tambahkan ke pg_cron di Supabase SQL Editor setelah data manual berhasil:

```sql
-- Sync Google Ads setiap hari jam 01:00 WIB (18:00 UTC)
SELECT cron.schedule(
  'fetch-google-ads-daily',
  '0 18 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/fetch-google-ads',
    headers := '{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- Sync GA4 setiap hari jam 01:30 WIB (18:30 UTC)
SELECT cron.schedule(
  'fetch-ga4-daily',
  '30 18 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/fetch-ga4',
    headers := '{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);
```

---

## Ringkasan File yang Dibuat/Diubah

| File | Status |
|---|---|
| `supabase/functions/fetch-google-ads/index.ts` | **Baru** |
| `supabase/functions/fetch-ga4/index.ts` | **Baru** |
| `src/hooks/useGoogleData.ts` | **Baru** |
| `src/components/GoogleAdsTab.tsx` | **Baru** |
| `src/types/database.ts` | **Diubah** — tambah interfaces baru |
| `src/app/page.tsx` | **Diubah** — tambah tab Google Ads |

---

## Catatan Penting

- **`cost_micros`**: Google Ads menyimpan biaya dalam micro-unit (IDR × 1.000.000). Jangan bagi 100 — IDR tidak punya sub-unit sen. View sudah menangani konversi ini.
- **GA4 date format**: API mengembalikan tanggal sebagai `YYYYMMDD` (tanpa strip). Edge Function mengonversinya ke `YYYY-MM-DD` sebelum upsert.
- **Service Account private key**: Supabase menyimpan newline sebagai literal `\n` dalam secret. Edge Function menangani ini dengan `.replace(/\\n/g, "\n")`.
- **Google Ads Developer Token**: Status Test Account hanya bisa akses test account. Perlu apply Basic Access untuk data production — bisa 1–2 hari kerja.
