-- Migration: tambah kolom messaging_conversations ke audience_insights
-- Jalankan di Supabase Dashboard → SQL Editor

-- 1. Tambah kolom
ALTER TABLE audience_insights
  ADD COLUMN IF NOT EXISTS messaging_conversations INTEGER DEFAULT 0;

-- 2. Komentar kolom untuk dokumentasi
COMMENT ON COLUMN audience_insights.messaging_conversations
  IS 'Jumlah percakapan pesan dimulai (messaging_conversation_started_7d) per segmen breakdown dari Meta API';

-- 3. Update RLS: anon sudah bisa SELECT, tidak perlu perubahan policy
-- (service_role: full access, anon: SELECT only — sudah dikonfigurasi sebelumnya)

-- Verifikasi:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'audience_insights' AND column_name = 'messaging_conversations';
