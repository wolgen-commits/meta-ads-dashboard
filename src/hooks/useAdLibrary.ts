"use client";
import useSWR from "swr";
import type { AdLibraryResponse } from "@/types/database";

export interface AdLibraryParams {
  q: string;
  page_name: string;
  country: string;
  ad_type: string;
  platform: string;
}

const EDGE_FN_URL =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ad-library-search`;

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function fetcher(url: string): Promise<AdLibraryResponse> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function buildUrl(params: AdLibraryParams, after?: string): string | null {
  if (!params.q.trim() && !params.page_name.trim()) return null;

  const sp = new URLSearchParams();
  if (params.q.trim())         sp.set("q", params.q.trim());
  if (params.page_name.trim()) sp.set("page_name", params.page_name.trim());
  sp.set("country",  params.country  || "ID");
  sp.set("ad_type",  params.ad_type  || "ALL");
  sp.set("platform", params.platform || "all");
  if (after) sp.set("after", after);

  return `${EDGE_FN_URL}?${sp.toString()}`;
}

export function useAdLibrary(params: AdLibraryParams | null, after?: string) {
  const url = params ? buildUrl(params, after) : null;

  const { data, error, isLoading } = useSWR<AdLibraryResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: false,
    }
  );

  return {
    ads:        data?.data ?? [],
    nextCursor: data?.paging?.cursors?.after ?? null,
    hasMore:    !!data?.paging?.next,
    isLoading,
    error:      error as Error | undefined,
  };
}
