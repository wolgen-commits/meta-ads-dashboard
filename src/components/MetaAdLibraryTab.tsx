"use client";
import { useState } from "react";

const COUNTRY_OPTIONS = [
  { value: "ID", label: "Indonesia" },
  { value: "MY", label: "Malaysia" },
  { value: "SG", label: "Singapura" },
  { value: "AU", label: "Australia" },
  { value: "US", label: "Amerika Serikat" },
];

const PLATFORM_OPTIONS = [
  { value: "all",       label: "Semua platform" },
  { value: "facebook",  label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "audience_network", label: "Audience Network" },
  { value: "messenger", label: "Messenger" },
];

const STATUS_OPTIONS = [
  { value: "active",   label: "Aktif saja" },
  { value: "all",      label: "Semua (aktif & nonaktif)" },
  { value: "inactive", label: "Nonaktif saja" },
];

function buildLibraryUrl(params: {
  keyword: string;
  pageName: string;
  country: string;
  platform: string;
  status: string;
}): string {
  const { keyword, pageName, country, platform, status } = params;

  const base = "https://www.facebook.com/ads/library/";
  const sp = new URLSearchParams();

  sp.set("active_status", status);
  sp.set("ad_type", "all");
  sp.set("country", country);
  if (platform !== "all") sp.set("publisher_platforms[]", platform);

  if (pageName.trim()) {
    sp.set("q", pageName.trim());
    sp.set("search_type", "page");
  } else {
    sp.set("q", keyword.trim());
    sp.set("search_type", "keyword_unordered");
  }

  return `${base}?${sp.toString()}`;
}

export function MetaAdLibraryTab() {
  const [keyword,  setKeyword]  = useState("");
  const [pageName, setPageName] = useState("");
  const [country,  setCountry]  = useState("ID");
  const [platform, setPlatform] = useState("all");
  const [status,   setStatus]   = useState("active");

  const canSearch = keyword.trim() !== "" || pageName.trim() !== "";

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const url = buildLibraryUrl({ keyword, pageName, country, platform, status });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleQuickSearch(q: string, type: "keyword" | "page") {
    const url = buildLibraryUrl({
      keyword:  type === "keyword" ? q : "",
      pageName: type === "page"    ? q : "",
      country, platform, status,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const quickKeywords = ["kemasan", "packaging", "karton", "plastik", "flexible packaging"];

  return (
    <div className="al-tab">

      {/* Search form */}
      <form className="al-search-bar" onSubmit={handleSearch}>
        <div className="al-search-group" style={{ flex: 2 }}>
          <label htmlFor="al-keyword">Kata kunci iklan</label>
          <input
            id="al-keyword"
            type="text"
            placeholder="Contoh: kemasan kardus, packaging custom"
            value={keyword}
            onChange={e => { setKeyword(e.target.value); if (e.target.value) setPageName(""); }}
          />
        </div>

        <div className="al-search-divider">atau</div>

        <div className="al-search-group" style={{ flex: 2 }}>
          <label htmlFor="al-page">Nama halaman / perusahaan</label>
          <input
            id="al-page"
            type="text"
            placeholder="Contoh: Indofood, Unilever Indonesia"
            value={pageName}
            onChange={e => { setPageName(e.target.value); if (e.target.value) setKeyword(""); }}
          />
        </div>

        <div className="al-search-group">
          <label htmlFor="al-country">Negara</label>
          <select id="al-country" value={country} onChange={e => setCountry(e.target.value)}>
            {COUNTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="al-search-group">
          <label htmlFor="al-platform">Platform</label>
          <select id="al-platform" value={platform} onChange={e => setPlatform(e.target.value)}>
            {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="al-search-group">
          <label htmlFor="al-status">Status iklan</label>
          <select id="al-status" value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <button type="submit" className="al-search-btn" disabled={!canSearch}>
          Buka di Meta ↗
        </button>
      </form>

      {/* Info banner */}
      <div className="al-info-banner">
        <span className="al-info-icon">ℹ</span>
        <span>
          Pencarian dibuka langsung di <strong>Meta Ad Library</strong> — database publik semua iklan aktif di Facebook & Instagram.
          Anda bisa melihat creative, anggaran estimasi, dan durasi iklan kompetitor.
        </span>
      </div>

      {/* Quick keyword suggestions */}
      <div className="al-quick-section">
        <div className="al-quick-label">Cepat: kata kunci populer industri kemasan</div>
        <div className="al-quick-tags">
          {quickKeywords.map(kw => (
            <button
              key={kw}
              type="button"
              className="al-quick-tag"
              onClick={() => handleQuickSearch(kw, "keyword")}
            >
              {kw} ↗
            </button>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="al-tips-grid">
        <div className="al-tip-card">
          <div className="al-tip-title">Cari kompetitor langsung</div>
          <div className="al-tip-body">
            Masukkan nama halaman Facebook/Instagram kompetitor di kolom "Nama halaman" untuk melihat semua iklan aktif mereka.
          </div>
        </div>
        <div className="al-tip-card">
          <div className="al-tip-title">Riset kata kunci industri</div>
          <div className="al-tip-body">
            Cari kata kunci seperti "kemasan", "packaging", atau "karton" untuk melihat semua pengiklan di industri yang sama.
          </div>
        </div>
        <div className="al-tip-card">
          <div className="al-tip-title">Filter per platform</div>
          <div className="al-tip-body">
            Pilih Instagram untuk fokus pada iklan visual, atau Facebook untuk melihat iklan dengan teks & link yang lebih panjang.
          </div>
        </div>
      </div>

    </div>
  );
}
