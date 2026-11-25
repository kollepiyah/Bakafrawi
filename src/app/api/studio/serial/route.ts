import { permintaanDariAdmin } from "@/lib/admin-server";
import type { SasaranTayang } from "@/lib/jadwal-tayang-murni";
import { SUPABASE_URL } from "@/lib/lingkungan";
import { panggilLlmJson } from "@/lib/llm-router";
import {
  bersihkanKodeLokasi,
  buatPromptNaskahDrafSerial,
  buatPromptSaranCeritaSerial,
  episodeBerikutnya,
  normalisasiNaskahDrafSerial,
  normalisasiSaranCeritaSerial,
  SKEMA_NASKAH_DRAF_SERIAL,
  SKEMA_SARAN_CERITA_SERIAL,
  type FormatSuaraSerial,
  type GayaKartunLatar,
  type KonfigSuaraTokoh,
  type LatarKartun,
  type MoodSerial,
  type NaskahDrafSerial,
  type SerialKartun,
} from "@/lib/serial-kartun-murni";
import {
  adaKunciServer,
  ambilMenuLekKopiUntukPrompt,
  bacaKonfigSerialLekKopi,
  buatTugasSerialKartun,
  daftarMerek,
  normalisasiSuaraFavorit,
  simpanKonfigSerialLekKopi,
} from "@/lib/studio-server";

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }
  try {
    const [konfig, semuaMerek] = await Promise.all([bacaKonfigSerialLekKopi(), daftarMerek()]);
    const bakafrawi = semuaMerek.find((m) => m.slug === "bakafrawi");
    const suaraFavorit = normalisasiSuaraFavorit(bakafrawi?.profil?.suara_elevenlabs);
    return Response.json({ ok: true, konfig, suaraFavorit });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memuat data Serial Kartun." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!(await permintaanDariAdmin(req))) return Response.json({ ok: false }, { status: 401 });
  if (!adaKunciServer()) {
    return Response.json({ ok: false, pesan: "SUPABASE_SERVICE_KEY belum diisi di Vercel." }, { status: 500 });
  }

  const isi = (await req.json().catch(() => ({}))) as {
    aksi?:
      | "simpan-latar"
      | "hapus-latar"
      | "simpan-serial"
      | "pilih-serial"
      | "hapus-episode"
      | "saran-ide"
      | "buat-naskah"
      | "buat-episode";
    id?: string;
    kode?: string;
    nama?: string;
    deskripsi?: string;
    urlKartun?: string;
    jalurKartun?: string;
    urlAsli?: string;
    jalurAsli?: string;
    gayaKartun?: GayaKartunLatar;
    serialId?: string;
    judul?: string;
    tagline?: string;
    moodBawaan?: MoodSerial;
    formatSuara?: FormatSuaraSerial;
    suaraTokoh?: KonfigSuaraTokoh;
    nomorEpisode?: number;
    kataKunci?: string;
    ide?: string;
    mood?: MoodSerial;
    modeJadwal?: "persetujuan" | "prime19" | "custom";
    jadwal?: string | null;
    sasaran?: SasaranTayang | string | null;
    naskahJadi?: NaskahDrafSerial | null;
  };

  try {
    if (isi.aksi === "simpan-latar") {
      const urlKartun = String(isi.urlKartun ?? "").trim();
      const jalurKartun = String(isi.jalurKartun ?? "").trim().replace(/^\/+/, "");
      if (!/^https:\/\//i.test(urlKartun) || !jalurKartun) {
        return Response.json({ ok: false, pesan: "URL latar kartun tidak sah." }, { status: 400 });
      }
      const konfig = await bacaKonfigSerialLekKopi();
      const idBaru = String(isi.id ?? "").trim() || `latar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const itemBaru: LatarKartun = {
        id: idBaru,
        kode: bersihkanKodeLokasi(String(isi.kode ?? "kedai")),
        nama: String(isi.nama ?? "").trim().slice(0, 50) || "Sudut Lek Kopi",
        deskripsi: String(isi.deskripsi ?? "").trim().slice(0, 140),
        urlKartun,
        jalurKartun,
        ...(isi.urlAsli && /^https:\/\//i.test(isi.urlAsli) ? { urlAsli: isi.urlAsli.trim() } : {}),
        ...(isi.jalurAsli ? { jalurAsli: isi.jalurAsli.trim().replace(/^\/+/, "") } : {}),
        gayaKartun: isi.gayaKartun === "santai_sore" ? "santai_sore" : "ceria_hangat",
        dibuat: new Date().toISOString(),
      };
      const tanpaLama = konfig.latar.filter((l) => l.id !== idBaru);
      const tersimpan = await simpanKonfigSerialLekKopi({ ...konfig, latar: [itemBaru, ...tanpaLama] });
      return Response.json({ ok: true, konfig: tersimpan, pesan: `Latar kartun "${itemBaru.nama}" tersimpan.` });
    }

    if (isi.aksi === "hapus-latar") {
      const id = String(isi.id ?? "").trim();
      const konfig = await bacaKonfigSerialLekKopi();
      const target = konfig.latar.find((l) => l.id === id);
      if (!target) {
        return Response.json({ ok: false, pesan: "Latar tidak ditemukan." }, { status: 404 });
      }
      const kunci = process.env.SUPABASE_SERVICE_KEY ?? "";
      for (const jalur of [target.jalurKartun, target.jalurAsli].filter(Boolean) as string[]) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/studio/${jalur}`, {
          method: "DELETE",
          headers: { apikey: kunci, Authorization: `Bearer ${kunci}` },
        }).catch(() => null);
      }
      const tersimpan = await simpanKonfigSerialLekKopi({
        ...konfig,
        latar: konfig.latar.filter((l) => l.id !== id),
      });
      return Response.json({ ok: true, konfig: tersimpan, pesan: "Latar kartun dihapus." });
    }

    if (isi.aksi === "pilih-serial") {
      const serialId = bersihkanKodeLokasi(String(isi.serialId ?? ""), "");
      const konfig = await bacaKonfigSerialLekKopi();
      if (!konfig.serial.some((s) => s.id === serialId)) {
        return Response.json({ ok: false, pesan: "Serial tidak ditemukan." }, { status: 404 });
      }
      const tersimpan = await simpanKonfigSerialLekKopi({ ...konfig, serialAktifId: serialId });
      return Response.json({ ok: true, konfig: tersimpan, pesan: "Serial aktif diperbarui." });
    }

    if (isi.aksi === "simpan-serial") {
      const judul = String(isi.judul ?? "").trim().slice(0, 60);
      if (!judul) return Response.json({ ok: false, pesan: "Judul serial wajib diisi." }, { status: 400 });
      const konfig = await bacaKonfigSerialLekKopi();
      const idTarget = bersihkanKodeLokasi(String(isi.serialId || judul), "");
      const sudahAda = konfig.serial.find((s) => s.id === idTarget);
      const item: SerialKartun = {
        id: idTarget,
        judul,
        tagline: String(isi.tagline ?? "").trim().slice(0, 140),
        moodBawaan: isi.moodBawaan ?? sudahAda?.moodBawaan ?? "komedi_ceria",
        formatSuara: isi.formatSuara === "narator" ? "narator" : "dialog",
        suaraTokoh: isi.suaraTokoh ?? sudahAda?.suaraTokoh ?? {},
        episode: sudahAda?.episode ?? [],
        dibuat: sudahAda?.dibuat ?? new Date().toISOString(),
      };
      const daftarBaru = sudahAda
        ? konfig.serial.map((s) => (s.id === idTarget ? item : s))
        : [item, ...konfig.serial];
      const tersimpan = await simpanKonfigSerialLekKopi({
        ...konfig,
        serial: daftarBaru,
        serialAktifId: item.id,
      });
      return Response.json({ ok: true, konfig: tersimpan, pesan: `Serial "${item.judul}" tersimpan.` });
    }

    if (isi.aksi === "hapus-episode") {
      const serialId = bersihkanKodeLokasi(String(isi.serialId ?? ""), "");
      const nomor = Number(isi.nomorEpisode) || 0;
      const konfig = await bacaKonfigSerialLekKopi();
      const daftarBaru = konfig.serial.map((s) =>
        s.id === serialId ? { ...s, episode: s.episode.filter((e) => e.nomor !== nomor) } : s,
      );
      const tersimpan = await simpanKonfigSerialLekKopi({ ...konfig, serial: daftarBaru });
      return Response.json({ ok: true, konfig: tersimpan, pesan: `Riwayat Episode ${nomor} dihapus.` });
    }

    if (isi.aksi === "saran-ide") {
      const [konfig, daftarMenu] = await Promise.all([
        bacaKonfigSerialLekKopi(),
        ambilMenuLekKopiUntukPrompt(),
      ]);
      const serial =
        konfig.serial.find((s) => s.id === isi.serialId) ??
        konfig.serial.find((s) => s.id === konfig.serialAktifId) ??
        konfig.serial[0];
      const nomorEpisode = episodeBerikutnya(serial);
      const mood: MoodSerial = isi.mood ?? serial?.moodBawaan ?? "komedi_ceria";
      const { system, prompt } = buatPromptSaranCeritaSerial({
        judulSerial: serial?.judul,
        nomorEpisode,
        kataKunci: isi.kataKunci,
        mood,
        riwayatEpisode: serial?.episode ?? [],
        daftarMenu,
      });
      const hasil = await panggilLlmJson<Record<string, unknown>>(
        {
          system,
          prompt,
          skema: SKEMA_SARAN_CERITA_SERIAL,
          suhu: 0.75,
          maksToken: 1400,
          valid: (d) => normalisasiSaranCeritaSerial(d, mood).length > 0,
        },
        "saran-cerita-serial",
      );
      const saran = normalisasiSaranCeritaSerial(hasil.data, mood);
      return Response.json({
        ok: true,
        saran,
        nomorEpisode,
        penyedia: hasil.pemakaian.penyedia,
        model: hasil.pemakaian.model,
      });
    }

    if (isi.aksi === "buat-naskah") {
      const [konfig, daftarMenu] = await Promise.all([
        bacaKonfigSerialLekKopi(),
        ambilMenuLekKopiUntukPrompt(),
      ]);
      const serial =
        konfig.serial.find((s) => s.id === isi.serialId) ??
        konfig.serial.find((s) => s.id === konfig.serialAktifId) ??
        konfig.serial[0];
      const nomorEpisode = episodeBerikutnya(serial);
      const mood: MoodSerial = isi.mood ?? serial?.moodBawaan ?? "komedi_ceria";
      const formatSuara: FormatSuaraSerial = isi.formatSuara ?? serial?.formatSuara ?? "dialog";
      const { system, prompt } = buatPromptNaskahDrafSerial({
        judulSerial: serial?.judul,
        nomorEpisode,
        mood,
        formatSuara,
        ide: isi.ide,
        kataKunci: isi.kataKunci,
        riwayatEpisode: serial?.episode ?? [],
        daftarLatar: konfig.latar,
        daftarMenu,
      });
      const hasil = await panggilLlmJson<Record<string, unknown>>(
        {
          system,
          prompt,
          skema: SKEMA_NASKAH_DRAF_SERIAL,
          suhu: 0.7,
          maksToken: 2800,
          valid: (d) => normalisasiNaskahDrafSerial(d, nomorEpisode).adegan.length >= 3,
        },
        "draf-naskah-serial",
      );
      const naskah = normalisasiNaskahDrafSerial(hasil.data, nomorEpisode);
      return Response.json({
        ok: true,
        naskah,
        nomorEpisode,
        penyedia: hasil.pemakaian.penyedia,
        model: hasil.pemakaian.model,
      });
    }

    if (isi.aksi === "buat-episode") {
      const naskahBersih =
        isi.naskahJadi && Array.isArray(isi.naskahJadi.adegan) && isi.naskahJadi.adegan.length > 0
          ? normalisasiNaskahDrafSerial(isi.naskahJadi)
          : null;
      const r = await buatTugasSerialKartun({
        serialId: isi.serialId,
        ide: isi.ide,
        mood: isi.mood,
        formatSuara: isi.formatSuara,
        modeJadwal: isi.modeJadwal,
        jadwal: isi.jadwal,
        sasaran: isi.sasaran,
        naskahJadi: naskahBersih,
      });
      const infoJadwal = r.jadwalIso
        ? ` & dijadwalkan ${new Date(r.jadwalIso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" })} WIB`
        : "";
      return Response.json({
        ok: true,
        tugas: r.tugas,
        dipicu: r.dipicu,
        pesan: r.dipicu
          ? `Episode ${r.nomorEpisode} "${r.judulSerial}" mulai dibuat${infoJadwal} — mesin Studio sudah dinyalakan (±3–6 menit).`
          : `Episode ${r.nomorEpisode} "${r.judulSerial}" masuk antrean${infoJadwal}. Mesin akan memproses ≤ 30 menit.`,
      });
    }

    return Response.json({ ok: false, pesan: "Aksi serial tidak dikenali." }, { status: 400 });
  } catch (e) {
    return Response.json(
      { ok: false, pesan: e instanceof Error ? e.message : "Gagal memproses Serial Kartun." },
      { status: 500 },
    );
  }
}
