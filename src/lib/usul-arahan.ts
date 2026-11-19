import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Produk } from "@/content/skema";
import { promptArahan, rapikanUsulan, SISTEM_ARAHAN, SKEMA_ARAHAN } from "./usul-arahan-murni";

// Sonnet 5.5 effort rendah: tiga kalimat arahan tak butuh pemikiran panjang, dan Kyai menunggu di layar.
const MODEL = "claude-sonnet-5-5";

export async function usulkanArahan(produk: Produk, jenis: "video" | "gambar") {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY belum diisi di Vercel.");
  const res = await new Anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SKEMA_ARAHAN } },
    system: SISTEM_ARAHAN,
    messages: [{ role: "user", content: promptArahan(produk, jenis) }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude menolak mengusulkan arahan.");
  const teks = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
  const usulan = rapikanUsulan(JSON.parse(teks));
  if (!usulan.length) throw new Error("Claude tidak memberi usulan.");
  return usulan;
}
