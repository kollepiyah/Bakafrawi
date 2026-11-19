import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Produk } from "@/content/skema";
import {
  promptRisetReels,
  rapikanRisetReels,
  SISTEM_RISET_REELS,
  SKEMA_RISET_REELS,
  type KonsepReelsViral,
} from "./riset-reels-murni";

const MODEL = "claude-sonnet-5-5";

export async function risetKonsepReels(produk: Produk, topikKhusus?: string): Promise<KonsepReelsViral[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY belum diisi di Vercel.");
  const res = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA_RISET_REELS } },
    system: SISTEM_RISET_REELS,
    messages: [{ role: "user", content: promptRisetReels(produk, topikKhusus) }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak meriset konsep Reels.");
  const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const hasil = rapikanRisetReels(JSON.parse(teks));
  if (!hasil.length) throw new Error("Claude tidak memberikan konsep Reels.");
  return hasil;
}
