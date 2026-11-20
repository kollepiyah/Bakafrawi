import "server-only";
import type { Produk } from "@/content/skema";
import { promptArahan, rapikanUsulan, SISTEM_ARAHAN, SKEMA_ARAHAN } from "./usul-arahan-murni";
import { panggilLlmJson } from "./llm-router";

export async function usulkanArahan(produk: Produk, jenis: "video" | "gambar") {
  const { data } = await panggilLlmJson<unknown>({
    system: SISTEM_ARAHAN,
    prompt: promptArahan(produk, jenis),
    skema: SKEMA_ARAHAN,
    maksToken: 4000,
  });
  const usulan = rapikanUsulan(data);
  if (!usulan.length) throw new Error("AI tidak memberikan usulan arahan.");
  return usulan;
}
