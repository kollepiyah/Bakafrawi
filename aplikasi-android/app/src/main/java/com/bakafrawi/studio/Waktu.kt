package com.bakafrawi.studio

import com.bakafrawi.studio.data.Acara
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// Tampilan waktu WIB di APK. Hanya untuk menampilkan; aturan acara (selesai bawaan, seharian,
// validasi) dijalankan server situs (src/lib/agenda-murni.ts) supaya tak ada dua versi.

val WIB: ZoneId = ZoneId.of("Asia/Jakarta")
private val HARI = listOf("Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu")
private val BULAN = listOf("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember")
private val JAM = DateTimeFormatter.ofPattern("HH.mm")

fun instan(iso: String): Instant = OffsetDateTime.parse(iso).toInstant()

fun tanggalWib(iso: String): LocalDate = instan(iso).atZone(WIB).toLocalDate()

fun jamWib(iso: String): String = instan(iso).atZone(WIB).format(JAM)

/** "Kamis, 19 November 2026" */
fun namaTanggal(t: LocalDate): String = "${HARI[t.dayOfWeek.value - 1]}, ${t.dayOfMonth} ${BULAN[t.monthValue - 1]} ${t.year}"

fun namaHari(t: LocalDate): String = HARI[t.dayOfWeek.value - 1]

fun rentangJam(a: Acara): String = if (a.seharian) "Seharian" else "${jamWib(a.mulai)}–${jamWib(a.selesai)}"

fun hariIniWib(): LocalDate = LocalDate.now(WIB)
