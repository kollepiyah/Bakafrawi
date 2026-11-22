package com.bakafrawi.studio.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DateRange
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.net.toUri
import com.bakafrawi.studio.BuildConfig
import com.bakafrawi.studio.WIB
import com.bakafrawi.studio.data.Acara
import com.bakafrawi.studio.data.Api
import com.bakafrawi.studio.data.DataDeck
import com.bakafrawi.studio.data.GalatApi
import com.bakafrawi.studio.data.RingkasAplikasi
import com.bakafrawi.studio.data.Ringkasan
import com.bakafrawi.studio.data.Sesi
import com.bakafrawi.studio.hariIniWib
import com.bakafrawi.studio.jamWib
import com.bakafrawi.studio.namaHari
import com.bakafrawi.studio.namaTanggal
import com.bakafrawi.studio.pembaruan.InfoRilis
import com.bakafrawi.studio.pembaruan.Pembaruan
import com.bakafrawi.studio.pengingat.Pengingat
import com.bakafrawi.studio.rentangJam
import com.bakafrawi.studio.tanggalWib
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale

// ---------------------------------------------------------------- masuk

@Composable
fun LayarMasuk(api: Api, berhasil: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var sandi by remember { mutableStateOf("") }
    var sibuk by remember { mutableStateOf(false) }
    var pesan by remember { mutableStateOf<String?>(null) }
    val cakupan = rememberCoroutineScope()

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(24.dp), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Bakafrawi Studio", fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = Emas)
            Text("Masuk dengan akun admin bakafrawi.com", color = Redup)
            OutlinedTextField(
                email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            OutlinedTextField(
                sandi, { sandi = it }, label = { Text("Kata sandi") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(
                onClick = {
                    sibuk = true
                    pesan = null
                    cakupan.launch {
                        try {
                            api.masuk(email, sandi)
                            berhasil()
                        } catch (e: Exception) {
                            pesan = e.message ?: "Gagal masuk."
                        }
                        sibuk = false
                    }
                },
                enabled = !sibuk && email.isNotBlank() && sandi.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) { if (sibuk) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Masuk") }
            pesan?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}

// ---------------------------------------------------------------- utama

private enum class Tab(val label: String) {
    Beranda("Beranda"),
    Aplikasi("Aplikasi"),
    Agenda("Agenda"),
    Konten("Konten"),
    Lainnya("Lainnya"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LayarUtama(api: Api, sesi: Sesi, keluar: () -> Unit) {
    var tab by remember { mutableStateOf(Tab.Beranda) }
    var bukaEditorSitus by remember { mutableStateOf(false) }
    var muatUlang by remember { mutableIntStateOf(0) }
    var form by remember { mutableStateOf<Acara?>(null) }
    var formBaru by remember { mutableStateOf(false) }

    // State Beranda, Deck, & Aplikasi disimpan di level LayarUtama agar tidak batal saat pindah tab
    var ringkasan by remember { mutableStateOf<Ringkasan?>(null) }
    var galatBeranda by remember { mutableStateOf<String?>(null) }

    var daftarAplikasi by remember { mutableStateOf<List<RingkasAplikasi>?>(null) }
    var memuatAplikasi by remember { mutableStateOf(false) }
    var galatAplikasi by remember { mutableStateOf<String?>(null) }

    var dataDeck by remember { mutableStateOf<DataDeck?>(null) }
    var memuatDeck by remember { mutableStateOf(false) }
    var galatDeck by remember { mutableStateOf<String?>(null) }

    // Pembaruan otomatis dari GitHub Releases
    var infoRilis by remember { mutableStateOf<InfoRilis?>(null) }
    var dialogRilis by remember { mutableStateOf<InfoRilis?>(null) }
    var dialogIzinPasang by remember { mutableStateOf(false) }
    var progresUnduh by remember { mutableStateOf<Int?>(null) }

    val snack = remember { SnackbarHostState() }
    val cakupan = rememberCoroutineScope()
    val konteks = LocalContext.current

    fun kabar(teks: String) = cakupan.launch { snack.showSnackbar(teks) }
    fun tanganiGalat(e: Exception) {
        if (e is CancellationException) return
        if (e is GalatApi && e.kode == 401) keluar() else kabar(e.message ?: "Gagal.")
    }

    fun muatBeranda() = cakupan.launch {
        galatBeranda = null
        try {
            val hasil = api.beranda()
            ringkasan = hasil
            Pengingat.pasang(konteks, hasil.acaraHariIni + hasil.acaraPekan)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            galatBeranda = e.message ?: "Gagal memuat beranda."
            tanganiGalat(e)
        }
    }

    fun muatAplikasi() = cakupan.launch {
        memuatAplikasi = true
        galatAplikasi = null
        try {
            daftarAplikasi = api.ringkasanAplikasi()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            galatAplikasi = e.message ?: "Gagal memuat ringkasan aplikasi."
            if (e is GalatApi && e.kode == 401) keluar()
        } finally {
            memuatAplikasi = false
        }
    }

    fun muatDeck() = cakupan.launch {
        memuatDeck = true
        galatDeck = null
        try {
            dataDeck = api.deck()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            galatDeck = e.message ?: "Gagal memuat status mesin."
            if (e is GalatApi && e.kode == 401) keluar()
        } finally {
            memuatDeck = false
        }
    }

    // Muat ketiganya secara PARALEL saat pertama dibuka & saat tombol refresh ditekan
    LaunchedEffect(muatUlang) {
        muatBeranda()
        muatDeck()
        muatAplikasi()
    }

    // Cek pembaruan diam-diam saat aplikasi dibuka
    LaunchedEffect(Unit) {
        runCatching { Pembaruan.cek() }.getOrNull()?.let { r ->
            if (r.lebihBaru) infoRilis = r
        }
    }

    fun mulaiPasang(rilis: InfoRilis) {
        if (!Pembaruan.bolehPasang(konteks)) {
            dialogIzinPasang = true
            return
        }
        progresUnduh = 0
        cakupan.launch {
            try {
                Pembaruan.unduhDanPasang(konteks, rilis.urlApk) { p -> progresUnduh = p }
                dialogRilis = null
            } catch (e: Exception) {
                kabar(e.message ?: "Gagal mengunduh pembaruan.")
            } finally {
                progresUnduh = null
            }
        }
    }

    if (bukaEditorSitus) {
        LayarEditorSitus(
            api = api,
            tutup = { bukaEditorSitus = false },
            kabar = ::kabar,
            galat = ::tanganiGalat,
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (tab == Tab.Beranda) "Bakafrawi Studio" else tab.label) },
                actions = {
                    if (tab != Tab.Lainnya) {
                        IconButton(onClick = { muatUlang++ }) { Icon(Icons.Outlined.Refresh, "Muat ulang") }
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t,
                        onClick = { tab = t },
                        icon = {
                            Icon(
                                when (t) {
                                    Tab.Beranda -> Icons.Outlined.Home
                                    Tab.Aplikasi -> Icons.AutoMirrored.Outlined.List
                                    Tab.Agenda -> Icons.Outlined.DateRange
                                    Tab.Konten -> Icons.Outlined.Star
                                    Tab.Lainnya -> Icons.Outlined.Settings
                                },
                                null,
                            )
                        },
                        label = { Text(t.label, fontSize = 11.sp, maxLines = 1) },
                    )
                }
            }
        },
        floatingActionButton = {
            if (tab == Tab.Agenda || tab == Tab.Beranda) {
                FloatingActionButton(onClick = { form = null; formBaru = true }, containerColor = Emas) {
                    Icon(Icons.Outlined.Add, "Tambah acara")
                }
            }
        },
        snackbarHost = { SnackbarHost(snack) },
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (tab) {
                Tab.Beranda -> LayarBeranda(
                    r = ringkasan,
                    galatBeranda = galatBeranda,
                    aplikasi = daftarAplikasi,
                    memuatAplikasi = memuatAplikasi,
                    galatAplikasi = galatAplikasi,
                    deck = dataDeck,
                    memuatDeck = memuatDeck,
                    galatDeck = galatDeck,
                    rilisBaru = infoRilis,
                    bukaDialogRilis = { dialogRilis = it },
                    cobaLagiBeranda = { muatBeranda() },
                    cobaLagiDeck = { muatDeck() },
                    cobaLagiAplikasi = { muatAplikasi() },
                    bukaAplikasi = { tab = Tab.Aplikasi },
                    bukaAgenda = { tab = Tab.Agenda },
                    bukaKonten = { tab = Tab.Konten },
                )
                Tab.Aplikasi -> LayarAplikasi(
                    daftar = daftarAplikasi,
                    sedangMemuat = memuatAplikasi,
                    pesanGalat = galatAplikasi,
                    cobaLagi = { muatAplikasi() },
                )
                Tab.Agenda -> LayarAgenda(api, muatUlang, ::tanganiGalat, ubah = { form = it; formBaru = false })
                Tab.Konten -> LayarStudio(api, muatUlang, ::kabar, ::tanganiGalat)
                Tab.Lainnya -> LayarLainnya(
                    sesi = sesi,
                    rilisTersedia = infoRilis,
                    bukaSitus = { bukaEditorSitus = true },
                    cekPembaruan = {
                        cakupan.launch {
                            try {
                                val r = Pembaruan.cek()
                                if (r == null) kabar("Belum ada rilis APK di GitHub.")
                                else if (r.lebihBaru) {
                                    infoRilis = r
                                    dialogRilis = r
                                } else {
                                    kabar("Aplikasi sudah versi terbaru (v${BuildConfig.VERSION_NAME}).")
                                }
                            } catch (e: Exception) {
                                kabar(e.message ?: "Gagal memeriksa pembaruan.")
                            }
                        }
                    },
                    bukaDialogRilis = { dialogRilis = it },
                    keluar = keluar,
                )
            }
        }
    }

    if (formBaru || form != null) {
        FormAcara(
            awal = form,
            tutup = { form = null; formBaru = false },
            simpan = { m ->
                val google = api.simpanAcara(m)
                kabar(if (google) "Tersimpan dan masuk Google Calendar." else "Tersimpan. Dikirim ke Google dalam ≤5 menit.")
                muatUlang++
            },
            hapus = form?.let { a ->
                {
                    api.hapusAcara(a.id)
                    kabar("Acara dihapus.")
                    muatUlang++
                }
            },
        )
    }

    // Dialog pembaruan APK
    dialogRilis?.let { r ->
        val ukuranMb = if (r.ukuranByte > 0) String.format(Locale.US, "%.2f MB", r.ukuranByte / 1_048_576.0) else ""
        AlertDialog(
            onDismissRequest = { if (progresUnduh == null) dialogRilis = null },
            title = { Text("Pembaruan v${r.versi} tersedia") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Versi sekarang: v${BuildConfig.VERSION_NAME}" + if (ukuranMb.isNotEmpty()) " · Ukuran: $ukuranMb" else "",
                        color = Redup,
                        fontSize = 13.sp,
                    )
                    if (r.catatan.isNotBlank()) {
                        Text(r.catatan, fontSize = 13.sp)
                    }
                    progresUnduh?.let { p ->
                        Spacer(Modifier.height(4.dp))
                        LinearProgressIndicator(progress = { p / 100f }, modifier = Modifier.fillMaxWidth())
                        Text("Mengunduh… $p%", color = EmasMuda, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { mulaiPasang(r) },
                    enabled = progresUnduh == null,
                ) { Text("Unduh & Pasang") }
            },
            dismissButton = {
                TextButton(
                    onClick = { dialogRilis = null },
                    enabled = progresUnduh == null,
                ) { Text("Nanti") }
            },
        )
    }

    if (dialogIzinPasang) {
        AlertDialog(
            onDismissRequest = { dialogIzinPasang = false },
            title = { Text("Izinkan pasang pembaruan") },
            text = { Text("Aktifkan izin \"Izinkan dari sumber ini\" untuk Bakafrawi Studio agar pembaruan APK bisa dipasang langsung.") },
            confirmButton = {
                Button(onClick = {
                    dialogIzinPasang = false
                    Pembaruan.bukaIzinPasang(konteks)
                }) { Text("Buka Pengaturan") }
            },
            dismissButton = { TextButton(onClick = { dialogIzinPasang = false }) { Text("Batal") } },
        )
    }
}

// ---------------------------------------------------------------- beranda

@Composable
private fun LayarBeranda(
    r: Ringkasan?,
    galatBeranda: String?,
    aplikasi: List<RingkasAplikasi>?,
    memuatAplikasi: Boolean,
    galatAplikasi: String?,
    deck: DataDeck?,
    memuatDeck: Boolean,
    galatDeck: String?,
    rilisBaru: InfoRilis?,
    bukaDialogRilis: (InfoRilis) -> Unit,
    cobaLagiBeranda: () -> Unit,
    cobaLagiDeck: () -> Unit,
    cobaLagiAplikasi: () -> Unit,
    bukaAplikasi: () -> Unit,
    bukaAgenda: () -> Unit,
    bukaKonten: () -> Unit,
) {
    if (r == null) {
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            if (galatBeranda != null) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(galatBeranda, color = MaterialTheme.colorScheme.error)
                    Button(onClick = cobaLagiBeranda) { Text("Coba Lagi") }
                }
            } else {
                CircularProgressIndicator(color = Emas)
            }
        }
        return
    }
    val data = r

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            val jam = LocalTime.now(WIB).hour
            val salam = when {
                jam < 11 -> "Selamat pagi"
                jam < 15 -> "Selamat siang"
                jam < 18 -> "Selamat sore"
                else -> "Selamat malam"
            }
            Text("$salam, Kyai", fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            Text(namaTanggal(LocalDate.parse(data.tanggal)), color = Redup)
        }

        if (rilisBaru != null) {
            item {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .background(Emas.copy(alpha = 0.16f), RoundedCornerShape(12.dp))
                        .clickable { bukaDialogRilis(rilisBaru) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Pembaruan v${rilisBaru.versi} tersedia", color = EmasMuda, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text("Ketuk untuk unduh & pasang langsung dari GitHub.", color = Redup, fontSize = 12.sp)
                    }
                    Text("Perbarui →", color = Emas, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            }
        }

        if (data.google.siap && (!data.google.tersambung || data.google.galat != null)) {
            item {
                Row(
                    Modifier.fillMaxWidth().background(Emas.copy(alpha = 0.12f), RoundedCornerShape(12.dp)).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Warning, null, tint = EmasMuda)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        data.google.galat ?: "Google Calendar belum tersambung — hubungkan dari Bakafrawi Studio web (menu Agenda).",
                        color = EmasMuda,
                        fontSize = 14.sp,
                    )
                }
            }
        }

        // Studio AI & Mesin (Deck) — selalu tampil (memuat / isi / galat + coba lagi)
        item {
            KartuBagian("Studio AI & Mesin", bukaKonten) {
                when {
                    deck != null -> {
                        if (!deck.pengikutIg.isNullOrBlank()) {
                            Text("Instagram: ${deck.pengikutIg}", fontSize = 13.sp, color = EmasMuda)
                        }
                        if (!deck.ringkasBiaya.isNullOrBlank()) {
                            Text("Biaya AI bulan ini: ${deck.ringkasBiaya}", fontSize = 13.sp, color = Redup)
                        }
                        if (deck.workflows.isEmpty()) {
                            Text("Belum ada riwayat mesin terbaru.", color = Redup, fontSize = 13.sp)
                        } else {
                            deck.workflows.take(3).forEach { w ->
                                val st = w.kesimpulan ?: w.status
                                val warnaSt = when (st) {
                                    "success" -> Color(0xFF4ADE80)
                                    "failure" -> Color(0xFFF87171)
                                    else -> EmasMuda
                                }
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(w.nama, fontSize = 13.sp, modifier = Modifier.weight(1f), maxLines = 1)
                                    Text(st, fontSize = 12.sp, color = warnaSt)
                                }
                            }
                        }
                    }
                    memuatDeck -> Text("Memuat status mesin Studio…", color = Redup, fontSize = 13.sp)
                    else -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(galatDeck ?: "Gagal memuat status mesin.", color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        TextButton(onClick = cobaLagiDeck) { Text("Ulangi", fontSize = 12.sp) }
                    }
                }
            }
        }

        item {
            KartuBagian("Agenda hari ini", bukaAgenda) {
                if (data.acaraHariIni.isEmpty()) Text("Tidak ada acara hari ini.", color = Redup)
                data.acaraHariIni.forEach { a -> BarisRingkas(rentangJam(a), a.judul, a.lokasi) }
            }
        }

        item {
            KartuBagian("7 hari ke depan", bukaAgenda) {
                if (data.acaraPekan.isEmpty()) Text("Belum ada acara.", color = Redup)
                data.acaraPekan.take(6).forEach { a ->
                    BarisRingkas("${namaHari(tanggalWib(a.mulai))} ${if (a.seharian) "" else jamWib(a.mulai)}", a.judul, null)
                }
                if (data.acaraPekan.size > 6) Text("+${data.acaraPekan.size - 6} acara lagi", color = Redup, fontSize = 13.sp)
            }
        }

        // Ringkasan Aplikasi
        item {
            KartuBagian("Aplikasi", bukaAplikasi) {
                when {
                    aplikasi != null -> {
                        aplikasi.forEach { a ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                TitikStatusAplikasi(a)
                                Text(
                                    a.nama + " · " + if (a.ok) (a.catatan.firstOrNull() ?: "baik") else "belum tersambung",
                                    fontSize = 13.sp,
                                    color = if (a.ok) MaterialTheme.colorScheme.onSurface else Redup,
                                )
                            }
                        }
                    }
                    memuatAplikasi -> Text("Memuat ringkasan 5 aplikasi…", color = Redup, fontSize = 13.sp)
                    else -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(galatAplikasi ?: "Gagal memuat ringkasan aplikasi.", color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        TextButton(onClick = cobaLagiAplikasi) { Text("Ulangi", fontSize = 12.sp) }
                    }
                }
            }
        }

        // Konten (30 hari) — Grid 2x2 agar label lega dan tidak terpotong di HP
        item {
            KartuBagian("Konten (30 hari)", bukaKonten) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Angka(data.konten.menungguPersetujuan, "Menunggu persetujuan", Modifier.weight(1f), sorot = true)
                        Angka(data.konten.sedangDibuat, "Sedang dibuat", Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Angka(data.konten.terjadwal, "Akan tayang", Modifier.weight(1f))
                        Angka(data.konten.gagal, "Gagal", Modifier.weight(1f))
                    }
                }
            }
        }

        // Statistik Pengunjung Situs (anti-bot, 1 unik/hari)
        data.pengunjung?.let { p ->
            item {
                Column(
                    Modifier.fillMaxWidth().background(Kartu, RoundedCornerShape(16.dp)).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Pengunjung Situs", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                        Text("${p.persenHp}% HP", color = Redup, fontSize = 12.sp)
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Angka(p.hariIniUnik, "Hari ini (${p.hariIniTayangan}x)", Modifier.weight(1f), sorot = true)
                            Angka(p.pekanUnik, "7 hari (${p.pekanTayangan}x)", Modifier.weight(1f))
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Angka(p.bulanUnik, "30 hari (${p.bulanTayangan}x)", Modifier.weight(1f))
                            Angka(p.totalUnik, "Total (${p.totalTayangan}x)", Modifier.weight(1f))
                        }
                    }
                    if (p.sumberTeratas.isNotEmpty()) {
                        Text(
                            "Sumber: " + p.sumberTeratas.take(3).joinToString(" · ") { "${it.sumber} (${it.tayangan}x)" },
                            color = Redup,
                            fontSize = 12.sp,
                        )
                    }
                }
            }
        }

        item { Spacer(Modifier.height(72.dp)) }
    }
}

