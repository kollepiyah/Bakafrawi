package com.bakafrawi.studio.data

import kotlinx.serialization.Serializable

// Bentuk data utama API situs & Studio. Kolom tambahan dari server diabaikan secara aman.

@Serializable
data class Acara(
    val id: String,
    val judul: String,
    val mulai: String,
    val selesai: String,
    val seharian: Boolean = false,
    val lokasi: String? = null,
    val catatan: String? = null,
    val google_id: String? = null,
    val berulang: Boolean = false,
    val perlu_sinkron: Boolean = false,
)

@Serializable
data class RingkasKonten(
    val menungguPersetujuan: Int = 0,
    val sedangDibuat: Int = 0,
    val terjadwal: Int = 0,
    val gagal: Int = 0,
)

@Serializable
data class StatusGoogle(
    val siap: Boolean = false,
    val tersambung: Boolean = false,
    val email: String? = null,
    val galat: String? = null,
)

@Serializable
data class ItemHalamanPengunjung(
    val jalur: String = "",
    val tayangan: Int = 0,
)

@Serializable
data class ItemSumberPengunjung(
    val sumber: String = "",
    val tayangan: Int = 0,
)

@Serializable
data class RingkasPengunjung(
    val hariIniUnik: Int = 0,
    val hariIniTayangan: Int = 0,
    val pekanUnik: Int = 0,
    val pekanTayangan: Int = 0,
    val bulanUnik: Int = 0,
    val bulanTayangan: Int = 0,
    val totalUnik: Int = 0,
    val totalTayangan: Int = 0,
    val persenHp: Int = 0,
    val halamanTeratas: List<ItemHalamanPengunjung> = emptyList(),
    val sumberTeratas: List<ItemSumberPengunjung> = emptyList(),
)

@Serializable
data class Ringkasan(
    val tanggal: String,
    val acaraHariIni: List<Acara> = emptyList(),
    val acaraPekan: List<Acara> = emptyList(),
    val konten: RingkasKonten = RingkasKonten(),
    val google: StatusGoogle = StatusGoogle(),
    val pengunjung: RingkasPengunjung? = null,
)

/** Isi formulir acara. Waktu ditulis WIB tanpa zona ("2026-11-20T09:00"); aturan lengkapnya di server. */
@Serializable
data class MasukanAcara(
    val aksi: String,
    val id: String? = null,
    val judul: String,
    val mulai: String,
    val selesai: String? = null,
    val seharian: Boolean,
    val lokasi: String,
    val catatan: String,
)

// ---------------- Dasbor Aplikasi ----------------

data class RingkasAplikasi(
    val slug: String,
    val nama: String,
    val jenis: String?,
    val ok: Boolean,
    val galat: String?,
    val tingkat: String, // "baik" | "perhatian"
    val catatan: List<String>,
    val angka: List<Pair<String, String>>,
)

// ---------------- Deck Mesin ----------------

data class WorkflowRunItem(
    val nama: String,
    val status: String,
    val kesimpulan: String?,
    val dibuat: String?,
    val url: String?,
)

data class PostInsightItem(
    val id: String,
    val merek: String,
    val jenis: String,
    val caption: String?,
    val permalink: String?,
    val likes: Int,
    val comments: Int,
    val views: Int?,
    val reach: Int?,
    val saved: Int?,
    val shares: Int?,
)

data class RingkasInsightIg(
    val tersambung: Boolean,
    val akun: String?,
    val totalTayang: Int,
    val totalLikes: Int,
    val totalComments: Int,
    val totalViews: Int,
    val posts: List<PostInsightItem>,
    val pesan: String?,
    val galatInsight: String?,
)

data class DataDeck(
    val workflows: List<WorkflowRunItem>,
    val ringkasBiaya: String?,
    val insight: RingkasInsightIg?,
)

// ---------------- Studio Konten ----------------

data class MerekStudio(
    val slug: String,
    val nama: String,
    val aktif: Boolean,
    val adalahBank: Boolean,
)

data class ProdukRingkas(
    val slug: String,
    val nama: String,
)

data class HasilStudio(
    val jenis: String,
    val rasio: String,
    val url: String,
)

data class TugasStudio(
    val id: String,
    val merek: String,
    val dibuat: String,
    val jenis: String,
    val produkSlug: String,
    val arahan: String,
    val status: String,
    val caption: String?,
    val hasil: List<HasilStudio>,
    val galat: String?,
    val statusTayang: String,
    val jadwalTayang: String?,
    val sasaran: String?,
    val permalink: String?,
    val adaNaskah: Boolean,
)

data class UsulanArahan(
    val judul: String,
    val arahan: String,
)

data class JadwalRutinData(
    val aktif: Boolean,
    val jamWib: String,
    val hari: List<Int>,
    val modeKonten: String, // "video-bank" | "ai-baru"
    val formatAi: String,   // "video-animasi" | "poster-story"
    val temaAi: String,     // "otomatis" | "hangat-kafe" | "terang-modern" | "minimalis-gelap"
    val berikutnya: String?,
    val jumlahVideo: Int,
)

data class KonsepViral(
    val judul: String,
    val hook: String,
    val ringkas: String,
    val cta: String,
)

data class DataRiset(
    val statusJadwal: String,
    val daftarJamOptimal: List<String>,
    val konsep: List<KonsepViral>,
)

data class SambunganMerek(
    val merek: String,
    val nama: String,
    val aktif: Boolean,
    val igAkun: String?,
    val tiktokAkun: String?,
)

data class DataSambungan(
    val siap: Boolean,
    val pesan: String?,
    val merek: List<SambunganMerek>,
    val telegramTerdaftar: Boolean,
    val telegramWebhook: String?,
)
