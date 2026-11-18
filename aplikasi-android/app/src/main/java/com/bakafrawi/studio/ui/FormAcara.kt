package com.bakafrawi.studio.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bakafrawi.studio.WIB
import com.bakafrawi.studio.data.Acara
import com.bakafrawi.studio.data.MasukanAcara
import com.bakafrawi.studio.hariIniWib
import com.bakafrawi.studio.instan
import com.bakafrawi.studio.namaTanggal
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private val JAM = DateTimeFormatter.ofPattern("HH:mm")

/**
 * Formulir tambah/ubah acara. Hanya mengumpulkan isian; server yang merapikan & memeriksa
 * (selesai kosong = 1 jam, seharian, dll.) lalu mengirim ke Google Calendar.
 */
@Composable
fun FormAcara(awal: Acara?, tutup: () -> Unit, simpan: suspend (MasukanAcara) -> Unit, hapus: (suspend () -> Unit)?) {
    val konteks = LocalContext.current
    val cakupan = rememberCoroutineScope()
    val mulaiAwal = awal?.let { instan(it.mulai).atZone(WIB) }
    // Selesai seharian disimpan eksklusif (hari berikutnya 00.00) → tampilkan tanggal terakhirnya.
    val selesaiAwal = awal?.let { instan(it.selesai).atZone(WIB).let { z -> if (it.seharian) z.minusDays(1) else z } }

    var judul by remember { mutableStateOf(awal?.judul ?: "") }
    var seharian by remember { mutableStateOf(awal?.seharian ?: false) }
    var tanggal by remember { mutableStateOf(mulaiAwal?.toLocalDate() ?: hariIniWib()) }
    var tanggalAkhir by remember { mutableStateOf(selesaiAwal?.toLocalDate()) }
    var jamMulai by remember { mutableStateOf(mulaiAwal?.toLocalTime() ?: LocalTime.of(9, 0)) }
    var jamSelesai by remember { mutableStateOf(if (awal?.seharian == false) selesaiAwal?.toLocalTime() else null) }
    var lokasi by remember { mutableStateOf(awal?.lokasi ?: "") }
    var catatan by remember { mutableStateOf(awal?.catatan ?: "") }
    var sibuk by remember { mutableStateOf(false) }
    var pesan by remember { mutableStateOf<String?>(null) }
    var yakinHapus by remember { mutableStateOf(false) }

    fun pilihTanggal(nilai: LocalDate, pakai: (LocalDate) -> Unit) =
        DatePickerDialog(konteks, { _, y, m, d -> pakai(LocalDate.of(y, m + 1, d)) }, nilai.year, nilai.monthValue - 1, nilai.dayOfMonth).show()

    fun pilihJam(nilai: LocalTime, pakai: (LocalTime) -> Unit) =
        TimePickerDialog(konteks, { _, j, m -> pakai(LocalTime.of(j, m)) }, nilai.hour, nilai.minute, true).show()

    fun jalankan(aksi: suspend () -> Unit) {
        sibuk = true
        pesan = null
        cakupan.launch {
            try {
                aksi()
                tutup()
            } catch (e: Exception) {
                pesan = e.message ?: "Gagal."
            }
            sibuk = false
        }
    }

    AlertDialog(
        onDismissRequest = { if (!sibuk) tutup() },
        title = { Text(if (awal == null) "Tambah acara" else "Ubah acara") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(judul, { judul = it }, label = { Text("Judul") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Seharian", modifier = Modifier.weight(1f))
                    Switch(seharian, { seharian = it })
                }
                OutlinedButton(onClick = { pilihTanggal(tanggal) { tanggal = it } }, modifier = Modifier.fillMaxWidth()) { Text(namaTanggal(tanggal)) }
                if (seharian) {
                    OutlinedButton(onClick = { pilihTanggal(tanggalAkhir ?: tanggal) { tanggalAkhir = it } }, modifier = Modifier.fillMaxWidth()) {
                        Text("Sampai: ${tanggalAkhir?.let(::namaTanggal) ?: "hari yang sama"}")
                    }
                } else {
                    Row {
                        OutlinedButton(onClick = { pilihJam(jamMulai) { jamMulai = it } }, modifier = Modifier.weight(1f)) { Text("Mulai ${jamMulai.format(JAM)}") }
                        Spacer(Modifier.width(8.dp))
                        OutlinedButton(onClick = { pilihJam(jamSelesai ?: jamMulai.plusHours(1)) { jamSelesai = it } }, modifier = Modifier.weight(1f)) {
                            Text("Selesai ${jamSelesai?.format(JAM) ?: "+1 jam"}")
                        }
                    }
                }
                OutlinedTextField(lokasi, { lokasi = it }, label = { Text("Lokasi (opsional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(catatan, { catatan = it }, label = { Text("Catatan (opsional)") }, modifier = Modifier.fillMaxWidth())
                if (awal?.berulang == true) Text("Acara berulang: perubahan hanya untuk kejadian ini.", color = Redup, fontSize = 12.sp)
                pesan?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (hapus != null) {
                    TextButton(onClick = { yakinHapus = true }, enabled = !sibuk) { Text("Hapus acara", color = MaterialTheme.colorScheme.error) }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !sibuk && judul.isNotBlank(),
                onClick = {
                    val m = MasukanAcara(
                        aksi = if (awal == null) "tambah" else "ubah",
                        id = awal?.id,
                        judul = judul,
                        seharian = seharian,
                        mulai = if (seharian) "$tanggal" else "${tanggal}T${jamMulai.format(JAM)}",
                        selesai = if (seharian) tanggalAkhir?.toString() else jamSelesai?.let { "${tanggal}T${it.format(JAM)}" },
                        lokasi = lokasi,
                        catatan = catatan,
                    )
                    jalankan { simpan(m) }
                },
            ) { Text(if (sibuk) "Menyimpan…" else "Simpan") }
        },
        dismissButton = { TextButton(onClick = tutup, enabled = !sibuk) { Text("Batal") } },
    )

    if (yakinHapus && hapus != null) {
        AlertDialog(
            onDismissRequest = { yakinHapus = false },
            title = { Text("Hapus acara?") },
            text = { Text("\"$judul\" juga dihapus dari Google Calendar.") },
            confirmButton = { TextButton(onClick = { yakinHapus = false; jalankan(hapus) }) { Text("Hapus") } },
            dismissButton = { TextButton(onClick = { yakinHapus = false }) { Text("Batal") } },
        )
    }
}