@Composable
private fun KartuBagian(judul: String, buka: () -> Unit, isi: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().background(Kartu, RoundedCornerShape(16.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(judul, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, modifier = Modifier.weight(1f))
            Text("Buka →", color = Redup, fontSize = 13.sp, modifier = Modifier.clickable(onClick = buka))
        }
        isi()
    }
}

@Composable
private fun BarisRingkas(kiri: String, judul: String, lokasi: String?) {
    Row {
        Text(kiri, color = Redup, fontSize = 14.sp, modifier = Modifier.width(110.dp))
        Text(judul + (lokasi?.let { " · $it" } ?: ""), fontSize = 14.sp)
    }
}

@Composable
private fun Angka(n: Int, label: String, m: Modifier, sorot: Boolean = false) {
    Column(m.background(MaterialTheme.colorScheme.surfaceContainerHigh, RoundedCornerShape(12.dp)).padding(12.dp)) {
        Text("$n", fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = if (sorot && n > 0) Emas else MaterialTheme.colorScheme.onSurface)
        Text(label, fontSize = 12.sp, color = Redup, lineHeight = 15.sp)
    }
}

// ---------------------------------------------------------------- agenda

@Composable
private fun LayarAgenda(api: Api, muatUlang: Int, galat: (Exception) -> Unit, ubah: (Acara) -> Unit) {
    var daftar by remember { mutableStateOf<List<Acara>?>(null) }
    val konteks = LocalContext.current
    LaunchedEffect(muatUlang) {
        try {
            val hasil = api.agenda()
            daftar = hasil
            Pengingat.pasang(konteks, hasil)
        } catch (e: Exception) {
            galat(e)
        }
    }
    val isi = daftar ?: return Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Emas)
    }
    if (isi.isEmpty()) {
        return Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("Belum ada acara 14 hari ke depan.\nTambah dengan tombol +, lewat bot Telegram, atau di Google Calendar.", color = Redup)
        }
    }
    val hariIni = hariIniWib()
    val perHari = isi.groupBy { maxOf(tanggalWib(it.mulai), hariIni) }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        perHari.forEach { (tgl, acara) ->
            item(key = "h$tgl") {
                Text(
                    (if (tgl == hariIni) "HARI INI · " else "") + namaTanggal(tgl).uppercase(),
                    color = Redup, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 10.dp, bottom = 2.dp),
                )
            }
            items(acara, key = { it.id }) { a -> KartuAcara(a) { ubah(a) } }
        }
        item { Spacer(Modifier.height(72.dp)) }
    }
}

