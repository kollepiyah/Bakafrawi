package com.bakafrawi.studio.data

import kotlinx.serialization.Serializable

// Bentuk data dari API situs (/api/agenda, /api/beranda). Kolom lain diabaikan.

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
data class Ringkasan(
    val tanggal: String,
    val acaraHariIni: List<Acara> = emptyList(),
    val acaraPekan: List<Acara> = emptyList(),
    val konten: RingkasKonten = RingkasKonten(),
    val google: StatusGoogle = StatusGoogle(),
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
