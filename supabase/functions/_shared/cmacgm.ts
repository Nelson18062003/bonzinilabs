// ============================================================
// CMA CGM — API Track & Trace (operation.trackandtrace.v1), standard DCSA
// 2.2 comme Maersk : mêmes jalons, même normalisation (_shared/maersk.ts).
//
// GET https://apis.cma-cgm.net/operation/trackandtrace/v1/events
//     ?transportDocumentReference=<B/L>  |  ?carrierBookingReference=<booking>
//     |  ?equipmentReference=<boîte>        header keyId. Quota : 20 appels / heure.
//
// Un B/L CMA CGM (GGZ1234567) et un booking ont la même forme : si le B/L ne
// répond rien, on retente la référence comme booking avant de conclure.
// ============================================================

import { dcsaEventsOf } from "./maersk.ts";
import type { DcsaEvent } from "./maersk.ts";

export const CMACGM_URL = "https://apis.cma-cgm.net/operation/trackandtrace/v1/events";

async function get(key: string, query: string): Promise<DcsaEvent[]> {
  const res = await fetch(`${CMACGM_URL}?${query}`, { headers: { keyId: key, Accept: "application/json" } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`CMA CGM HTTP ${res.status}`);
  return dcsaEventsOf(await res.json());
}

export async function fetchCmaCgmEvents(key: string, params: { bl?: string; container?: string }): Promise<DcsaEvent[]> {
  if (params.bl) {
    const byBl = await get(key, `transportDocumentReference=${encodeURIComponent(params.bl)}`);
    if (byBl.length) return byBl;
    return get(key, `carrierBookingReference=${encodeURIComponent(params.bl)}`);
  }
  return get(key, `equipmentReference=${encodeURIComponent(params.container ?? "")}`);
}