@Composable
private fun KartuAcara(a: Acara, klik: () -> Unit) {
    Column(Modifier.fillMaxWidth().background(Kartu, RoundedCornerShape(12.dp)).clickable(onClick = klik).padding(14.dp)) {
        Text(a.judul, fontWeight = FontWeight.Medium)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(if (a.seharian) "Seharian" else "${rentangJam(a)} WIB", color = Redup, fontSize = 13.sp)
            a.lokasi?.let { Text("· $it", color = Redup, fontSize = 13.sp) }
            if (a.berulang) Text("· Berulang", color = Redup, fontSize = 12.sp)
            if (a.perlu_sinkron) Text("· Menunggu Google", color = EmasMuda, fontSize = 12.sp)
        }
        a.catatan?.let { Text(it, color = Redup, fontSize = 13.sp) }
    }
}

// ---------------------------------------------------------------- lainnya

@Composable
private fun LayarLainnya(
    sesi: Sesi,
    rilisTersedia: InfoRilis?,
    bukaSitus: () -> Unit,
    cekPembaruan: () -> Unit,
    bukaDialogRilis: (InfoRilis) -> Unit,
    keluar: () -> Unit,
) {
    var pengingat by remember { mutableStateOf(sesi.pengingatHp) }
    var yakin by remember { mutableStateOf(false) }
    val konteks = LocalContext.current

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Column(
                Modifier.fillMaxWidth().background(Kartu, RoundedCornerShape(16.dp)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("Situs bakafrawi.com", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Text("Ubah judul Hero, tagline, nomor WhatsApp, dan kontak situs langsung dari APK.", color = Redup, fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = bukaSitus) { Text("Edit Situs") }
                    OutlinedButton(onClick = { konteks.startActivity(Intent(Intent.ACTION_VIEW, BuildConfig.SITUS.toUri())) }) {
                        Text("Buka Web")
                    }
                }
            }
        }

        item {
            Column(
                Modifier.fillMaxWidth().background(Kartu, RoundedCornerShape(16.dp)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("Pembaruan Aplikasi", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Text("Versi terpasang: v${BuildConfig.VERSION_NAME} (kode ${BuildConfig.VERSION_CODE})", color = Redup, fontSize = 13.sp)
                Text("Sumber rilis: GitHub (${BuildConfig.GITHUB_REPO})", color = Redup, fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (rilisTersedia != null) {
                        Button(onClick = { bukaDialogRilis(rilisTersedia) }) { Text("Pasang v${rilisTersedia.versi}") }
                    } else {
                        Button(onClick = cekPembaruan) { Text("Cek Pembaruan") }
                    }
                    OutlinedButton(onClick = { konteks.startActivity(Intent(Intent.ACTION_VIEW, Pembaruan.urlHalamanRilis().toUri())) }) {
                        Text("Halaman Rilis")
                    }
                }
            }
        }

        item {
            Column(
                Modifier.fillMaxWidth().background(Kartu, RoundedCornerShape(16.dp)).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("Pengingat & Akun", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Pengingat di HP ini")
                        Text("Notifikasi 30 menit sebelum acara. Bot Telegram tetap mengingatkan.", color = Redup, fontSize = 13.sp)
                    }
                    Switch(pengingat, {
                        pengingat = it
                        sesi.pengingatHp = it
                        if (!it) Pengingat.batalSemua(konteks)
                    })
                }
                Text("Masuk sebagai ${sesi.email ?: "admin"}", color = Redup, fontSize = 13.sp)
                OutlinedButton(onClick = { yakin = true }) { Text("Keluar") }
            }
        }
    }

    if (yakin) {
        AlertDialog(
            onDismissRequest = { yakin = false },
            title = { Text("Keluar dari Bakafrawi Studio?") },
            text = { Text("Pengingat di HP ini ikut berhenti sampai Kyai masuk lagi.") },
            confirmButton = { TextButton(onClick = { yakin = false; keluar() }) { Text("Keluar") } },
            dismissButton = { TextButton(onClick = { yakin = false }) { Text("Batal") } },
        )
    }
}
