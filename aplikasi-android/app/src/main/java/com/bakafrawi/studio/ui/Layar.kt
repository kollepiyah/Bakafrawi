package com.bakafrawi.studio.ui

import android.content.Intent
import androidx.core.net.toUri
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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bakafrawi.studio.BuildConfig
import com.bakafrawi.studio.data.Acara
import com.bakafrawi.studio.data.Api
import com.bakafrawi.studio.data.GalatApi
import com.bakafrawi.studio.data.Ringkasan
import com.bakafrawi.studio.data.Sesi
import com.bakafrawi.studio.hariIniWib
import com.bakafrawi.studio.jamWib
import com.bakafrawi.studio.namaHari
import com.bakafrawi.studio.namaTanggal
import com.bakafrawi.studio.pengingat.Pengingat
import com.bakafrawi.studio.rentangJam
import com.bakafrawi.studio.tanggalWib
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime

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
            OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
            OutlinedTextField(sandi, { sandi = it }, label = { Text("Kata sandi") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
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

private enum class Tab(val label: String) { Beranda("Beranda"), Agenda("Agenda"), Konten("Konten"), Lainnya("Lainnya") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LayarUtama(api: Api, sesi: Sesi, keluar: () -> Unit) {
    var tab by remember { mutableStateOf(Tab.Beranda) }
    var muatUlang by remember { mutableIntStateOf(0) }
    var form by remember { mutableStateOf<Acara?>(null) }
    var formBaru by remember { mutableStateOf(false) }
    val snack = remember { SnackbarHostState() }
    val cakupan = rememberCoroutineScope()
    val konteks = LocalContext.current

    fun kabar(teks: String) = cakupan.launch { snack.showSnackbar(teks) }
    fun tanganiGalat(e: Exception) {
        if (e is GalatApi && e.kode == 401) keluar() else kabar(e.message ?: "Gagal.")
    }
    fun bukaKonten() = konteks.startActivity(Intent(Intent.ACTION_VIEW, "${BuildConfig.SITUS}/admin?halaman=studio".toUri()))

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (tab == Tab.Beranda) "Bakafrawi Studio" else tab.label) },
                actions = {
                    if (tab == Tab.Beranda || tab == Tab.Agenda) IconButton(onClick = { muatUlang++ }) { Icon(Icons.Outlined.Refresh, "Muat ulang") }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t,
                        onClick = { if (t == Tab.Konten) bukaKonten() else tab = t },
                        icon = {
                            Icon(
                                when (t) {
                                    Tab.Beranda -> Icons.Outlined.Home
                                    Tab.Agenda -> Icons.Outlined.CalendarMonth
                                    Tab.Konten -> Icons.Outlined.AutoAwesome
                                    Tab.Lainnya -> Icons.Outlined.MoreHoriz
                                },
                                null,
                            )
                        },
                        label = { Text(t.label) },
                    )
                }
            }
        },
        floatingActionButton = {
            if (tab == Tab.Agenda || tab == Tab.Beranda) {
                FloatingActionButton(onClick = { form = null; formBaru = true }, containerColor = Emas) { Icon(Icons.Outlined.Add, "Tambah acara") }
            }
        },
        snackbarHost = { SnackbarHost(snack) },
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (tab) {
                Tab.Beranda -> LayarBeranda(api, muatUlang, ::tanganiGalat, bukaAgenda = { tab = Tab.Agenda }, bukaKonten = ::bukaKonten)
                Tab.Agenda -> LayarAgenda(api, muatUlang, ::tanganiGalat, ubah = { form = it; formBaru = false })
                Tab.Lainnya -> LayarLainnya(sesi, keluar)
                Tab.Konten -> Unit
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
}

// ---------------------------------------------------------------- beranda

@Composable
private fun LayarBeranda(api: Api, muatUlang: Int, galat: (Exception) -> Unit, bukaAgenda: () -> Unit, bukaKonten: () -> Unit) {
    var r by remember { mutableStateOf<Ringkasan?>(null) }
    val konteks = LocalContext.current
    LaunchedEffect(muatUlang) {
        try {
            val hasil = api.beranda()
            r = hasil
            Pengingat.pasang(konteks, hasil.acaraHariIni + hasil.acaraPekan)
        } catch (e: Exception) {
            galat(e)
        }
    }
    val data = r ?: return Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            val jam = LocalTime.now(com.bakafrawi.studio.WIB).hour
            val salam = when { jam < 11 -> "Selamat pagi"; jam < 15 -> "Selamat siang"; jam < 18 -> "Selamat sore"; else -> "Selamat malam" }
            Text("$salam, Kyai", fontSize = 24.sp, fontWeight = FontWeight.SemiBold)
            Text(namaTanggal(LocalDate.parse(data.tanggal)), color = Redup)
        }
        if (data.google.siap && (!data.google.tersambung || data.google.galat != null)) {
            item {
                Row(
                    Modifier.fillMaxWidth().background(Emas.copy(alpha = 0.12f), RoundedCornerShape(12.dp)).padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.WarningAmber, null, tint = EmasMuda)
                    Spacer(Modifier.width(8.dp))
                    Text(data.google.galat ?: "Google Calendar belum tersambung — hubungkan dari Bakafrawi Studio web (menu Agenda).", color = EmasMuda, fontSize = 14.sp)
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
        item {
            KartuBagian("Konten (30 hari)", bukaKonten) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Angka(data.konten.menungguPersetujuan, "Menunggu\npersetujuan", Modifier.weight(1f), sorot = true)
                    Angka(data.konten.sedangDibuat, "Sedang\ndibuat", Modifier.weight(1f))
                    Angka(data.konten.terjadwal, "Akan\ntayang", Modifier.weight(1f))
                    Angka(data.konten.gagal, "Gagal", Modifier.weight(1f))
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
    Column(m.background(MaterialTheme.colorScheme.surfaceContainerHigh, RoundedCornerShape(10.dp)).padding(10.dp)) {
        Text("$n", fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = if (sorot && n > 0) Emas else MaterialTheme.colorScheme.onSurface)
        Text(label, fontSize = 11.sp, color = Redup, lineHeight = 13.sp)
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
    val isi = daftar ?: return Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    if (isi.isEmpty()) {
        return Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text("Belum ada acara 14 hari ke depan.\nTambah dengan tombol +, lewat bot Telegram, atau di Google Calendar.", color = Redup)
        }
    }
    // Acara yang sudah berjalan sejak kemarin (mis. seharian 3 hari) ditampilkan di hari ini.
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
            if (a.berulang) Icon(Icons.Outlined.Repeat, "Berulang", tint = Redup, modifier = Modifier.size(14.dp))
            if (a.perlu_sinkron) Icon(Icons.Outlined.CloudOff, "Menunggu Google", tint = EmasMuda, modifier = Modifier.size(14.dp))
        }
        a.catatan?.let { Text(it, color = Redup, fontSize = 13.sp) }
    }
}

// ---------------------------------------------------------------- lainnya

@Composable
private fun LayarLainnya(sesi: Sesi, keluar: () -> Unit) {
    var pengingat by remember { mutableStateOf(sesi.pengingatHp) }
    var yakin by remember { mutableStateOf(false) }
    val konteks = LocalContext.current
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Masuk sebagai ${sesi.email ?: "admin"}", color = Redup)
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
        OutlinedButton(onClick = { yakin = true }) { Text("Keluar") }
        Text("Versi ${BuildConfig.VERSION_NAME}", color = Redup, fontSize = 12.sp)
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
