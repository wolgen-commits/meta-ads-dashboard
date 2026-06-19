"use client";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAudienceWithMessaging } from "@/hooks/useMetaData";
import { useTheme } from "@/hooks/useTheme";

type MetricKey = "impressions" | "reach" | "messaging_conversations";
interface Props { dateStart: string; dateStop: string; campaignIds?: string[]; metricKey?: MetricKey; }

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

const METRIC_LABEL: Record<MetricKey, string> = { impressions: "Impresi", reach: "Jangkauan", messaging_conversations: "Percakapan" };

export function PlatformMediaChart({ dateStart, dateStop, campaignIds = [], metricKey = "impressions" }: Props) {
  const [active, setActive] = useState<Tab>("platform");

  const { data: platformData, isLoading: loadingPlatform } = useAudienceWithMessaging("publisher_platform", dateStart, dateStop, campaignIds);
  const { data: deviceData, isLoading: loadingDevice } = useAudienceWithMessaging("impression_device", dateStart, dateStop, campaignIds);

  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#34343A" : "#E5E5EA";
  const tickColor = theme === "dark" ? "#9B9BA3" : "#A1A1AA";
  const tooltipBg = theme === "dark" ? "#1F1F22" : "#FFFFFF";

  const metricLabel = METRIC_LABEL[metricKey];
  const isLoading = active === "platform" ? loadingPlatform : loadingDevice;
  const rawData   = active === "platform" ? platformData : deviceData;
  const labelMap  = active === "platform" ? PLATFORM_LABEL : DEVICE_LABEL;

  const aggregated = (rawData ?? []).reduce<Record<string, { name: string; value: number; spend: number }>>(
    (acc, row) => {
      const key = (active === "platform" ? row.publisher_platform : row.impression_device) ?? "unknown";
      const label = labelMap[key] ?? key;
      if (!acc[key]) acc[key] = { name: label, value: 0, spend: 0 };
      const v = metricKey === "reach"
        ? (row.reach ?? 0)
        : metricKey === "messaging_conversations"
          ? (row.messaging_conversations ?? 0)
          : (row.impressions ?? 0);
      acc[key].value += v;
      acc[key].spend += row.spend ?? 0;
      return acc;
    },
    {},
  );

  const chartData  = Object.values(aggregated).sort((a, b) => b.value - a.value);
  const totalValue = chartData.reduce((s, d) => s + d.value, 0);
  const totalSpend = chartData.reduce((s, d) => s + d.spend, 0);

  return (
    <div className="chart-card">
      <div className="chart-header-row">
        <div>
          <h3 className="chart-title" style={{ marginBottom: 2 }}>Platform & Media</h3>
          <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "DM Sans", color: tickColor }}>
            <span>Est. Total {metricLabel}: <strong style={{ color: "#BB2649" }}>{num(totalValue)}</strong></span>
            {totalSpend > 0 && <><span>·</span><span>Spend: <strong>{(totalSpend / 1_000_000).toFixed(1)}jt</strong></span></>}
          </div>
        </div>
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
        <div className="chart-skeleton" style={{ height: 260, marginTop: 12 }} />
      ) : chartData.length === 0 ? (
        <div className="chart-empty">Belum ada data</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
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
              formatter={(v: unknown) => [num(Number(v ?? 0)), metricLabel]}
              contentStyle={{ fontSize: 12, fontFamily: "DM Sans", borderRadius: 8, border: `1px solid ${gridColor}`, background: tooltipBg }}
            />
            <Bar dataKey="value" name={metricLabel} radius={[3, 3, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
