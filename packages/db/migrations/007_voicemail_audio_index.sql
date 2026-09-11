-- 007_voicemail_audio_index.sql
-- Voicemail rows are synced from the Asterisk spool directory; the absolute
-- message path is the natural unique key so re-scans upsert instead of
-- duplicating rows.

CREATE UNIQUE INDEX IF NOT EXISTS uq_voicemails_file_path ON voicemails (file_path);
