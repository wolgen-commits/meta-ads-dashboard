# CLAUDE.md — Meta Ads & Instagram Analytics Dashboard

Dokumentasi project integrasi data Meta Ads + Instagram ke Supabase dengan dashboard Next.js.
Dibuat untuk **PT Magenta Indopack Sejahtera**.

---

## 1. Gambaran Umum

Sistem mengambil data dari Meta Graph API (iklan Facebook/Instagram + engagement Instagram organik) → disimpan ke Supabase (Postgres) → divisualisasikan di dashboard Next.js. Sinkronisasi berjalan otomatis tiap jam via pg_cron + Edge Functions.

**Arsitektur:**
```
Meta Graph API → Supabase Edge Functions (Deno/TS) → Postgres tables → Views → Next.js dashboard (Vercel)
                          ↑
                   pg_cron (hourly)
```

---

## 2. Identifier Penting

| Item | Nilai |
|------|-------|
| Supabase project ref | `visicwecchgxonxnwmwd` |
| Supabase URL | `https://visicwecchgxonxnwmwd.supabase.co` |
| Meta App ID | `1557742705720763` (nama: "Business") |
| Token | System User "Digitalisasi" (permanent, di secret `META_ACCESS_TOKEN`) |
| Meta API version | `v22.0` |
| Local project | `D:\meta-ads-dashboard` |

### Portfolio & Akun
| Portfolio | Business ID | Catatan |
|-----------|-------------|---------|
| Magenta Indopack Sejahtera | `924702955331274` | Utama, data lengkap |
| Putrama Packaging | `561995191381892` | Schema terpisah (_putrama) |
| Semenit Jualan | — | Belum diaktifkan |

### Ad Accounts
| Account ID | Nama | Portfolio |
|-----------|------|-----------|
| `act_273164165039726` | MAGENTA INDOPACK SEJAHTERA PT | Magenta |
| `act_1176736889879033` | Kemasan Rotogravure | Magenta |
| `act_945056839291976` | Putrama Packaging | Putrama (satu-satunya yang ada campaign: 38) |
| `act_280674244430186` | Cetak Kemasan Rotogravure | Putrama (kosong) |
| `act_246961581368835` | Cetak Kemasan Custom | Putrama (kosong) |
| `act_279492587793168` | Kemasan Rotogravure | Putrama (kosong) |
| `act_1000890034428855` | Kemasan Custom Flexible Packaging | Putrama (kosong) |

### Instagram Accounts
| IG ID | Username | Status |
|-------|----------|--------|
| `17841457712254566` | @magentaindopack | Data lengkap (media + insights) |
| `17841402922059062` | @putramapackaging | Hanya info akun — menunggu App Review Meta untuk akses /media |

---

## 3. Skema Database

### Tabel Magenta (utama)
- `meta_ad_accounts`, `meta_campaigns`, `meta_adsets`, `meta_ads`
- `ad_performance` — **direbuild** jadi lengkap: per-iklan per-hari, puluhan metrik (results, reach, frequency, impressions, clicks, link_clicks, cpc, ctr, spend, cpm, cost_per_result, roas, page_engagement, post_reactions, post_saves, post_shares, messaging, dll). UNIQUE (ad_id, date_start)
- `ad_breakdown_demographic` — breakdown usia+gender. UNIQUE (ad_id, date_start, age, gender)
- `ad_breakdown_geo` — breakdown negara+region. UNIQUE (ad_id, date_start, country, region)
- `ad_breakdown_platform` — breakdown publisher_platform+position+device. UNIQUE (ad_id, date_start, publisher_platform, platform_position, impression_device)
- `engagement_metrics`, `audience_insights`, `meta_sync_log`

### Tabel Instagram
- `ig_accounts`, `ig_media`, `ig_media_insights`, `ig_account_insights`

### Tabel Putrama (terpisah, suffix _putrama)
- `meta_ad_accounts_putrama`, `meta_campaigns_putrama`, `meta_adsets_putrama`, `meta_ads_putrama`
- `ad_performance_putrama`, `engagement_metrics_putrama`, `audience_insights_putrama`, `meta_sync_log_putrama`

### Views
- `v_campaign_daily_summary`, `v_campaign_engagement_daily`, `v_audience_top_segments`
- `v_adperf_daily` — ringkasan harian dari ad_performance baru

### Catatan RLS
- `service_role`: full access semua tabel
- `anon`: SELECT only (untuk dashboard frontend)

---

## 4. Edge Functions

| Function | Fungsi | Jadwal cron |
|----------|--------|-------------|
| `fetch-meta-ads` | Sync campaigns/adsets/ads + performance + engagement + audience (Magenta) | `0 * * * *` (menit 0) |
| `fetch-instagram` | Sync IG media + insights (Magenta & Putrama) | `30 * * * *` (menit 30) |
| `fetch-meta-putrama` | Sync 5 ad account Putrama ke tabel _putrama | `15 * * * *` (menit 15) |
| `fetch-ad-performance` | Rebuild ad_performance lengkap + 3 breakdown (Magenta) | manual / dapat dijadwalkan |
| `fetch-meta-historical` | Backfill historis per bulan | manual |

### Parameter fetch-ad-performance
- Normal: `{"date_start":"2026-05-01","date_stop":"2026-05-31"}`
- Sebagian: tambah `"only":"main"|"demo"|"geo"|"platform"`
- Auto backfill bertahap: `{"auto_backfill":true,"start_index":0,"num_months":3}` → ikuti `next_start_index` sampai `null`. Turunkan `num_months` ke 1 kalau kena `WORKER_RESOURCE_LIMIT`.

