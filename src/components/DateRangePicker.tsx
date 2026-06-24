"use client";

import React, { useState, useRef, useEffect } from "react";

// --- Date Helpers ---
const isoToDate = (iso: string) => {
  if (!iso) return new Date();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const dateToIso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtShort = (d: Date) => {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const offsetDate = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

// --- Presets ---
const PRESETS = [
  { label: "Hari ini", getRange: () => [new Date(), new Date()] },
  { label: "Kemarin", getRange: () => [offsetDate(new Date(), -1), offsetDate(new Date(), -1)] },
  {
    label: "Minggu ini (Min – Hari ini)",
    getRange: () => {
      const today = new Date();
      const diff = today.getDay(); // 0 = Sunday
      const start = offsetDate(today, -diff);
      return [start, today];
    },
  },
  { label: "7 hari terakhir", getRange: () => [offsetDate(new Date(), -6), new Date()] },
  {
    label: "Minggu lalu (Min – Sab)",
    getRange: () => {
      const today = new Date();
      const diff = today.getDay();
      const lastSunday = offsetDate(today, -(diff + 7));
      const lastSaturday = offsetDate(lastSunday, 6);
      return [lastSunday, lastSaturday];
    },
  },
  { label: "14 hari terakhir", getRange: () => [offsetDate(new Date(), -13), new Date()] },
  {
    label: "Bulan ini",
    getRange: () => {
      const today = new Date();
      return [new Date(today.getFullYear(), today.getMonth(), 1), today];
    },
  },
  { label: "30 hari terakhir", getRange: () => [offsetDate(new Date(), -29), new Date()] },
  {
    label: "Bulan lalu",
    getRange: () => {
      const today = new Date();
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return [firstDayLastMonth, lastDayLastMonth];
    },
  },
  { label: "Semua", getRange: () => [new Date(2023, 0, 1), new Date()] }, // Example all time
];

interface DateRangePickerProps {
  dateStart: string; // YYYY-MM-DD
  dateStop: string; // YYYY-MM-DD
  onChange: (start: string, stop: string) => void;
  maxDate?: string;
}

export function DateRangePicker({ dateStart, dateStop, onChange, maxDate }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  
  // Internal state for selection
  const [startD, setStartD] = useState<Date | null>(isoToDate(dateStart));
  const [endD, setEndD]     = useState<Date | null>(isoToDate(dateStop));
  
  // Which month the calendar is currently showing
  const [viewMonth, setViewMonth] = useState<Date>(startD || new Date());
  
  // For hover state during range selection
  const [hoverD, setHoverD] = useState<Date | null>(null);
  
  // Track selection phase (0 = none, 1 = start picked, waiting for end)
  const [phase, setPhase] = useState<0 | 1>(0);

  // For month/year picker
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [tempYear, setTempYear] = useState<number>(new Date().getFullYear());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset internal state if props change while closed
    if (!open) {
      setStartD(isoToDate(dateStart));
      setEndD(isoToDate(dateStop));
      setViewMonth(isoToDate(dateStart) || new Date());
      setPhase(0);
      setShowMonthPicker(false);
    }
  }, [dateStart, dateStop, open]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handle);
    }
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Calendar math
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  
  // Days in current month
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  // Day of week of first day (0 = Sunday)
  const firstDayOfWeek = new Date(y, m, 1).getDay();
  // Days in prev month
  const daysInPrevMonth = new Date(y, m, 0).getDate();

  const handlePrevMonth = () => setViewMonth(new Date(y, m - 1, 1));
  const handleNextMonth = () => setViewMonth(new Date(y, m + 1, 1));

  const handleDayClick = (d: Date) => {
    if (phase === 0 || (startD && d < startD)) {
      setStartD(d);
      setEndD(null);
      setPhase(1);
    } else {
      setEndD(d);
      setPhase(0);
    }
  };

  const applySelection = () => {
    if (startD && endD) {
      onChange(dateToIso(startD), dateToIso(endD));
    } else if (startD && !endD) {
      // If they only picked start, apply same date
      onChange(dateToIso(startD), dateToIso(startD));
    }
    setOpen(false);
  };

  const selectPreset = (getRange: () => Date[]) => {
    const [s, e] = getRange();
    setStartD(s);
    setEndD(e);
    setViewMonth(e);
    setPhase(0);
    // Automatically apply? Usually we don't apply immediately in this UI unless they click Terapkan,
    // but applying immediately on preset click is common. The mockup shows "Terapkan" button, 
    // so we just update internal state.
  };

  // Build grid
  const grid = [];
  // Prev month padding
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    grid.push({ d: new Date(y, m - 1, daysInPrevMonth - i), inMonth: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    grid.push({ d: new Date(y, m, i), inMonth: true });
  }
  // Next month padding to complete 42 cells (6 rows)
  const remaining = 42 - grid.length;
  for (let i = 1; i <= remaining; i++) {
    grid.push({ d: new Date(y, m + 1, i), inMonth: false });
  }

  const isSelected = (d: Date) => {
    const dIso = dateToIso(d);
    return dIso === (startD ? dateToIso(startD) : null) || dIso === (endD ? dateToIso(endD) : null);
  };

  const isInRange = (d: Date) => {
    if (!startD) return false;
    if (endD) return d >= startD && d <= endD;
    if (phase === 1 && hoverD) {
      return d >= startD && d <= hoverD;
    }
    return false;
  };

  const monthLabel = viewMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" }).toUpperCase();

  return (
    <div className="drp-container" ref={containerRef}>
      {/* Trigger Button */}
      <button className="drp-trigger" onClick={() => setOpen(!open)}>
        <span className="drp-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </span>
        <span className="drp-text">
          {fmtShort(isoToDate(dateStart))} - {fmtShort(isoToDate(dateStop))}
        </span>
        <span className="drp-arrow">▼</span>
      </button>

      {/* Popover */}
      {open && (
        <div className="drp-popover">
          <div className="drp-body">
            
            {/* Sidebar Presets */}
            <div className="drp-sidebar">
              {PRESETS.map((p, i) => (
                <button key={i} className="drp-preset-btn" onClick={() => selectPreset(p.getRange)}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendar Pane */}
            <div className="drp-main">
              
              {/* Inputs Top Header */}
              <div className="drp-header-inputs">
                <div className="drp-input-wrap">
                  <label>Tanggal mulai</label>
                  <input type="text" readOnly value={startD ? fmtShort(startD) : ""} placeholder="Pilih..." />
                </div>
                <span className="drp-dash">—</span>
                <div className="drp-input-wrap">
                  <label>Tanggal akhir</label>
                  <input type="text" readOnly value={endD ? fmtShort(endD) : ""} placeholder="Pilih..." />
                </div>
              </div>

              {/* Calendar Navigator */}
              <div className="drp-calendar-nav">
                <button 
                  style={{ background: 'transparent', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4 }}
                  onClick={() => {
                    if (!showMonthPicker) setTempYear(viewMonth.getFullYear());
                    setShowMonthPicker(!showMonthPicker);
                  }}
                >
                  {monthLabel} <span style={{ fontSize: 10, color: 'var(--gray-500)' }}>{showMonthPicker ? '▲' : '▼'}</span>
                </button>
                {!showMonthPicker && (
                  <div className="drp-nav-arrows">
                    <button onClick={handlePrevMonth}>&lt;</button>
                    <button onClick={handleNextMonth}>&gt;</button>
                  </div>
                )}
              </div>

              {/* Month/Year Picker OR Calendar Grid */}
              {showMonthPicker ? (
                <div style={{ padding: '8px 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--gray-600)', padding: '4px 8px' }}
                      onClick={() => setTempYear(y => y - 1)}
                    >&lt;</button>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>{tempYear}</span>
                    <button 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--gray-600)', padding: '4px 8px' }}
                      onClick={() => setTempYear(y => y + 1)}
                    >&gt;</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"].map((mStr, idx) => {
                      const isCurrentView = tempYear === viewMonth.getFullYear() && idx === viewMonth.getMonth();
                      return (
                        <button 
                          key={mStr} 
                          style={{ 
                            padding: '10px 0', borderRadius: 6, border: 'none', 
                            background: isCurrentView ? 'var(--info-600)' : 'transparent', 
                            color: isCurrentView ? '#fff' : 'var(--gray-800)', 
                            cursor: 'pointer', fontWeight: 500, fontSize: 13,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => { if (!isCurrentView) e.currentTarget.style.background = 'var(--gray-100)'; }}
                          onMouseLeave={(e) => { if (!isCurrentView) e.currentTarget.style.background = 'transparent'; }}
                          onClick={() => {
                            setViewMonth(new Date(tempYear, idx, 1));
                            setShowMonthPicker(false);
                          }}
                        >
                          {mStr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="drp-calendar">
                  <div className="drp-weekdays">
                    {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
                      <div key={i} className="drp-weekday">{d}</div>
                    ))}
                  </div>
                  <div className="drp-days" onMouseLeave={() => setHoverD(null)}>
                    {grid.map((cell, i) => {
                      const selected = isSelected(cell.d);
                      const inRange = isInRange(cell.d);
                      const disabled = maxDate ? cell.d > isoToDate(maxDate) : false;
                      
                      let classes = "drp-day";
                      if (!cell.inMonth) classes += " outside";
                      if (selected) classes += " selected";
                      else if (inRange) classes += " in-range";
                      if (disabled) classes += " disabled";

                      return (
                        <button 
                          key={i} 
                          className={classes}
                          disabled={disabled}
                          onClick={() => handleDayClick(cell.d)}
                          onMouseEnter={() => { if (phase === 1 && !disabled) setHoverD(cell.d); }}
                        >
                          <span className="drp-day-text">{cell.d.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer Actions */}
          <div className="drp-footer">
            <button className="drp-btn-cancel" onClick={() => setOpen(false)}>Batal</button>
            <button className="drp-btn-apply" onClick={applySelection}>Terapkan</button>
          </div>
        </div>
      )}
    </div>
  );
}
