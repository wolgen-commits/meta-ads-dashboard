# Instagram Audience & Insights — Implementasi Data Baru

Dokumentasi perubahan yang ditambahkan untuk mengambil dan menampilkan 3 jenis data Instagram Insights di dashboard.

**Commit relevan:** `9ec80fd`, `1e05536`

---

## Latar Belakang

Dashboard sebelumnya hanya menampilkan data reach harian dan engagement per konten. Sesi ini menambahkan:

1. **Demografi Audience** — usia, gender, negara, kota dari follower akun
2. **Jam Aktif Followers** — kapan followers paling aktif online (terkendala API, lihat catatan)
3. **Reach: Follower vs Non-Follower** — jangkauan harian dari pengikut vs non-pengikut

Semua data diambil dari Meta Instagram Graph API v22.0 untuk akun **@magentaindopack** (`17841457712254566`).

---

## Database

### Tabel Baru

**`ig_audience_breakdown`** — snapshot lifetime demografi follower

```sql
CREATE TABLE ig_audience_breakdown (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_account_id TEXT NOT NULL,
  breakdown_type TEXT NOT NULL,   -- 'age', 'gender', 'country', 'city'
  breakdown_value TEXT NOT NULL,  -- '18-24', 'M', 'ID', 'Jakarta'
  follower_count INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ig_account_id, breakdown_type, breakdown_value)
);
ALTER TABLE ig_audience_breakdown ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon select" ON ig_audience_breakdown FOR SELECT TO anon USING (true);
```

**`ig_online_followers`** — data jam aktif followers per hari

```sql
CREATE TABLE ig_online_followers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL,  -- 0-23
  follower_count INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ig_account_id, date, hour)
);
ALTER TABLE ig_online_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon select" ON ig_online_followers FOR SELECT TO anon USING (true);
```

### Kolom Baru di `ig_account_insights`

```sql
ALTER TABLE ig_account_insights
  ADD COLUMN IF NOT EXISTS reach_followers INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reach_non_followers INTEGER DEFAULT 0;
```

---

## Edge Function — `fetch-instagram`

Tiga fungsi baru ditambahkan dan dipanggil setiap jam (setelah sync media selesai):

### 1. `syncAudienceDemographics(igAccountId)`

Mengambil demografi follower dengan metric `follower_demographics` (v22.0).

```
GET /{ig-user-id}/insights
  ?metric=follower_demographics
  &breakdown=age|gender|country|city
  &period=lifetime
  &metric_type=total_value
```

**Format respons v22.0:**
```json
{
  "data": [{
    "total_value": {
      "breakdowns": [{
        "dimension_keys": ["age"],
        "results": [
          {"dimension_values": ["18-24"], "value": 4392},
          {"dimension_values": ["25-34"], "value": 2447}
        ]
      }]
    }
  }]
}
```

**Catatan penting:** Nama metric lama (`audience_age`, `audience_gender`, `audience_country`, `audience_city`) sudah tidak valid di v22.0. Harus menggunakan `follower_demographics` dengan parameter `breakdown` dan `metric_type=total_value`.

### 2. `syncOnlineFollowers(igAccountId)`

Mencoba mengambil data jam aktif followers. Dipanggil tapi kemungkinan tidak menghasilkan data (lihat catatan kendala).

### 3. `syncReachByFollowType(igAccountId)`

Mengambil reach harian dengan breakdown `FOLLOWER` vs `NON_FOLLOWER`.

```
GET /{ig-user-id}/insights
  ?metric=reach
  &breakdown=follow_type
  &period=day
  &since={timestamp}&until={timestamp}
```

Hasilnya di-update ke kolom `reach_followers` dan `reach_non_followers` di `ig_account_insights`.

---

## Hooks — `useMetaData.ts`

### Tipe Baru

```typescript
export type IgAudienceBreakdown = {
  breakdown_type: string;
  breakdown_value: string;
  follower_count: number;
};

export type IgOnlineFollowerHour = {
  hour: number;
  avg_followers: number;
};
```

### `IgInsightTrend` — Field Baru

```typescript
export type IgInsightTrend = {
  date: string;
  followers_count: number;
  reach: number;
  reach_followers: number;       // ← baru
  reach_non_followers: number;   // ← baru
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
};
```