---

## 5. Catatan & Kendala Penting

### Ketersediaan data Meta
- Meta hanya menyimpan **data insights ~37 bulan** ke belakang. Meski campaign dibuat 2022-2023, data performa Magenta hanya tersedia mulai **Feb 2025**, dan Putrama hanya **27 Mei - 9 Jun 2023** (satu-satunya periode campaign aktif yang tersisa).
- Struktur campaign (nama, status, tanggal) disimpan permanen, tapi angka performa bisa hilang.

### Bug yang sudah diperbaiki
- **daily_budget salah bagi 100**: untuk IDR tidak boleh dibagi 100 (IDR tak punya sub-unit). Sudah di-fix di DB via `UPDATE ... SET daily_budget = daily_budget * 100`. Pastikan Edge Function tidak membagi 100 untuk IDR.
- **ROAS 0.00x**: wajar karena campaign bertipe Leads/Engagement, bukan Sales — tidak ada purchase_value. Dashboard ganti ROAS jadi Cost per Lead.
- **Duplikat ad_performance**: diselesaikan dengan UNIQUE constraint + upsert onConflict.
- **metric impressions deprecated** di IG insights v22.0 — dihapus dari request.
- **metric plays** hanya valid untuk REELS.

### Izin Instagram
- @putramapackaging endpoint /media error `(#10) Application does not have permission`. Butuh Meta **Business Verification** → **App Review** untuk izin `instagram_basic` + `instagram_manage_insights`. Status: verifikasi bisnis sedang diproses.

### Error 500 "Cannot read properties of undefined (reading 'error')"
- Terjadi di tombol Test/Invoke Supabase Dashboard karena token API legacy. **Function-nya sendiri normal** — jalankan via curl dengan service_role key terbaru dari Project Settings → API.

### Edge Function resource limit (free tier)
- Memproses terlalu banyak bulan/data sekaligus → `WORKER_RESOURCE_LIMIT`. Pecah jadi batch kecil (1-3 bulan per invoke).

---

## 6. Dashboard Next.js

**Stack:** Next.js 14.2.5 + TypeScript + App Router + @supabase/supabase-js + recharts + swr

**Struktur src/:**
- `types/database.ts` — TS interfaces
- `lib/supabase.ts` — client + createServerClient()
- `hooks/useMetaData.ts` — semua data hooks (campaign summary, KPI totals, charts, audience, IG, dll)
- `components/` — KpiCard, SpendRoasChart, EngagementChart, AudienceTable, SyncStatus, InstagramTab, DatabaseTab
- `app/page.tsx` — 3 tab: Meta Ads / Instagram / Database
- `app/globals.css` — styling
- `app/layout.tsx`

**Fitur dashboard:**
- Tab Meta Ads: filter tanggal (datepicker + preset), filter objective (multi-select), filter campaign (multi-select, auto-filter by objective), KPI cards (klik untuk penjelasan), chart spend & engagement, tabel audience breakdown
- Tab Instagram: switcher akun, KPI engagement, grid post dengan thumbnail + stats
- Tab Database: browser raw data 15 tabel, search, pagination

### Design System — "Magenta ERP v1.0"
- **Light mode**, background `--gray-50` (#FAFAFA), surface putih
- Brand color **magenta** `#BB2649`
- Font: **DM Sans** (utama), DM Mono (angka), Fraunces (display)
- KPI cards dengan top border warna semantik (magenta/success/info)
- Tabel ERP style: header uppercase, hover row, border halus
- Warna chart: magenta #BB2649, info #2563EB, success #16A34A, warning #D97706

### Environment variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 7. Deployment (Vercel)

- Push ke GitHub → connect ke Vercel → set 3 env variables → deploy
- **Kendala Hobby Plan + private repo**: ubah repo jadi Public, atau gunakan akun GitHub yang sama dengan Vercel
- **Type error recharts Tooltip labelFormatter**: bungkus jadi `labelFormatter={(label) => fmt(String(label))}`

---

## 8. Status Terkini

✅ Selesai:
- Sync Magenta ads (campaigns/adsets/ads/performance/engagement/audience) otomatis tiap jam
- ad_performance direbuild lengkap + 3 tabel breakdown (demografi/geo/platform), backfill Feb 2025 - Jun 2026
- Sync Instagram @magentaindopack (media + insights) otomatis
- Sync Putrama ads ke schema terpisah
- Dashboard 3 tab dengan design Magenta ERP

⏳ Pending:
- Meta Business Verification → App Review (untuk IG Putrama /media)
- Deploy final ke Vercel
- Aktivasi portfolio Semenit Jualan
- Tampilan visual untuk breakdown demografi/geo/platform di dashboard

---

## 9. Konvensi untuk Asisten

- User non-teknis: berikan instruksi step-by-step, sebut lokasi menu/tombol spesifik, minta screenshot konfirmasi tiap langkah.
- Bahasa: Indonesia.
- Jalankan Edge Function via curl (bukan tombol Test/Invoke) untuk hindari error token legacy.
- Selalu gunaan UNIQUE constraint + upsert onConflict untuk cegah duplikat.
- Untuk IDR: JANGAN bagi 100 pada budget/spend.
- Pisahkan request insights per breakdown (Meta tak bisa gabung banyak breakdown dalam 1 request).
- Batasi rentang/volume per invoke agar tak kena WORKER_RESOURCE_LIMIT.