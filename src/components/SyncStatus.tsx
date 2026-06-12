"use client";
import { useSyncLog } from "@/hooks/useMetaData";

export function SyncStatus() {
  const { data, isLoading } = useSyncLog();
  const latest = data?.[0];
  if (isLoading || !latest) return null;
  const isOk = latest.status === "success";
  const time = new Date(latest.finished_at ?? latest.started_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const date = new Date(latest.finished_at ?? latest.started_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return (
    <div className={`sync-badge ${isOk ? "ok" : "err"}`}>
      <span className="sync-dot" />
      <span>
        Sync {isOk ? "berhasil" : "gagal"} — {date}, {time}
        {latest.records_upserted > 0 && ` · ${latest.records_upserted.toLocaleString("id-ID")} records`}
        {latest.duration_ms && ` · ${(latest.duration_ms/1000).toFixed(1)}s`}
      </span>
    </div>
  );
}
