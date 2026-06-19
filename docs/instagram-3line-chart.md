# Dokumentasi: Grafik 3 Garis Instagram (Tayangan / Organik / Dari Iklan)

**Status: SELESAI**
**Tanggal mulai:** 2026-06-18 | **Selesai:** 2026-06-18

---

## Tujuan

Menampilkan grafik di tab Instagram dashboard yang menyerupai Meta Business Suite:
- Garis 1 — **Tayangan** (total, warna biru #1877F2, solid)
- Garis 2 — **Dari organik** (warna hijau #00C6A7, dashed)
- Garis 3 — **Dari iklan** (warna kuning #F59E0B, dashed)

Disertai panel breakdown kanan yang menampilkan angka Total / Dari organik / Dari iklan untuk periode yang dipilih.

---

## Yang Sudah Selesai

### 1. Frontend — sudah selesai & TypeScript clean

**`src/types/database.ts`**
- Ditambah interface `IgAccountInsight` dengan kolom: `id`, `ig_account_id`, `date`, `followers_count`, `reach`, `impressions`, `profile_views`, `website_clicks`, `likes_count`, `comments_count`, `shares_count`, `saves_count`, `synced_at`

**`src/hooks/useMetaData.ts`**
- Ditambah hook `useIgDailyChart(accountId, dateStart, dateStop)`
- Sumber data: `ig_account_insights` (total impressions) + `ad_breakdown_platform` (paid dari instagram)
- Return: `IgDayData[] = { date, total, organic, paid }`
- Organic = total − paid

**`src/components/InstagramTab.tsx`**
- Import `useIgDailyChart` ditambahkan
- State `dailyChart` dari `useIgDailyChart` dipakai untuk grafik
- LineChart diupdate ke 3 garis: `total`, `organic`, `paid`
- Breakdown panel kanan menampilkan: Total / Dari organik / Dari iklan (sum seluruh periode)

### 2. Database — sudah ada

Tabel `ig_account_insights` sudah ada dengan kolom yang sesuai.
UNIQUE constraint sudah ditambahkan:
```sql
ALTER TABLE ig_account_insights
ADD CONSTRAINT ig_account_insights_account_date_unique
UNIQUE (ig_account_id, date);
```

### 3. Edge Function `fetch-instagram` — sudah diupdate & deploy

Fungsi `syncAccountInsights` sudah ditambahkan di dalam handler, dipanggil sebelum `return new Response(...)`:
```typescript
async function syncAccountInsights(igAccountId: string): Promise<void> {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 90 * 24 * 60 * 60;
  const data = await apiFetchPaginated<{
    name: string;
    values: Array<{ value: number; end_time: string }>;
  }>(`${igAccountId}/insights?metric=reach,profile_views&period=day&since=${since}&until=${until}`);
  // ... pivot & upsert ke ig_account_insights
}
await syncAccountInsights("17841457712254566"); // @magentaindopack
```

> **Catatan:** Metric saat ini hanya `reach,profile_views` karena `impressions` masih gagal.
> Setelah token baru dengan `instagram_manage_insights` aktif, ganti ke `impressions,reach,profile_views`.

---

## Yang Masih Pending

### Masalah Utama

Endpoint Meta API `/{ig-user-id}/insights` mengembalikan error `(#10) Application does not have permission` untuk System User "Digitalisasi" karena token belum punya scope `instagram_manage_insights`.

Akibatnya: tabel `ig_account_insights` tetap kosong → grafik 3 garis tidak menampilkan data.

---

## Langkah Manual yang Harus Dilakukan

### Langkah 1 — Meta Business Suite
URL: https://business.facebook.com → Business ID `924702955331274`

**Settings → Users → System Users → "Digitalisasi" → Edit**
- Tab: Instagram Accounts
- Pastikan @magentaindopack (ID: `17841457712254566`) sudah assign
- Centang permission: **Manage Insights** (`instagram_manage_insights`)
- Klik Save

### Langkah 2 — Generate Token Baru
System User "Digitalisasi" → **Generate New Token**
- App: **Business** (App ID `1557742705720763`)
- Scope yang harus dicentang:
  - `instagram_basic`
  - `instagram_manage_insights`
  - `pages_read_engagement`
  - `ads_read` (jika belum ada)
- Copy token hasil generate

### Langkah 3 — Update Supabase Secret
**Supabase Dashboard → Edge Functions → Secrets**
- Update nilai `META_ACCESS_TOKEN` dengan token baru

### Langkah 4 — Update metric di Edge Function
Setelah token baru aktif, update baris metric di `fetch-instagram`:
```typescript
// Ganti dari:
`${igAccountId}/insights?metric=reach,profile_views&period=day&since=${since}&until=${until}`

// Menjadi:
`${igAccountId}/insights?metric=impressions,reach,profile_views&period=day&since=${since}&until=${until}`
```
Lalu deploy ulang: `supabase functions deploy fetch-instagram --no-verify-jwt`

### Langkah 5 — Invoke & Verifikasi
Setelah deploy, beritahu asisten untuk invoke ulang Edge Function dan cek apakah `ig_account_insights` terisi.

---

## Cara Melanjutkan (untuk sesi berikutnya)

1. Pastikan semua langkah manual di atas sudah dilakukan
2. Buka sesi baru dan katakan: **"Lanjutkan setup grafik 3 garis Instagram sesuai docs/instagram-3line-chart.md"**
3. Asisten akan:
   - Invoke `fetch-instagram`
   - Verifikasi data di `ig_account_insights`
   - Update metric di Edge Function jika perlu
   - TypeScript check final
   - Commit & push

---

## File yang Terlibat

| File | Status |
|------|--------|
| `src/types/database.ts` | ✅ Selesai — ada `IgAccountInsight` |
| `src/hooks/useMetaData.ts` | ✅ Selesai — ada `useIgDailyChart` |
| `src/components/InstagramTab.tsx` | ✅ Selesai — grafik 3 garis siap |
| `supabase/functions/fetch-instagram/index.ts` | ✅ Deploy — perlu update metric setelah token baru |
| `ig_account_insights` (tabel DB) | ⏳ Kosong — menunggu token baru |
