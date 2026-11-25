import { permintaanDariAdmin } from "@/lib/admin-server";
import { SUPABASE_URL } from "@/lib/lingkungan";
import {
  bangunPromptKartunkanFoto,
  bersihkanKodeLokasi,
  type GayaKartunLatar,
} from "@/lib/serial-kartun-murni";
import { adaKunciServer } from "@/lib/studio-server";

export const maxDuration = 60;

const CF_MODEL_KARTUN = "@cf/black-forest-labs/flux-2-klein-4b";

function bersihkanBase64(nilai: string): string {
  return nilai.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "").trim();
}

async function unggahKeBucketStudio(jalur: string, buffer: Buffer, mime: "image/jpeg" | "image/png"): Promise<string> {
  const kunci = process.env.SUPABASE_SERVICE_KEY ?? "";
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/studio/${jalur}`, {
    method: "POST",
    headers: {
      apikey: kunci,
      Authorization: `Bearer ${kunci}`,
      "Content-Type": mime,
      "x-upsert": "true",
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    throw new Error(`Gagal menyimpan gambar ke Storage (${res.status}): ${(await res.text()).slice(0, 180)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/studio/${jalur}`;
}

async function kartunkanCloudflare(
  inputBuffer: Buffer,
  mimeInput: string,
  prompt: string,
): Promise<{ buffer: Buffer; mime: "image/jpeg" | "image/png"; model: string }> {
  const accountId = process.env.CF_ACCOUNT_ID ?? "";
  const token = process.env.CF_API_TOKEN ?? "";
  if (!accountId || !token) throw new Error("Kunci Cloudflare AI belum dipasang.");

  const form = new FormData();
  form.append("prompt", prompt);
  form.append(
    "input_image_0",
    new Blob([new Uint8Array(inputBuffer)], { type: mimeInput === "image/png" ? "image/png" : "image/jpeg" }),
    mimeInput === "image/png" ? "foto.png" : "foto.jpg",
  );
  form.append("width", "720");
  form.append("height", "1280");

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CF_MODEL_KARTUN}`, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const teks = await res.text();
  let j: { success?: boolean; errors?: { message?: string }[]; result?: { image?: string } } | null = null;
  try {
    j = JSON.parse(teks);
  } catch {
    // bukan JSON
  }
  if (!res.ok || j?.success === false) {
    const msg = (j?.errors ?? []).map((x) => x.message).filter(Boolean).join("; ") || teks.slice(0, 180);
    throw new Error(`Cloudflare FLUX.2 gagal (${res.status}): ${msg}`);
  }
  const b64 = j?.result?.image;
  if (!b64) throw new Error("Cloudflare tidak mengembalikan gambar kartun.");
  return { buffer: Buffer.from(b64, "base64"), mime: "image/jpeg", model: CF_MODEL_KARTUN };
}

function urutkanModelGambarGemini(models: { name: string; supportedGenerationMethods?: string[] }[]): string[] {
  const calon = (models ?? [])
    .filter((m) => /image/i.test(m.name) && !/tts|embed|veo|video/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
  return calon.sort(
    (a, b) => Number(/preview|exp/.test(a)) - Number(/preview|exp/.test(b)) || Number(!/flash/.test(a)) - Number(!/flash/.test(b)),
  );
}

async function kartunkanGemini(
  base64Input: string,
  mimeInput: string,
  prompt: string,
): Promise<{ buffer: Buffer; mime: "image/jpeg" | "image/png"; model: string }> {
  const kunci = process.env.GEMINI_API_KEY ?? "";
  if (!kunci) throw new Error("GEMINI_API_KEY belum dipasang.");

  let model = process.env.STUDIO_GEMINI_GAMBAR ?? "";
  if (!model) {
    const daftarRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      signal: AbortSignal.timeout(15_000),
      headers: { "x-goog-api-key": kunci },
    });
    if (!daftarRes.ok) throw new Error(`Daftar model Gemini gagal (${daftarRes.status}).`);
    const daftarJson = (await daftarRes.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    [model] = urutkanModelGambarGemini(daftarJson.models ?? []);
    if (!model) throw new Error("Model gambar Gemini tidak tersedia untuk kunci ini.");
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { "x-goog-api-key": kunci, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeInput === "image/png" ? "image/png" : "image/jpeg", data: base64Input } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "9:16" },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini Gambar gagal (${res.status}): ${(await res.text()).slice(0, 180)}`);
  }
  const j = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const inline = (j.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("Gemini tidak mengembalikan gambar kartun.");
  const mimeKeluar: "image/jpeg" | "image/png" = inline.mimeType === "image/png" ? "image/png" : "image/jpeg";
  return { buffer: Buffer.from(inline.data, "base64"), mime: mimeKeluar, model };
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }

  const isi = (await req.json().catch(() => ({}))) as {
    gambarBase64?: string;
    mimeType?: string;
    kodeLokasi?: string;
    namaLokasi?: string;
    gayaKartun?: GayaKartunLatar;
    mode?: "ai" | "langsung";
  };

  const b64 = bersihkanBase64(String(isi.gambarBase64 ?? ""));
  if (!b64) {
    return Response.json({ ok: false, pesan: "Gambar foto tidak ditemukan." }, { status: 400 });
  }

  const inputBuffer = Buffer.from(b64, "base64");
  if (inputBuffer.length === 0 || inputBuffer.length > 4_500_000) {
    return Response.json({ ok: false, pesan: "Ukuran gambar tidak valid atau melebihi 4,5 MB." }, { status: 400 });
  }

  const mimeInput = isi.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const kode = bersihkanKodeLokasi(String(isi.kodeLokasi ?? "kedai"));
  const namaLokasi = String(isi.namaLokasi ?? "Lek Kopi coffee shop").trim() || "Lek Kopi coffee shop";
  const gayaKartun: GayaKartunLatar = isi.gayaKartun === "santai_sore" ? "santai_sore" : "ceria_hangat";

  try {
    let hasilBuffer: Buffer;
    let hasilMime: "image/jpeg" | "image/png";
    let penyedia = "langsung";
    let model = "browser-canvas";

    if (isi.mode === "langsung") {
      hasilBuffer = inputBuffer;
      hasilMime = mimeInput;
    } else {
      const prompt = bangunPromptKartunkanFoto(gayaKartun, namaLokasi);
      const galat: string[] = [];
      let sukses: { buffer: Buffer; mime: "image/jpeg" | "image/png"; model: string } | null = null;

      if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
        try {
          sukses = await kartunkanCloudflare(inputBuffer, mimeInput, prompt);
          penyedia = "cloudflare";
          model = sukses.model;
        } catch (e) {
          galat.push(e instanceof Error ? e.message : String(e));
        }
      } else {
        galat.push("Cloudflare AI (CF_ACCOUNT_ID / CF_API_TOKEN) belum diisi di Vercel");
      }

      if (!sukses && process.env.GEMINI_API_KEY) {
        try {
          sukses = await kartunkanGemini(b64, mimeInput, prompt);
          penyedia = "gemini";
          model = sukses.model;
        } catch (e) {
          galat.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (!sukses) {
        return Response.json(
          {
            ok: false,
            bisaFallbackCanvas: true,
            pesan: `Konversi kartun AI gagal (${galat.join(" · ")}). Bisa gunakan tombol Kartun Cepat di Browser atau simpan langsung.`,
          },
          { status: 400 },
        );
      }

      hasilBuffer = sukses.buffer;
      hasilMime = sukses.mime;
    }

    const ekst = hasilMime === "image/png" ? "png" : "jpg";
    const jalurKartun = `serial/latar/${kode}-${Date.now()}.${ekst}`;
    const urlKartun = await unggahKeBucketStudio(jalurKartun, hasilBuffer, hasilMime);

    return Response.json({
      ok: true,
      urlKartun,
      jalurKartun,
      penyedia,
      model,
    });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memproses latar kartun." },
      { status: 500 },
    );
  }
}
