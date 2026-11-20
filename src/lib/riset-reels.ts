import "server-only";
import type { Produk } from "@/content/skema";
import {
  promptRisetReels,
  rapikanRisetReels,
  SISTEM_RISET_REELS,
  SKEMA_RISET_REELS,
  type KonsepReelsViral,
} from "./riset-reels-murni";
import { panggilLlmJson } from "./llm-router";

export async function risetKonsepReels(produk: Produk, topikKhusus?: string): Promise<KonsepReelsViral[]> {
  const { data } = await panggilLlmJson<unknown>({
    system: SISTEM_RISET_REELS,
    prompt: promptRisetReels(produk, topikKhusus),
    skema: SKEMA_RISET_REELS,
    maksToken: 4000,
  });
  const hasil = rapikanRisetReels(data);
  if (!hasil.length) throw new Error("AI tidak memberikan konsep Reels.");
  return hasil;
}
