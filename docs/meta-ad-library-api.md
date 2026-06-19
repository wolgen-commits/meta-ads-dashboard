# Meta Ad Library — Catatan Implementasi

## Ringkasan

Tab "Ad Library" di dashboard memungkinkan riset iklan kompetitor. Halaman ini mendokumentasikan pendekatan yang dicoba dan keputusan arsitektur akhir.

> **Kesimpulan penting:** Meta Ad Library API (`/ads_archive`) secara resmi **hanya mendukung iklan politik/sosial dan iklan yang tayang di UK/EU**. Untuk iklan komersial di Indonesia, Meta sendiri mengarahkan pengguna ke website Galeri Iklan. Pendekatan launcher (membuka website Meta Ad Library) adalah satu-satunya cara yang didukung resmi oleh Meta.

---

## Pendekatan 1: Meta Ad Library API (`/ads_archive`) — Gagal

### Yang dicoba

Memanggil endpoint resmi Meta Ad Library API:

```
GET https://graph.facebook.com/v22.0/ads_archive
  ?access_token=<META_ACCESS_TOKEN>
  &ad_reached_countries=["ID"]
  &ad_type=ALL
  &search_terms=kemasan
  &fields=id,page_name,ad_creative_bodies,...
```

Arsitektur yang dibangun:
- `supabase/functions/ad-library-search/index.ts` — Edge Function sebagai proxy (token aman di Supabase secrets)
- `src/hooks/useAdLibrary.ts` — SWR hook memanggil Edge Function
- `src/components/MetaAdLibraryTab.tsx` — UI pencarian dengan kartu hasil

### Error yang diterima

```json
{
  "error": {
    "message": "Application does not have permission for this action",
    "type": "OAuthException",
    "code": 10,
    "error_subcode": 2332002,
    "error_user_msg": "Untuk mengakses API, Anda harus mengikuti langkah-langkah di facebook.com/ads/library/api."
  }
}
```

### Penyebab (sudah dikonfirmasi)

Setelah dicoba dengan dua jenis token berbeda (System User Token dan User Access Token) dan investigasi langsung di `facebook.com/ads/library/api`, ditemukan bahwa:

**Meta Ad Library API hanya mencakup:**
- Iklan tentang masalah sosial, pemilu, atau politik (7 tahun ke belakang, global)
- Iklan jenis apapun yang dikirimkan ke **Inggris (UK) atau Uni Eropa** (1 tahun ke belakang)

**Tidak mencakup:**
- Iklan komersial biasa di Indonesia (kemasan, FMCG, manufaktur, dll.)

Meta secara eksplisit menyatakan di halaman API-nya: *"Untuk mencari semua iklan yang ditayangkan di seluruh teknologi Meta, gunakan Galeri Iklan."*

Ini bukan masalah token atau permission — API-nya memang **tidak dirancang untuk use case ini**.

---

## Pendekatan 2: Launcher ke Meta Ad Library Website — Digunakan

### Konsep

Daripada mengambil data iklan via API, dashboard berfungsi sebagai **form pencarian yang membuka Meta Ad Library website** di tab baru dengan parameter yang sudah terisi otomatis.

### URL Format

```
https://www.facebook.com/ads/library/
  ?active_status=active
  &ad_type=all
  &country=ID
  &q=<keyword>
  &search_type=keyword_unordered   ← untuk pencarian kata kunci
```

Untuk pencarian nama halaman/perusahaan:
```
https://www.facebook.com/ads/library/
  ?active_status=active
  &ad_type=all
  &country=ID
  &q=<nama perusahaan>
  &search_type=page                ← untuk pencarian halaman
```

### Keunggulan pendekatan ini

- **Tidak perlu API approval** — Meta Ad Library website bersifat publik
- **Data selalu terkini** — langsung dari sumber Meta
- **Tampilan penuh** — user melihat creative iklan, video, gambar yang tidak bisa diakses via API
- **Tidak ada rate limit** — bukan API call
- **Tidak perlu token** — tidak ada risiko keamanan

### Komponen

- `src/components/MetaAdLibraryTab.tsx` — form pencarian, membuka URL Meta Ad Library di tab baru
- `supabase/functions/ad-library-search/index.ts` — Edge Function tetap ada (sudah di-deploy), bisa diaktifkan kembali jika App Review disetujui di masa depan

---

## Catatan Final

Meta Ad Library API tidak bisa digunakan untuk kasus ini. Tidak ada jalan lain melalui API resmi Meta untuk mencari iklan komersial Indonesia.

**Alternatif berbayar** (jika diperlukan data lebih mendalam):
- AdSpy, BigSpy, SocialPeta — tools pihak ketiga yang scrape Meta Ad Library, $50–200/bulan
- Semrush Advertising Research — jika sudah berlangganan

Edge Function `supabase/functions/ad-library-search/` tetap ada di codebase dalam kondisi deployed, namun tidak digunakan karena keterbatasan API Meta di atas.

---

*Dokumen dibuat: 2026-06-18*
