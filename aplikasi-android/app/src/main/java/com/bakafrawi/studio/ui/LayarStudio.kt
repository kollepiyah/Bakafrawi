package com.bakafrawi.studio.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.net.toUri
import com.bakafrawi.studio.WIB
import com.bakafrawi.studio.data.Api
import com.bakafrawi.studio.data.DataRiset
import com.bakafrawi.studio.data.DataSambungan
import com.bakafrawi.studio.data.JadwalRutinData
import com.bakafrawi.studio.data.MerekStudio
import com.bakafrawi.studio.data.ProdukRingkas
import com.bakafrawi.studio.data.TugasStudio
import com.bakafrawi.studio.data.UsulanArahan
import com.bakafrawi.studio.jamWib
import com.bakafrawi.studio.namaTanggal
import com.bakafrawi.studio.tanggalWib
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZonedDateTime
import java.util.Locale

private enum class SubStudio(val label: String) {
    Unggah("Unggah"),
    Rutin("Story Otomatis"),
    Buat("Buat AI"),
    Riwayat("Riwayat"),
    Riset("Riset"),
    Sambungan("Sambungan"),
}

private val PRESET_VIDEO = listOf(
    "otomatis" to "Otomatis",
    "story-drop" to "Story Drop",
    "dial-menu" to "Dial Menu",
    "sinematik-kafe" to "Sinematik Kafe",
    "clean-ui" to "Clean UI + Maskot",
    "dark-keynote" to "Dark Keynote",
    "pov-chat" to "POV / Chat WA",
)

private val PRESET_POSTER = listOf(
    "otomatis" to "Otomatis",
    "modern-clean" to "Modern Clean",
    "before-after" to "Before vs After",
    "bold-typo" to "Bold Typography",
    "photo-floating" to "Foto AI + UI",
)

private val SASARAN_VIDEO = listOf(
    "reels" to "Reels",
    "story" to "Story saja",
    "reels+story" to "Reels + Story",
)

private val SASARAN_GAMBAR = listOf(
    "story" to "Story saja",
    "feed+story" to "Feed + Story",
    "feed" to "Feed saja",
)

private data class BerkasTerpilih(
    val uri: Uri,
    val nama: String,
    val ukuranByte: Long,
    val adalahGambar: Boolean,
)

private fun bacaMetaBerkas(konteks: Context, uri: Uri): BerkasTerpilih {
    var nama = "media.mp4"
    var ukuran = 0L
    konteks.contentResolver.query(uri, null, null, null, null)?.use { c ->
        val idxNama = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val idxUkuran = c.getColumnIndex(OpenableColumns.SIZE)
        if (c.moveToFirst()) {
            if (idxNama >= 0) c.getString(idxNama)?.let { if (it.isNotBlank()) nama = it }
            if (idxUkuran >= 0) ukuran = c.getLong(idxUkuran)
        }
    }
    val mime = konteks.contentResolver.getType(uri).orEmpty()
    val adalahGambar = mime.startsWith("image/") ||
        nama.lowercase(Locale.ROOT).let { it.endsWith(".jpg") || it.endsWith(".jpeg") || it.endsWith(".png") }
    return BerkasTerpilih(uri = uri, nama = nama, ukuranByte = ukuran, adalahGambar = adalahGambar)
}

private suspend fun bacaBytesBerkas(konteks: Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
    konteks.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        ?: throw IllegalStateException("Gagal membaca berkas dari penyimpanan HP.")
}

@Composable
fun LayarStudio(
    api: Api,
    muatUlang: Int,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
) {
    var sub by remember { mutableStateOf(SubStudio.Unggah) }
    var daftarMerek by remember { mutableStateOf<List<MerekStudio>>(emptyList()) }
    var daftarProduk by remember { mutableStateOf<List<ProdukRingkas>>(emptyList()) }
    var daftarTugas by remember { mutableStateOf<List<TugasStudio>?>(null) }
    var arahanBawaan by remember { mutableStateOf("") }
    var segarkanTugas by remember { mutableStateOf(0) }

    LaunchedEffect(muatUlang) {
        try {
            daftarMerek = api.daftarMerekStudio().ifEmpty {
                listOf(MerekStudio("bakafrawi", "Bakafrawi", true, false))
            }
            daftarProduk = api.daftarProdukSitus()
            daftarTugas = api.daftarTugasStudio()
        } catch (e: Exception) {
            galat(e)
        }
    }

    LaunchedEffect(segarkanTugas) {
        if (segarkanTugas > 0) {
            try {
                daftarTugas = api.daftarTugasStudio()
            } catch (e: Exception) {
                galat(e)
            }
        }
    }

    // Auto-refresh riwayat setiap 12 detik bila ada tugas sedang berjalan
    val adaProses = daftarTugas?.any {
        it.status == "antre" || it.status == "proses" || it.statusTayang == "antre" || it.statusTayang == "proses"
    } == true
    LaunchedEffect(adaProses, sub) {
        if (adaProses && sub == SubStudio.Riwayat) {
            while (true) {
                delay(12_000)
                runCatching { daftarTugas = api.daftarTugasStudio() }
            }
        }
    }

    val merekAktif = daftarMerek.filter { it.aktif }.ifEmpty { daftarMerek }

    Column(Modifier.fillMaxSize()) {
        // Bar sub-menu horizontal (seragam dengan Studio Web/PWA)
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SubStudio.entries.forEach { s ->
                FilterChip(
                    selected = sub == s,
                    onClick = { sub = s },
                    label = {
                        val badge = if (s == SubStudio.Riwayat && (daftarTugas?.isNotEmpty() == true)) {
                            " (${daftarTugas!!.size})"
                        } else ""
                        Text("${s.label}$badge", fontSize = 13.sp)
                    },
                )
            }
        }

        Box(Modifier.weight(1f)) {
            when (sub) {
                SubStudio.Unggah -> TabUnggahManual(
                    api = api,
                    merek = merekAktif,
                    kabar = kabar,
                    galat = galat,
                    selesaiUnggah = {
                        segarkanTugas++
                        sub = SubStudio.Riwayat
                    },
                )
                SubStudio.Rutin -> TabStoryOtomatis(
                    api = api,
                    merekDaftar = daftarMerek,
                    kabar = kabar,
                    galat = galat,
                )
                SubStudio.Buat -> TabBuatKonten(
                    api = api,
                    merek = merekAktif,
                    produk = daftarProduk,
                    arahanAwal = arahanBawaan,
                    kabar = kabar,
                    galat = galat,
                    selesaiBuat = {
                        arahanBawaan = ""
                        segarkanTugas++
                        sub = SubStudio.Riwayat
                    },
                )
                SubStudio.Riwayat -> TabRiwayatStudio(
                    api = api,
                    daftar = daftarTugas,
                    segarkan = { segarkanTugas++ },
                    kabar = kabar,
                    galat = galat,
                )
                SubStudio.Riset -> TabRisetViral(
                    api = api,
                    merek = merekAktif,
                    produk = daftarProduk,
                    kabar = kabar,
                    galat = galat,
                    pakaiArahan = { teks ->
                        arahanBawaan = teks
                        sub = SubStudio.Buat
                    },
                )
                SubStudio.Sambungan -> TabSambunganStudio(
                    api = api,
                    kabar = kabar,
                    galat = galat,
                )
            }
        }
    }
}

