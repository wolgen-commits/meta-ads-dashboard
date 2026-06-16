"use client";
import { useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { useIgAccounts, useIgSummary, useIgTopMedia } from "@/hooks/useMetaData";

const num = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}rb` : String(n);

function MediaCard({ media }: { media: any }) {
  const date = new Date(media.timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const typeLabel: Record<string, string> = { FEED: "Feed", REELS: "Reel", STORY: "Story", IMAGE: "Foto", VIDEO: "Video", CAROUSEL_ALBUM: "Carousel" };

  return (
    <a href={media.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="media-card">
      <div className="media-thumb">
        {media.thumbnail_url
          ? <img src={media.thumbnail_url} alt={media.caption ?? "post"} loading="lazy" />
          : <div className="media-thumb-placeholder">{typeLabel[media.media_product_type] ?? "Post"}</div>
        }
        <span className="media-type-badge">{typeLabel[media.media_product_type] ?? media.media_product_type}</span>
      </div>
      <div className="media-info">
        <div className="media-stats">
          <span>❤️ {num(media.likes ?? 0)}</span>
          <span>💬 {num(media.comments ?? 0)}</span>
          <span>🔗 {num(media.shares ?? 0)}</span>
          <span>🔖 {num(media.saved ?? 0)}</span>
        </div>
        <div className="media-reach">Reach: {num(media.reach ?? 0)}</div>
        {media.caption && <p className="media-caption">{media.caption.slice(0, 80)}{media.caption.length > 80 ? "..." : ""}</p>}
        <div className="media-date">{date}</div>
      </div>
    </a>
  );
}

function AccountTab({ accountId }: { accountId: string }) {
  const { data: summary, isLoading: loadingSummary } = useIgSummary(accountId);
  const { data: media, isLoading: loadingMedia }     = useIgTopMedia(accountId, 12);

  return (
    <div className="ig-account-tab">
      <section className="kpi-grid">
        <KpiCard label="Total Likes"     value={summary ? num(summary.total_likes) : "—"}    loading={loadingSummary} description="Total likes dari semua post yang tersimpan." accent="magenta" />
        <KpiCard label="Total Komentar"  value={summary ? num(summary.total_comments) : "—"} loading={loadingSummary} description="Total komentar dari semua post." />
        <KpiCard label="Total Shares"    value={summary ? num(summary.total_shares) : "—"}   loading={loadingSummary} description="Total share/repost dari semua post." />
        <KpiCard label="Total Tersimpan" value={summary ? num(summary.total_saved) : "—"}    loading={loadingSummary} description="Total post yang disimpan oleh pengguna." />
        <KpiCard label="Total Reach"     value={summary ? num(summary.total_reach) : "—"}    loading={loadingSummary} description="Total jangkauan dari semua post." accent="info" />
        <KpiCard
          label="Avg Engagement Rate"
          value={summary ? `${summary.avg_engagement_rate.toFixed(2)}%` : "—"}
          loading={loadingSummary}
          description="Rata-rata engagement rate: (likes+comments+shares+saves) / reach × 100."
          accent="success"
        />
      </section>

      <div className="media-section">
        <h3 className="chart-title" style={{ textTransform: "uppercase", letterSpacing: "0.5px", fontSize: 13 }}>Post Terbaru</h3>
        {loadingMedia ? (
          <div className="media-grid">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="media-card-skeleton" />)}
          </div>
        ) : (
          <div className="media-grid">
            {(media ?? []).map((m) => <MediaCard key={m.id} media={m} />)}
            {(media ?? []).length === 0 && <p style={{ color: "var(--gray-400)", fontSize: 14 }}>Belum ada data media.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function InstagramTab() {
  const { data: accounts, isLoading } = useIgAccounts();
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  if (isLoading) return <div className="chart-skeleton" style={{ height: 200 }} />;
  if (!accounts || accounts.length === 0) return <p style={{ color: "var(--gray-400)" }}>Belum ada akun Instagram yang terhubung.</p>;

  const current = activeAccount ?? accounts[0]?.id;
  const currentAccount = accounts.find((a) => a.id === current);

  return (
    <div className="ig-tab">
      <div className="ig-account-switcher">
        {accounts.map((a) => (
          <button
            key={a.id}
            className={`ig-account-btn ${current === a.id ? "active" : ""}`}
            onClick={() => setActiveAccount(a.id)}
          >
            <span className="ig-at">@{a.username ?? a.name}</span>
            <span className="ig-followers">{num(a.followers_count)} followers</span>
          </button>
        ))}
      </div>
      {currentAccount && <AccountTab accountId={currentAccount.id} />}
    </div>
  );
}