### Hook Baru: `useIgAudienceDemographics(accountId)`

Query `ig_audience_breakdown`, kembalikan data dikelompokkan per tipe:

```typescript
const { byAge, byGender, byCountry, byCity, hasData, isLoading } =
  useIgAudienceDemographics(currentId);
```

### Hook Baru: `useIgOnlineFollowers(accountId)`

Query `ig_online_followers`, kembalikan rata-rata per jam dari 7 hari terakhir:

```typescript
const { data: onlineFollowers, isLoading } = useIgOnlineFollowers(currentId);
// → [{ hour: 0, avg_followers: 12 }, { hour: 1, avg_followers: 8 }, ...]
```

---

## UI — `InstagramTab.tsx`

### Section Baru: Demografi Audience

Grid 2 kolom, di bawah analytics grid yang sudah ada. Menampilkan 4 chart:

| Chart | Tipe | Warna |
|-------|------|-------|
| Usia (breakdown age) | BarChart horizontal | Magenta |
| Gender (M/F/U) | BarChart vertikal dengan Cell warna | Magenta/Biru/Abu |
| Negara Top 10 | BarChart horizontal | Biru |
| Kota Top 10 | BarChart horizontal | Hijau |

Data ini bersifat **lifetime** (tidak dipengaruhi filter tanggal).

### Section Baru: Jam Aktif Followers

AreaChart 0–23 jam, rata-rata dari 7 hari terakhir. Tampilkan "Belum tersedia" jika tabel kosong.

### Update Chart: Reach Follower vs Non-Follower

Chart sebelumnya menggunakan data proxy (organic ≈ follower, paid ≈ iklan) dari `ad_breakdown_platform`. Sekarang diganti ke data nyata dari `ig_account_insights.reach_followers` / `reach_non_followers`:

```typescript
// Sebelum (proxy dari ad_breakdown_platform):
dataKey="organic"  // ≈ reach dari non-iklan
dataKey="paid"     // = reach dari iklan Meta

// Sesudah (data real dari ig_account_insights):
dataKey="followers"     // = reach_followers (pengikut)
dataKey="nonFollowers"  // = reach_non_followers (non-pengikut)
```

Tampilkan pesan "Data akan tersedia setelah sync berikutnya" jika semua nilai 0.

---

## Data Aktual @magentaindopack (per 19 Juni 2026)

| Dimensi | Nilai Terbesar |
|---------|---------------|
| Negara follower | India 🇮🇳 (6.661) — lebih banyak dari Indonesia 🇮🇩 (1.219) |
| Kelompok usia | 18–24 tahun (4.392) |
| Gender | Unknown/U (5.609), Laki-laki (2.946), Perempuan (1.072) |
| Kota | Delhi (138), Jakarta (99) |

---

## Kendala API v22.0

### Metric yang Sudah Tidak Valid
| Metric Lama | Pengganti v22.0 | Catatan |
|-------------|-----------------|---------|
| `audience_age` | `follower_demographics&breakdown=age` | Wajib tambah `metric_type=total_value` |
| `audience_gender` | `follower_demographics&breakdown=gender` | Sama |
| `audience_country` | `follower_demographics&breakdown=country` | Sama |
| `audience_city` | `follower_demographics&breakdown=city` | Sama |
| `reach_logged_in_followers` | `reach&breakdown=follow_type` | Nama metric tidak valid |

### `online_followers` — Belum Bisa Diambil

Metric `online_followers` di v22.0 mengalami ketidakcocokan parameter:
- `period=day` → error: period incompatible
- `period=lifetime&metric_type=total_value` → error: metric incompatible with total_value
- `period=lifetime` tanpa metric_type → tidak menghasilkan data

Kemungkinan penyebab: endpoint ini memerlukan izin tambahan atau sudah berubah di v22.0. Section "Jam Aktif Followers" di dashboard akan menampilkan "Belum tersedia" sampai solusi ditemukan.

---

## Cara Sync Manual

```bash
curl -X POST https://visicwecchgxonxnwmwd.supabase.co/functions/v1/fetch-instagram \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

Data demografi diperbarui setiap kali function dijalankan (tiap jam via pg_cron pukul :30).
