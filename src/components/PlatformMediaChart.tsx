"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAudienceRaw } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; }

type Tab = "platform" | "device";

const COLORS = ["#BB2649", "#2563EB", "#16A34A", "#D97706", "#7C3AED", "#0891B2"];

const num = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : String(v);

const PLATFORM_LABEL: Record<string, string> = {
  facebook:         "Facebook",
  instagram:        "Instagram",
  messenger:        "Messenger",
  audience_network: "Audience Network",
};

const DEVICE_LABEL: Record<string, string> = {
  mobile_app:       "Mobile App",
  desktop:          "Desktop",
  android_smartphone: "Android",
  iphone:           "iPhone",
  ipad:             "iPad",
  android_tablet:   "Android Tablet",
};

export function PlatformMediaChart({ dateStart, dateStop, campaignIds = [] }: Props) {
  const [active, setActive] = useState<Tab>("platform");

  const { data: platformData, isLoading: loadingPlatform } = useAudienceRaw("publisher_platform", dateStart, dateStop, campaignIds);
  const { data: deviceData, isLoading: loadingDevice } = useAudienceRaw("impression_device", dateStart, dateStop, campaignIds);

  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  const isLoading = active === "platform" ? loadingPlatform : loadingDevice;
  const rawData   = active === "platform" ? platformData : deviceData;
  const labelMap  = active === "platform" ? PLATFORM_LABEL : DEVICE_LABEL;

  const aggregated = (rawData ?? []).reduce<Record<string, { name: string; impressions: number; spend: number }>>(
    (acc, row) => {
      const key = (active === "platform" ? row.publisher_platform : row.impression_device) ?? "unknown";
      const label = labelMap[key] ?? key;
      if (!acc[key]) acc[key] = { name: label, impressions: 0, spend: 0 };
      acc[key].impressions += row.impressions ?? 0;
      acc[key].spend       += row.spend       ?? 0;
      return acc;
    },
    {},
  );

  const chartData = Object.values(aggregated).sort((a, b) => b.impressions - a.impressions);

  return (
    <div className="chart-card">
      <div className="chart-header-row">
        <h3 className="chart-title" style={{ marginBottom: 0 }}>Platform & Media</h3>
        <div className="eng-tabs">
          <button
            className={`eng-tab${active === "platform" ? " active" : ""}`}
            style={active === "platform" ? { borderColor: "#BB2649", color: "#BB2649" } : undefined}
            onClick={() => setActive("platform")}
          >
            Platform
          </button>
          <button
            className={`eng-tab${active === "device" ? " active" : ""}`}
            style={active === "device" ? { borderColor: "#2563EB", color: "#2563EB" } : undefined}
            onClick={() => setActive("device")}
          >
            Perangkat
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="chart-skeleton" style={{ height: 180, marginTop: 12 }} />
      ) : chartData.length === 0 ? (
        <div className="chart-empty">Belum ada data</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: tickColor, fontFamily: "DM Sans" }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: tickColor, fontFamily: "DM Sans" }}
              tickFormatter={num}
              width={40}
            />
            <Tooltip
              formatter={(v: unknown) => [num(Number(v ?? 0)), "Impresi"]}
              contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
            />
            <Bar dataKey="impressions" name="Impresi" radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
