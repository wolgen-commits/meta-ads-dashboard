# Fix: followers_count Tertimpa 0 oleh Sync Chunk Lama

Dokumentasi bug dan rencana perbaikan untuk data `followers_count` di tabel `ig_account_insights`.

---

## Masalah

Data jumlah pengikut harian disimpan ke Supabase dengan benar saat pertama kali di-sync. Namun, ketika tanggal yang sama kemudian di-sync ulang lewat chunk yang lebih lama, nilai `followers_count` yang valid tertimpa angka 0.

### Cara sync bekerja

`syncAccountInsights` di `supabase/functions/fetch-instagram/index.ts` mengambil data dalam 3 chunk:

| Chunk | Rentang | Metric yang di-fetch |
|-------|---------|---------------------|
| 0 | 0–28 hari lalu | `reach` + `follower_count` |
| 1 | 28–56 hari lalu | `reach` saja |
| 2 | 56–84 hari lalu | `reach` saja |

### Skenario bug

1. **Hari H**: Chunk 0 menyimpan tanggal "2026-05-22" → `followers_count = 1.234` ✅
2. **Hari H+29**: Tanggal "2026-05-22" sekarang masuk chunk 1. Chunk 1 hanya fetch `reach`, tidak ada `follower_count`. Baris 284 edge function:
   ```ts
   followers_count: vals.follower_count ?? 0,  // ← undefined ?? 0 = 0
   ```
3. Upsert menimpa baris lama → `followers_count = 0` ✗

### Dampak

- Chart "Pertumbuhan Pengikut" menampilkan 0 untuk tanggal > 28 hari lalu
- Data yang sudah tertimpa **tidak bisa dipulihkan** (Meta API hanya menyediakan `follower_count` untuk 30 hari terakhir)

---

## Keterbatasan Meta API Terkait

| Metric | Batas Waktu |
|--------|-------------|
| `follower_count` (harian) | **30 hari terakhir** saja |
| `reach` (harian) | ~84 hari (bisa di-chunk) |
| `follower_demographics` | Lifetime snapshot, tidak terpengaruh tanggal |
| `online_followers` | Tidak bisa diambil di v22.0 (incompatible period) |
| Story insights | Hanya 24 jam setelah tayang |

---

## Rencana Fix

### Step 1 — Buat Postgres Function di Supabase SQL Editor

```sql
CREATE OR REPLACE FUNCTION upsert_ig_account_insights(p_rows jsonb)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ig_account_insights (
    ig_account_id, date, impressions, reach,
    profile_views, website_clicks,
    followers_count, likes_count, comments_count,
    shares_count, saves_count, synced_at
  )
  SELECT
    r->>'ig_account_id',
    (r->>'date')::date,
    COALESCE((r->>'impressions')::int, 0),
    COALESCE((r->>'reach')::int, 0),
    COALESCE((r->>'profile_views')::int, 0),
    COALESCE((r->>'website_clicks')::int, 0),
    COALESCE((r->>'followers_count')::int, 0),
    COALESCE((r->>'likes_count')::int, 0),
    COALESCE((r->>'comments_count')::int, 0),
    COALESCE((r->>'shares_count')::int, 0),
    COALESCE((r->>'saves_count')::int, 0),
    now()
  FROM jsonb_array_elements(p_rows) r
  ON CONFLICT (ig_account_id, date) DO UPDATE SET
    reach           = EXCLUDED.reach,
    followers_count = CASE
                        WHEN EXCLUDED.followers_count > 0
                        THEN EXCLUDED.followers_count
                        ELSE ig_account_insights.followers_count
                      END,
    synced_at       = EXCLUDED.synced_at;
END;
$$;
```

**Logika kunci:** `CASE WHEN EXCLUDED.followers_count > 0 THEN ... ELSE ig_account_insights.followers_count END`
— nilai lama dipertahankan jika nilai baru adalah 0.

### Step 2 — Edit Edge Function

File: `supabase/functions/fetch-instagram/index.ts`, baris 295–298

Sebelum:
```ts
const { error } = await supabase
  .from("ig_account_insights")
  .upsert(rows, { onConflict: "ig_account_id,date" });
```

Sesudah:
```ts
const { error } = await supabase
  .rpc("upsert_ig_account_insights", { p_rows: rows });
```

Tidak ada perubahan lain. Struktur `rows` tetap sama persis.

---

## Risiko & Rollback

| Aspek | Detail |
|-------|--------|
| **Risiko** | Sangat rendah — tidak ada tabel/kolom/data yang diubah di Step 1 |
| **Urutan aman** | Jalankan Step 1 dulu, verifikasi, baru Step 2 |
| **Rollback Step 2** | Kembalikan ke `.upsert()` semula (satu baris) |
| **Rollback Step 1** | `DROP FUNCTION upsert_ig_account_insights;` |
| **Data yang sudah 0** | Tidak bisa dipulihkan — Meta sudah di luar 30 hari |

---

## Verifikasi Setelah Fix

1. Jalankan SQL → cek function muncul di **Supabase → Database → Functions**
2. Deploy edge function → invoke via curl
3. Cek tabel `ig_account_insights`: baris berumur >28 hari tidak berubah nilai `followers_count`-nya
4. Di dashboard: filter bulan lalu → chart Pertumbuhan Pengikut tidak flat 0