// ================================ 1. UNGGAH MANUAL & JADWAL ================================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TabUnggahManual(
    api: Api,
    merek: List<MerekStudio>,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
    selesaiUnggah: () -> Unit,
) {
    val konteks = LocalContext.current
    val cakupan = rememberCoroutineScope()

    var pilihMerek by remember(merek) { mutableStateOf(merek.firstOrNull()?.slug ?: "lekkopi") }
    var berkas by remember { mutableStateOf<BerkasTerpilih?>(null) }
    var judul by remember { mutableStateOf("") }
    var caption by remember { mutableStateOf("") }
    var sasaran by remember { mutableStateOf("reels") }
    var modeTayang by remember { mutableStateOf("jadwal") } // jadwal | sekarang | draf
    var tglJadwal by remember { mutableStateOf(LocalDate.now(WIB).toString()) }
    var jamJadwal by remember { mutableStateOf("19:00") }
    var sibuk by remember { mutableStateOf(false) }

    val pemilih = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            val meta = bacaMetaBerkas(konteks, uri)
            if (meta.ukuranByte > 95L * 1024L * 1024L) {
                kabar("Ukuran berkas melebihi 95 MB. Kompres dulu agar diterima Instagram.")
                return@rememberLauncherForActivityResult
            }
            berkas = meta
            sasaran = if (meta.adalahGambar) "story" else "reels"
            if (judul.isBlank()) {
                judul = meta.nama.substringBeforeLast('.').replace(Regex("[-_]+"), " ").trim()
            }
        }
    }

    val daftarSasaran = if (berkas?.adalahGambar == true) SASARAN_GAMBAR else SASARAN_VIDEO

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (merek.size > 1) {
            item {
                KartuStudio("Akun / Merek Tujuan") {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        merek.forEach { m ->
                            FilterChip(
                                selected = pilihMerek == m.slug,
                                onClick = { pilihMerek = m.slug },
                                label = { Text(m.nama) },
                            )
                        }
                    }
                }
            }
        }

        item {
            KartuStudio("Pilih Video / Foto dari HP") {
                Text(
                    "Unggah video edit sendiri untuk tayang otomatis ke Instagram Story maupun Reels.",
                    color = Redup,
                    fontSize = 12.sp,
                )
                OutlinedButton(
                    onClick = { pemilih.launch(arrayOf("video/*", "image/*")) },
                    enabled = !sibuk,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (berkas == null) "Pilih Video / Foto dari Galeri" else "Ganti Berkas Media")
                }
                berkas?.let { b ->
                    val mb = if (b.ukuranByte > 0) String.format(Locale.US, " · %.1f MB", b.ukuranByte / 1_048_576.0) else ""
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .background(Color(0x14FFFFFF), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            (if (b.adalahGambar) "FOTO" else "VIDEO") + mb,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = EmasMuda,
                        )
                        Text(b.nama, fontSize = 13.sp, maxLines = 2)
                    }
                }
                OutlinedTextField(
                    value = judul,
                    onValueChange = { judul = it },
                    label = { Text("Judul catatan (di Riwayat)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
            }
        }

        item {
            KartuStudio("Sasaran & Caption") {
                Text("Tayang ke mana?", color = Redup, fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    daftarSasaran.forEach { (kode, label) ->
                        FilterChip(
                            selected = sasaran == kode,
                            onClick = { sasaran = kode },
                            label = { Text(label, fontSize = 12.sp) },
                        )
                    }
                }
                if (sasaran != "story") {
                    OutlinedTextField(
                        value = caption,
                        onValueChange = { caption = it },
                        label = { Text("Caption & hashtag (opsional)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                    )
                }
            }
        }

        item {
            KartuStudio("Waktu Tayang (WIB)") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = modeTayang == "jadwal", onClick = { modeTayang = "jadwal" }, label = { Text("Jadwalkan") })
                    FilterChip(selected = modeTayang == "sekarang", onClick = { modeTayang = "sekarang" }, label = { Text("Tayang Sekarang") })
                    FilterChip(selected = modeTayang == "draf", onClick = { modeTayang = "draf" }, label = { Text("Simpan Draf") })
                }
                if (modeTayang == "jadwal") {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("09:00", "12:00", "14:00", "19:00", "20:30").forEach { jm ->
                            FilterChip(
                                selected = jamJadwal == jm,
                                onClick = { jamJadwal = jm },
                                label = { Text(jm, fontSize = 12.sp) },
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = tglJadwal,
                            onValueChange = { tglJadwal = it },
                            label = { Text("Tanggal (YYYY-MM-DD)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = jamJadwal,
                            onValueChange = { jamJadwal = it },
                            label = { Text("Jam WIB") },
                            modifier = Modifier.weight(0.65f),
                            singleLine = true,
                        )
                    }
                }
            }
        }

        item {
            Button(
                onClick = {
                    val b = berkas
                    if (b == null) {
                        kabar("Pilih berkas video atau foto terlebih dahulu.")
                        return@Button
                    }
                    val jadwalWib = if (modeTayang == "jadwal") {
                        val valid = hitungJadwalIso("custom", tglJadwal, jamJadwal)
                        if (valid == null) {
                            kabar("Tanggal/jam jadwal salah atau sudah lewat (gunakan YYYY-MM-DD & HH:MM WIB).")
                            return@Button
                        }
                        "${tglJadwal.trim()}T${jamJadwal.trim()}"
                    } else null

                    sibuk = true
                    cakupan.launch {
                        try {
                            val bytes = bacaBytesBerkas(konteks, b.uri)
                            val pesan = api.unggahKontenManual(
                                merek = pilihMerek,
                                namaBerkas = b.nama,
                                bytes = bytes,
                                adalahGambar = b.adalahGambar,
                                judul = judul.trim(),
                                caption = caption.trim(),
                                sasaran = sasaran,
                                modeTayang = modeTayang,
                                jadwalWib = jadwalWib,
                            )
                            kabar(pesan)
                            berkas = null
                            judul = ""
                            caption = ""
                            selesaiUnggah()
                        } catch (e: Exception) {
                            galat(e)
                        } finally {
                            sibuk = false
                        }
                    }
                },
                enabled = !sibuk && berkas != null,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                if (sibuk) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        Text("Mengunggah…")
                    }
                } else {
                    Text(
                        when (modeTayang) {
                            "sekarang" -> "Unggah & Tayangkan Sekarang"
                            "jadwal" -> "Unggah & Jadwalkan Tayang"
                            else -> "Unggah & Simpan Draf"
                        },
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ================================ 2. STORY OTOMATIS HARIAN ================================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TabStoryOtomatis(
    api: Api,
    merekDaftar: List<MerekStudio>,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
) {
    val konteks = LocalContext.current
    val cakupan = rememberCoroutineScope()

    var merek by remember { mutableStateOf("lekkopi") }
    var data by remember { mutableStateOf<JadwalRutinData?>(null) }
    var sibuk by remember { mutableStateOf(false) }
    var mengunggah by remember { mutableStateOf(false) }

    fun muat() {
        cakupan.launch {
            try {
                data = api.bacaRutin(merek)
            } catch (e: Exception) {
                galat(e)
            }
        }
    }

    LaunchedEffect(merek) { muat() }

    val pemilihVideo = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val dSaat = data ?: return@rememberLauncherForActivityResult
        if (uri == null) return@rememberLauncherForActivityResult
        val meta = bacaMetaBerkas(konteks, uri)
        if (meta.ukuranByte > 95L * 1024L * 1024L) {
            kabar("Ukuran berkas melebihi 95 MB.")
            return@rememberLauncherForActivityResult
        }
        mengunggah = true
        cakupan.launch {
            try {
                val bytes = bacaBytesBerkas(konteks, meta.uri)
                val itemBaru = api.unggahVideoRutin(merek, meta.nama, bytes, meta.adalahGambar)
                val terbaru = dSaat.copy(video = dSaat.video + itemBaru)
                kabar(api.simpanRutin(merek, terbaru))
                data = api.bacaRutin(merek)
            } catch (e: Exception) {
                galat(e)
            } finally {
                mengunggah = false
            }
        }
    }

    val d = data ?: return Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Emas)
    }

    val namaHari = listOf(1 to "Sen", 2 to "Sel", 3 to "Rab", 4 to "Kam", 5 to "Jum", 6 to "Sab", 0 to "Ahd")
    val jumlahAktif = d.video.count { it.aktif }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            KartuStudio("Story Otomatis Harian") {
                if (merekDaftar.size > 1) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        merekDaftar.forEach { m ->
                            FilterChip(selected = merek == m.slug, onClick = { merek = m.slug }, label = { Text(m.nama) })
                        }
                    }
                }

                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text("Jadwal otomatis aktif", fontWeight = FontWeight.Medium)
                        Text("Tayang Story otomatis tiap hari buka di jam WIB terpilih.", color = Redup, fontSize = 12.sp)
                    }
                    Switch(checked = d.aktif, onCheckedChange = { data = d.copy(aktif = it) })
                }

                if (d.aktif && !d.berikutnya.isNullOrBlank()) {
                    val t = runCatching { "${namaTanggal(tanggalWib(d.berikutnya))} ${jamWib(d.berikutnya)} WIB" }.getOrDefault(d.berikutnya)
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .background(Color(0x1A10B981), RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text("Tayang berikutnya: $t", color = Color(0xFF6EE7B7), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        if (d.mode == "acak" && !d.videoBerikutnyaJudul.isNullOrBlank()) {
                            Text("Pilihan acak berikutnya: ${d.videoBerikutnyaJudul}", color = EmasMuda, fontSize = 12.sp)
                            if (jumlahAktif > 1) {
                                TextButton(
                                    onClick = {
                                        sibuk = true
                                        cakupan.launch {
                                            try {
                                                kabar(api.aksiRutin(merek, "acak-ulang"))
                                                data = api.bacaRutin(merek)
                                            } catch (e: Exception) {
                                                galat(e)
                                            } finally {
                                                sibuk = false
                                            }
                                        }
                                    },
                                    enabled = !sibuk,
                                    contentPadding = PaddingValues(0.dp),
                                ) { Text("Acak Ulang Video Berikutnya →", color = Emas, fontSize = 12.sp) }
                            }
                        }
                    }
                }
            }
        }

        item {
            KartuStudio("Mode Putar & Waktu Tayang") {
                Text("Mode koleksi video", color = Redup, fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    FilterChip(selected = d.mode == "acak", onClick = { data = d.copy(mode = "acak") }, label = { Text("Acak 1 Video/Hari") })
                    FilterChip(selected = d.mode == "wajib+bergilir", onClick = { data = d.copy(mode = "wajib+bergilir") }, label = { Text("Wajib + Bergilir") })
                    FilterChip(selected = d.mode == "semua", onClick = { data = d.copy(mode = "semua") }, label = { Text("Semua Aktif") })
                }
                Text(
                    when (d.mode) {
                        "acak" -> "Setiap hari diundi 1 video acak dari semua video aktif. Tidak mengulang kemarin sampai semua kebagian."
                        "wajib+bergilir" -> "Video wajib selalu tayang + 1 video pendamping bergantian per hari."
                        else -> "Semua video aktif tayang sekaligus setiap jam buka."
                    },
                    color = Redup,
                    fontSize = 11.sp,
                )

                Text("Jam tayang (WIB)", color = Redup, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    FilterChip(selected = d.jam == "09:00", onClick = { data = d.copy(jam = "09:00") }, label = { Text("09:00") })
                    FilterChip(selected = d.jam == "14:00", onClick = { data = d.copy(jam = "14:00") }, label = { Text("14:00") })
                    OutlinedTextField(
                        value = d.jam,
                        onValueChange = { data = d.copy(jam = it) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        label = { Text("HH:MM") },
                    )
                }

                Text("Hari aktif", color = Redup, fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    namaHari.forEach { (kode, label) ->
                        val aktifHari = d.hari.contains(kode)
                        FilterChip(
                            selected = aktifHari,
                            onClick = {
                                val baru = if (aktifHari) d.hari - kode else d.hari + kode
                                data = d.copy(hari = baru)
                            },
                            label = { Text(label, fontSize = 12.sp) },
                        )
                    }
                }
            }
        }

        item {
            KartuStudio("Koleksi Video Story ($jumlahAktif aktif / ${d.video.size})") {
                OutlinedButton(
                    onClick = { pemilihVideo.launch(arrayOf("video/*", "image/*")) },
                    enabled = !mengunggah && !sibuk,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (mengunggah) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            Text("Mengunggah video…")
                        }
                    } else {
                        Text("+ Unggah Video / Foto Story dari HP")
                    }
                }

                if (d.video.isEmpty()) {
                    Text("Belum ada video di koleksi. Unggah beberapa video agar bisa diacak tiap hari.", color = Redup, fontSize = 12.sp)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        d.video.forEachIndexed { idx, v ->
                            val terpilih = d.mode == "acak" && d.videoBerikutnyaId == v.id
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .background(if (terpilih) Emas.copy(alpha = 0.14f) else Color(0x10FFFFFF), RoundedCornerShape(10.dp))
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(v.judul, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                                    val info = buildList {
                                        add(v.sasaran.uppercase())
                                        v.durasi?.let { add("${it} dtk") }
                                        if (terpilih) add("Berikutnya")
                                    }.joinToString(" · ")
                                    Text(info, fontSize = 11.sp, color = if (terpilih) EmasMuda else Redup)
                                }
                                Switch(
                                    checked = v.aktif,
                                    onCheckedChange = { aktifBaru ->
                                        data = d.copy(
                                            video = d.video.mapIndexed { i, x -> if (i == idx) x.copy(aktif = aktifBaru) else x },
                                        )
                                    },
                                )
                                TextButton(
                                    onClick = { data = d.copy(video = d.video.filterIndexed { i, _ -> i != idx }) },
                                    contentPadding = PaddingValues(horizontal = 6.dp),
                                ) { Text("Hapus", color = MaterialTheme.colorScheme.error, fontSize = 11.sp) }
                            }
                        }
                    }
                }

                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text("Sertakan Konten Opening AI (opsional)", fontSize = 13.sp, fontWeight = FontWeight.Medium)
                        Text("Buat tambahan animasi/poster otomatis tiap hari buka.", color = Redup, fontSize = 11.sp)
                    }
                    Switch(checked = d.aiAktif, onCheckedChange = { data = d.copy(aiAktif = it) })
                }

                if (d.aiAktif) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = d.aiFormat == "video-animasi", onClick = { data = d.copy(aiFormat = "video-animasi") }, label = { Text("Video Animasi") })
                        FilterChip(selected = d.aiFormat == "poster", onClick = { data = d.copy(aiFormat = "poster") }, label = { Text("Poster Story") })
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("otomatis" to "Auto", "hangat-kafe" to "Hangat", "terang-modern" to "Terang", "minimalis-gelap" to "Gelap").forEach { (k, l) ->
                            FilterChip(selected = d.aiGaya == k, onClick = { data = d.copy(aiGaya = k) }, label = { Text(l, fontSize = 12.sp) })
                        }
                    }
                }
            }
        }

        item {
            Button(
                onClick = {
                    sibuk = true
                    cakupan.launch {
                        try {
                            kabar(api.simpanRutin(merek, d))
                            data = api.bacaRutin(merek)
                        } catch (e: Exception) {
                            galat(e)
                        } finally {
                            sibuk = false
                        }
                    }
                },
                enabled = !sibuk && !mengunggah,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                if (sibuk) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text("Simpan Pengaturan Story Otomatis")
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        sibuk = true
                        cakupan.launch {
                            try { kabar(api.aksiRutin(merek, "tayang-sekarang")) } catch (e: Exception) { galat(e) } finally { sibuk = false }
                        }
                    },
                    enabled = !sibuk && (d.aiAktif || jumlahAktif > 0),
                    modifier = Modifier.weight(1f),
                ) { Text("Tayang 1 Story Kini", fontSize = 12.sp) }

                if (d.aiAktif) {
                    OutlinedButton(
                        onClick = {
                            sibuk = true
                            cakupan.launch {
                                try { kabar(api.aksiRutin(merek, "pratinjau")) } catch (e: Exception) { galat(e) } finally { sibuk = false }
                            }
                        },
                        enabled = !sibuk,
                        modifier = Modifier.weight(1f),
                    ) { Text("Pratinjau AI", fontSize = 12.sp) }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ================================ 3. BUAT KONTEN AI ================================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TabBuatKonten(
    api: Api,
    merek: List<MerekStudio>,
    produk: List<ProdukRingkas>,
    arahanAwal: String,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
    selesaiBuat: () -> Unit,
) {
    var pilihMerek by remember(merek) { mutableStateOf(merek.firstOrNull()?.slug ?: "bakafrawi") }
    var jenis by remember { mutableStateOf("video") }
    var pilihProduk by remember(produk) { mutableStateOf(produk.firstOrNull()?.slug ?: "maktaba-pos") }
    var gaya by remember { mutableStateOf("otomatis") }
    var latarAi by remember { mutableStateOf(false) }
    var sasaran by remember { mutableStateOf("otomatis") }
    var modeJadwal by remember { mutableStateOf("draf") }
    var tglCustom by remember { mutableStateOf(LocalDate.now(WIB).toString()) }
    var jamCustom by remember { mutableStateOf("19:00") }
    var arahan by remember(arahanAwal) { mutableStateOf(arahanAwal) }

    var usulan by remember { mutableStateOf<List<UsulanArahan>>(emptyList()) }
    var sibukUsul by remember { mutableStateOf(false) }
    var sibukBuat by remember { mutableStateOf(false) }
    val cakupan = rememberCoroutineScope()

    val objekMerek = merek.find { it.slug == pilihMerek }
    val adalahBank = objekMerek?.adalahBank == true
    val daftarPreset = if (adalahBank || jenis == "video") PRESET_VIDEO else PRESET_POSTER
    val daftarSasaran = listOf("otomatis" to "Bawaan") + (if (adalahBank || jenis == "video") SASARAN_VIDEO else SASARAN_GAMBAR)

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (merek.size > 1) {
            item {
                KartuStudio("Merek") {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        merek.forEach { m ->
                            FilterChip(
                                selected = pilihMerek == m.slug,
                                onClick = { pilihMerek = m.slug; usulan = emptyList() },
                                label = { Text(m.nama) },
                            )
                        }
                    }
                }
            }
        }

        if (!adalahBank) {
            item {
                KartuStudio("Jenis & Produk") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = jenis == "video", onClick = { jenis = "video"; gaya = "otomatis"; sasaran = "otomatis" }, label = { Text("Video Reels") })
                        FilterChip(selected = jenis == "gambar", onClick = { jenis = "gambar"; gaya = "otomatis"; sasaran = "otomatis" }, label = { Text("Poster / Feed") })
                    }
                    if (produk.isNotEmpty()) {
                        Text("Produk", color = Redup, fontSize = 12.sp)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            produk.forEach { p ->
                                FilterChip(
                                    selected = pilihProduk == p.slug,
                                    onClick = { pilihProduk = p.slug },
                                    label = { Text(p.nama, fontSize = 13.sp) },
                                )
                            }
                        }
                    }
                    if (jenis == "gambar") {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Latar foto AI (Cloudflare)", fontSize = 13.sp)
                            Switch(checked = latarAi, onCheckedChange = { latarAi = it })
                        }
                    }
                }
            }
        }

        item {
            KartuStudio("Gaya Visual & Sasaran Tayang") {
                Text("Gaya", color = Redup, fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    daftarPreset.forEach { (kode, label) ->
                        FilterChip(selected = gaya == kode, onClick = { gaya = kode }, label = { Text(label, fontSize = 12.sp) })
                    }
                }
                Text("Sasaran Instagram", color = Redup, fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    daftarSasaran.forEach { (kode, label) ->
                        FilterChip(selected = sasaran == kode, onClick = { sasaran = kode }, label = { Text(label, fontSize = 12.sp) })
                    }
                }
            }
        }

        item {
            KartuStudio("Arahan Konten") {
                OutlinedTextField(
                    value = arahan,
                    onValueChange = { arahan = it },
                    label = { Text("Tulis ide/pesan iklan…") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                )
                OutlinedButton(
                    onClick = {
                        sibukUsul = true
                        cakupan.launch {
                            try {
                                usulan = api.usulkanArahan(pilihMerek, pilihProduk, jenis)
                                if (usulan.isEmpty()) kabar("Belum ada usulan dari AI.")
                            } catch (e: Exception) {
                                galat(e)
                            } finally {
                                sibukUsul = false
                            }
                        }
                    },
                    enabled = !sibukUsul,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (sibukUsul) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    else Text("Usulkan Arahan AI")
                }
                if (usulan.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Ketuk salah satu ide untuk dipakai:", color = EmasMuda, fontSize = 12.sp)
                        usulan.forEach { u ->
                            Column(
                                Modifier
                                    .fillMaxWidth()
                                    .background(Color(0x14FFFFFF), RoundedCornerShape(10.dp))
                                    .clickable { arahan = u.arahan }
                                    .padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                            ) {
                                Text(u.judul, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = EmasMuda)
                                Text(u.arahan, fontSize = 12.sp, color = Redup)
                            }
                        }
                    }
                }
            }
        }

        item {
            KartuStudio("Jadwal Tayang") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = modeJadwal == "draf", onClick = { modeJadwal = "draf" }, label = { Text("Cek dulu (Draf)") })
                    FilterChip(selected = modeJadwal == "prime19", onClick = { modeJadwal = "prime19" }, label = { Text("Otomatis 19.00 WIB") })
                    FilterChip(selected = modeJadwal == "custom", onClick = { modeJadwal = "custom" }, label = { Text("Pilih jam") })
                }
                if (modeJadwal == "custom") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = tglCustom,
                            onValueChange = { tglCustom = it },
                            label = { Text("Tanggal (YYYY-MM-DD)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = jamCustom,
                            onValueChange = { jamCustom = it },
                            label = { Text("Jam WIB (HH:MM)") },
                            modifier = Modifier.weight(0.7f),
                            singleLine = true,
                        )
                    }
                }
            }
        }

        item {
            Button(
                onClick = {
                    val teks = arahan.trim()
                    if (teks.isBlank() && !adalahBank) {
                        kabar("Isi arahan konten dulu ya Kyai.")
                        return@Button
                    }
                    val jadwalIso = hitungJadwalIso(modeJadwal, tglCustom, jamCustom)
                    if (modeJadwal == "custom" && jadwalIso == null) {
                        kabar("Format tanggal/jam custom salah atau sudah lewat (gunakan YYYY-MM-DD & HH:MM WIB).")
                        return@Button
                    }
                    val prefiks = if (gaya != "otomatis") "[Gaya: $gaya] " else ""
                    sibukBuat = true
                    cakupan.launch {
                        try {
                            val pesan = api.buatTugasStudio(
                                merek = pilihMerek,
                                adalahBank = adalahBank,
                                jenis = jenis,
                                produkSlug = pilihProduk,
                                arahan = prefiks + teks,
                                latarAi = latarAi,
                                sasaran = sasaran,
                                jadwalIso = jadwalIso,
                            )
                            kabar(pesan)
                            selesaiBuat()
                        } catch (e: Exception) {
                            galat(e)
                        } finally {
                            sibukBuat = false
                        }
                    }
                },
                enabled = !sibukBuat,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) {
                if (sibukBuat) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text(if (adalahBank) "Buat Naskah Konten" else "Buat Konten Sekarang")
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

private fun hitungJadwalIso(mode: String, tgl: String, jam: String): String? {
    val sekarang = ZonedDateTime.now(WIB)
    return when (mode) {
        "prime19" -> {
            val targetHariIni = ZonedDateTime.of(sekarang.toLocalDate(), LocalTime.of(19, 0), WIB)
            val target = if (targetHariIni.isAfter(sekarang.plusMinutes(5))) targetHariIni else targetHariIni.plusDays(1)
            target.toInstant().toString()
        }
        "custom" -> runCatching {
            val d = LocalDate.parse(tgl.trim())
            val t = LocalTime.parse(jam.trim())
            val z = ZonedDateTime.of(LocalDateTime.of(d, t), WIB)
            if (z.isAfter(sekarang)) z.toInstant().toString() else null
        }.getOrNull()
        else -> null
    }
}

// ================================ 4. RIWAYAT TUGAS ================================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TabRiwayatStudio(
    api: Api,
    daftar: List<TugasStudio>?,
    segarkan: () -> Unit,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
) {
    val konteks = LocalContext.current
    val cakupan = rememberCoroutineScope()
    var filter by remember { mutableStateOf("semua") }
    var konfirmasiHapus by remember { mutableStateOf<TugasStudio?>(null) }
    var dialogJadwal by remember { mutableStateOf<TugasStudio?>(null) }
    var sibukId by remember { mutableStateOf<String?>(null) }

    if (daftar == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Emas)
        }
        return
    }

    val tersaring = daftar.filter { t ->
        when (filter) {
            "terjadwal" -> t.statusTayang == "dijadwalkan" || t.statusTayang == "antre"
            "cek" -> (t.status == "selesai" && t.statusTayang == "belum") || t.status == "naskah"
            "tayang" -> t.statusTayang == "tayang"
            else -> true
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FilterChip(selected = filter == "semua", onClick = { filter = "semua" }, label = { Text("Semua (${daftar.size})", fontSize = 12.sp) })
                FilterChip(
                    selected = filter == "terjadwal",
                    onClick = { filter = "terjadwal" },
                    label = { Text("Terjadwal (${daftar.count { it.statusTayang == "dijadwalkan" || it.statusTayang == "antre" }})", fontSize = 12.sp) },
                )
                FilterChip(
                    selected = filter == "cek",
                    onClick = { filter = "cek" },
                    label = { Text("Perlu Cek (${daftar.count { (it.status == "selesai" && it.statusTayang == "belum") || it.status == "naskah" }})", fontSize = 12.sp) },
                )
                FilterChip(
                    selected = filter == "tayang",
                    onClick = { filter = "tayang" },
                    label = { Text("Tayang (${daftar.count { it.statusTayang == "tayang" }})", fontSize = 12.sp) },
                )
            }
        }

        if (tersaring.isEmpty()) {
            item {
                Box(Modifier.fillMaxWidth().padding(vertical = 32.dp), contentAlignment = Alignment.Center) {
                    Text("Belum ada konten pada filter ini.", color = Redup)
                }
            }
        } else {
            items(tersaring, key = { it.id }) { t ->
                val sibuk = sibukId == t.id
                val labelSumber = when (t.produkSlug) {
                    "rutin-buka" -> "Story Otomatis"
                    "unggah-manual" -> "Unggah Manual"
                    else -> t.produkSlug.ifBlank { t.jenis }
                }
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(Kartu, RoundedCornerShape(16.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "${t.merek.uppercase()} · $labelSumber" + (t.sasaran?.takeIf { it != "otomatis" }?.let { " · ${it.uppercase()}" } ?: ""),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = EmasMuda,
                            modifier = Modifier.weight(1f),
                        )
                        LencanaStatus(t.status, t.statusTayang)
                    }

                    if (t.dibuat.isNotBlank()) {
                        val infoWaktu = runCatching { "${namaTanggal(tanggalWib(t.dibuat))} · ${jamWib(t.dibuat)} WIB" }.getOrDefault(t.dibuat)
                        Text(infoWaktu, color = Redup, fontSize = 11.sp)
                    }

                    if (t.arahan.isNotBlank()) {
                        Text(t.arahan, fontSize = 13.sp, maxLines = 3)
                    }

                    if (!t.galat.isNullOrBlank()) {
                        Text("Galat: ${t.galat}", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }

                    if (!t.jadwalTayang.isNullOrBlank()) {
                        val jadwalTeks = runCatching { "${namaTanggal(tanggalWib(t.jadwalTayang))} ${jamWib(t.jadwalTayang)} WIB" }.getOrDefault(t.jadwalTayang)
                        Text("Jadwal tayang: $jadwalTeks", color = Color(0xFF38BDF8), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    }

                    if (t.hasil.isNotEmpty()) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            t.hasil.forEachIndexed { idx, h ->
                                OutlinedButton(
                                    onClick = { konteks.startActivity(Intent(Intent.ACTION_VIEW, h.url.toUri())) },
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                ) {
                                    Text("Lihat ${h.jenis} ${h.rasio}" + if (t.hasil.size > 1) " #${idx + 1}" else "", fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    if (!t.permalink.isNullOrBlank()) {
                        TextButton(
                            onClick = { konteks.startActivity(Intent(Intent.ACTION_VIEW, t.permalink.toUri())) },
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Text("Buka postingan Instagram →", color = EmasMuda, fontSize = 12.sp)
                        }
                    }

                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (t.status == "naskah" && t.adaNaskah) {
                            Button(
                                onClick = {
                                    sibukId = t.id
                                    cakupan.launch {
                                        try { kabar(api.setujuiNaskah(t.id)); segarkan() } catch (e: Exception) { galat(e) } finally { sibukId = null }
                                    }
                                },
                                enabled = !sibuk,
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            ) { Text("Setujui Naskah", fontSize = 12.sp) }
                        }

                        if (t.status == "selesai" && t.statusTayang != "tayang" && t.statusTayang != "proses") {
                            if (t.statusTayang != "antre") {
                                Button(
                                    onClick = {
                                        sibukId = t.id
                                        cakupan.launch {
                                            try { kabar(api.aksiTayang(t.id, "sekarang")); segarkan() } catch (e: Exception) { galat(e) } finally { sibukId = null }
                                        }
                                    },
                                    enabled = !sibuk,
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                ) { Text("Tayangkan", fontSize = 12.sp) }
                            }

                            OutlinedButton(
                                onClick = { dialogJadwal = t },
                                enabled = !sibuk,
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            ) { Text(if (t.statusTayang == "dijadwalkan") "Ubah Jadwal" else "Jadwalkan…", fontSize = 12.sp) }
                        }

                        if (t.statusTayang == "dijadwalkan" || t.statusTayang == "antre") {
                            TextButton(
                                onClick = {
                                    sibukId = t.id
                                    cakupan.launch {
                                        try { kabar(api.aksiTayang(t.id, "batal")); segarkan() } catch (e: Exception) { galat(e) } finally { sibukId = null }
                                    }
                                },
                                enabled = !sibuk,
                            ) { Text("Batal Tayang", fontSize = 12.sp) }
                        }

                        if (!t.caption.isNullOrBlank()) {
                            OutlinedButton(
                                onClick = {
                                    val cm = konteks.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    cm.setPrimaryClip(ClipData.newPlainText("Caption", t.caption))
                                    kabar("Caption disalin ke clipboard.")
                                },
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            ) { Text("Salin Caption", fontSize = 12.sp) }
                        }

                        if ((t.status == "selesai" || t.status == "gagal") && t.produkSlug != "rutin-buka" && t.produkSlug != "unggah-manual") {
                            TextButton(
                                onClick = {
                                    sibukId = t.id
                                    cakupan.launch {
                                        try { kabar(api.aksiTayang(t.id, "ulang")); segarkan() } catch (e: Exception) { galat(e) } finally { sibukId = null }
                                    }
                                },
                                enabled = !sibuk,
                            ) { Text("Buat Ulang", fontSize = 12.sp) }
                        }

                        TextButton(
                            onClick = { konfirmasiHapus = t },
                            enabled = !sibuk,
                        ) { Text("Hapus", color = MaterialTheme.colorScheme.error, fontSize = 12.sp) }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }

    dialogJadwal?.let { target ->
        var tgl by remember(target.id) {
            mutableStateOf(
                target.jadwalTayang?.let { runCatching { tanggalWib(it).toString() }.getOrNull() } ?: LocalDate.now(WIB).toString(),
            )
        }
        var jam by remember(target.id) {
            mutableStateOf(
                target.jadwalTayang?.let { runCatching { jamWib(it) }.getOrNull() } ?: "19:00",
            )
        }
        var sasaranPilih by remember(target.id) { mutableStateOf(target.sasaran ?: "otomatis") }
        val daftarSas = listOf("otomatis" to "Bawaan") + (if (target.jenis == "gambar") SASARAN_GAMBAR else SASARAN_VIDEO)

        AlertDialog(
            onDismissRequest = { dialogJadwal = null },
            title = { Text("Jadwalkan Tayang (WIB)") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("09:00", "14:00", "19:00", "20:30").forEach { jm ->
                            FilterChip(selected = jam == jm, onClick = { jam = jm }, label = { Text(jm, fontSize = 11.sp) })
                        }
                    }
                    OutlinedTextField(value = tgl, onValueChange = { tgl = it }, label = { Text("Tanggal (YYYY-MM-DD)") }, singleLine = true)
                    OutlinedTextField(value = jam, onValueChange = { jam = it }, label = { Text("Jam WIB (HH:MM)") }, singleLine = true)
                    Text("Sasaran Instagram", color = Redup, fontSize = 12.sp)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        daftarSas.forEach { (k, l) ->
                            FilterChip(selected = sasaranPilih == k, onClick = { sasaranPilih = k }, label = { Text(l, fontSize = 11.sp) })
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    val iso = hitungJadwalIso("custom", tgl, jam)
                    if (iso == null) {
                        kabar("Tanggal/jam salah atau sudah lewat (WIB).")
                        return@Button
                    }
                    val jadwalWib = "${tgl.trim()}T${jam.trim()}"
                    dialogJadwal = null
                    sibukId = target.id
                    cakupan.launch {
                        try {
                            kabar(api.aksiTayang(target.id, "jadwal", jadwalIso = jadwalWib, sasaran = sasaranPilih))
                            segarkan()
                        } catch (e: Exception) {
                            galat(e)
                        } finally {
                            sibukId = null
                        }
                    }
                }) { Text("Simpan Jadwal") }
            },
            dismissButton = { TextButton(onClick = { dialogJadwal = null }) { Text("Batal") } },
        )
    }

    konfirmasiHapus?.let { target ->
        AlertDialog(
            onDismissRequest = { konfirmasiHapus = null },
            title = { Text("Hapus tugas konten?") },
            text = { Text("Riwayat tugas ini akan dihapus dari Studio.") },
            confirmButton = {
                TextButton(onClick = {
                    konfirmasiHapus = null
                    cakupan.launch {
                        try {
                            api.hapusTugasStudio(target.id)
                            kabar("Tugas dihapus.")
                            segarkan()
                        } catch (e: Exception) {
                            galat(e)
                        }
                    }
                }) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { konfirmasiHapus = null }) { Text("Batal") } },
        )
    }
}

@Composable
private fun LencanaStatus(status: String, tayang: String) {
    val teks = when {
        tayang == "tayang" -> "Tayang"
        tayang == "dijadwalkan" -> "Terjadwal"
        tayang == "antre" || tayang == "proses" -> "Menayangkan…"
        tayang == "ditolak" -> "Ditolak"
        status == "selesai" -> "Siap cek"
        status == "proses" -> "Diproses…"
        status == "antre" -> "Antre"
        status == "naskah" -> "Naskah"
        status == "gagal" -> "Gagal"
        else -> status
    }
    val warna = when {
        tayang == "tayang" -> Color(0xFF4ADE80)
        status == "gagal" || tayang == "gagal" -> Color(0xFFF87171)
        tayang == "dijadwalkan" -> Color(0xFF38BDF8)
        status == "selesai" -> EmasMuda
        else -> Redup
    }
    Text(
        teks,
        color = warna,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier
            .background(warna.copy(alpha = 0.14f), RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

// ================================ 5. RISET VIRAL ================================

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TabRisetViral(
    api: Api,
    merek: List<MerekStudio>,
    produk: List<ProdukRingkas>,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
    pakaiArahan: (String) -> Unit,
) {
    var pilihMerek by remember(merek) { mutableStateOf(merek.firstOrNull()?.slug ?: "bakafrawi") }
    var pilihProduk by remember(produk) { mutableStateOf(produk.firstOrNull()?.slug ?: "maktaba-pos") }
    var topik by remember { mutableStateOf("") }
    var hasil by remember { mutableStateOf<DataRiset?>(null) }
    var sibuk by remember { mutableStateOf(false) }
    val cakupan = rememberCoroutineScope()

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            KartuStudio("Riset Tren Reels Viral (AI)") {
                if (merek.size > 1) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        merek.forEach { m ->
                            FilterChip(selected = pilihMerek == m.slug, onClick = { pilihMerek = m.slug }, label = { Text(m.nama) })
                        }
                    }
                }
                if (pilihMerek != "lekkopi" && produk.isNotEmpty()) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        produk.forEach { p ->
                            FilterChip(selected = pilihProduk == p.slug, onClick = { pilihProduk = p.slug }, label = { Text(p.nama, fontSize = 12.sp) })
                        }
                    }
                }
                OutlinedTextField(
                    value = topik,
                    onValueChange = { topik = it },
                    label = { Text("Topik khusus (opsional)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Button(
                    onClick = {
                        sibuk = true
                        cakupan.launch {
                            try {
                                hasil = api.risetViral(pilihMerek, pilihProduk, topik)
                                kabar("Riset konsep selesai.")
                            } catch (e: Exception) {
                                galat(e)
                            } finally {
                                sibuk = false
                            }
                        }
                    },
                    enabled = !sibuk,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (sibuk) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Text("Jalankan Riset AI")
                }
            }
        }

        hasil?.let { r ->
            if (r.statusJadwal.isNotBlank() || r.daftarJamOptimal.isNotEmpty()) {
                item {
                    KartuStudio("Jam Optimal Tayang (WIB)") {
                        if (r.statusJadwal.isNotBlank()) Text(r.statusJadwal, color = EmasMuda, fontSize = 13.sp)
                        r.daftarJamOptimal.forEach { j -> Text("• $j", color = Redup, fontSize = 13.sp) }
                    }
                }
            }
            items(r.konsep) { k ->
                KartuStudio(k.judul) {
                    if (k.hook.isNotBlank()) Text("Hook: ${k.hook}", fontSize = 13.sp, color = EmasMuda)
                    if (k.ringkas.isNotBlank()) Text(k.ringkas, fontSize = 13.sp, color = Redup)
                    if (k.cta.isNotBlank()) Text("CTA: ${k.cta}", fontSize = 12.sp)
                    OutlinedButton(
                        onClick = {
                            val gabung = listOf(k.hook, k.ringkas, k.cta).filter { it.isNotBlank() }.joinToString(" — ")
                            pakaiArahan(gabung.ifBlank { k.judul })
                        },
                    ) { Text("Pakai ke Buat AI", fontSize = 12.sp) }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

// ================================ 6. SAMBUNGAN ================================

@Composable
private fun TabSambunganStudio(
    api: Api,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
) {
    var data by remember { mutableStateOf<DataSambungan?>(null) }
    var sibuk by remember { mutableStateOf(false) }
    val cakupan = rememberCoroutineScope()

    fun muat() {
        cakupan.launch {
            try { data = api.bacaSambungan() } catch (e: Exception) { galat(e) }
        }
    }

    LaunchedEffect(Unit) { muat() }

    val d = data ?: return Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Emas)
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!d.siap) {
            item { Text(d.pesan ?: "Pengaturan sambungan belum siap di server.", color = Redup) }
        } else {
            items(d.merek, key = { it.merek }) { m ->
                KartuStudio(m.nama) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Aktif di Studio", fontSize = 13.sp)
                        Switch(
                            checked = m.aktif,
                            enabled = m.merek != "bakafrawi" && !sibuk,
                            onCheckedChange = { v ->
                                sibuk = true
                                cakupan.launch {
                                    try { kabar(api.ubahAktifMerek(m.merek, v)); muat() } catch (e: Exception) { galat(e) } finally { sibuk = false }
                                }
                            },
                        )
                    }
                    Text("Instagram: ${m.igAkun ?: "Belum tersambung"}", color = if (m.igAkun != null) Color(0xFF4ADE80) else Redup, fontSize = 13.sp)
                    Text("TikTok: ${m.tiktokAkun ?: "Belum tersambung"}", color = if (m.tiktokAkun != null) Color(0xFF4ADE80) else Redup, fontSize = 13.sp)
                }
            }
            item {
                KartuStudio("Bot Telegram") {
                    Text(
                        if (d.telegramTerdaftar) "Terdaftar & siap menerima perintah / notifikasi." else "Belum terdaftar.",
                        color = if (d.telegramTerdaftar) Color(0xFF4ADE80) else Redup,
                        fontSize = 13.sp,
                    )
                    if (!d.telegramWebhook.isNullOrBlank()) {
                        Text("Webhook: ${d.telegramWebhook}", color = Redup, fontSize = 12.sp)
                    }
                    OutlinedButton(
                        onClick = {
                            sibuk = true
                            cakupan.launch {
                                try { kabar(api.pasangWebhookTelegram()); muat() } catch (e: Exception) { galat(e) } finally { sibuk = false }
                            }
                        },
                        enabled = !sibuk,
                    ) { Text("Pasang Ulang Webhook Telegram") }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun KartuStudio(judul: String, isi: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Kartu, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(judul, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        isi()
    }
}
