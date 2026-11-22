package com.bakafrawi.studio.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bakafrawi.studio.data.Api
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Editor konten situs bakafrawi.com versi native (mengubah tabel `konten` id `situs` di Supabase
 * lalu menyegarkan cache ISR situs secara langsung).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LayarEditorSitus(
    api: Api,
    tutup: () -> Unit,
    kabar: (String) -> Unit,
    galat: (Exception) -> Unit,
) {
    var dataAsli by remember { mutableStateOf<JsonObject?>(null) }
    var memuat by remember { mutableStateOf(true) }
    var menyimpan by remember { mutableStateOf(false) }

    // Bidang utama yang sering diubah Kyai (Hero, Tentang, Kontak)
    var namaSitus by remember { mutableStateOf("") }
    var tagline by remember { mutableStateOf("") }
    var judulHero by remember { mutableStateOf("") }
    var subHero by remember { mutableStateOf("") }
    var lencanaHero by remember { mutableStateOf("") }
    var whatsapp by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var lokasi by remember { mutableStateOf("") }
    var catatanFooter by remember { mutableStateOf("") }

    val cakupan = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val d = api.bacaKontenSitus()
            dataAsli = d
            if (d != null) {
                val umum = runCatching { d["umum"]?.jsonObject }.getOrNull()
                val hero = runCatching { d["hero"]?.jsonObject }.getOrNull()
                val kontak = runCatching { d["kontak"]?.jsonObject }.getOrNull()
                namaSitus = umum?.get("nama")?.jsonPrimitive?.contentOrNull.orEmpty()
                tagline = umum?.get("tagline")?.jsonPrimitive?.contentOrNull.orEmpty()
                judulHero = hero?.get("judul")?.jsonPrimitive?.contentOrNull.orEmpty()
                subHero = hero?.get("subjudul")?.jsonPrimitive?.contentOrNull.orEmpty()
                lencanaHero = hero?.get("lencana")?.jsonPrimitive?.contentOrNull.orEmpty()
                whatsapp = kontak?.get("whatsapp")?.jsonPrimitive?.contentOrNull.orEmpty()
                email = kontak?.get("email")?.jsonPrimitive?.contentOrNull.orEmpty()
                lokasi = kontak?.get("lokasi")?.jsonPrimitive?.contentOrNull.orEmpty()
                catatanFooter = kontak?.get("catatan")?.jsonPrimitive?.contentOrNull.orEmpty()
            }
        } catch (e: Exception) {
            galat(e)
        } finally {
            memuat = false
        }
    }

    fun gabungObjek(induk: JsonObject, kunci: String, ubahan: Map<String, String>): JsonObject {
        val lama = runCatching { induk[kunci]?.jsonObject }.getOrNull()?.toMutableMap() ?: mutableMapOf()
        ubahan.forEach { (k, v) -> lama[k] = JsonPrimitive(v) }
        val baru = induk.toMutableMap()
        baru[kunci] = JsonObject(lama)
        return JsonObject(baru)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit Situs bakafrawi.com") },
                navigationIcon = {
                    IconButton(onClick = tutup) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Kembali")
                    }
                },
            )
        },
    ) { pad ->
        if (memuat) {
            Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Emas)
            }
            return@Scaffold
        }
        val sumber = dataAsli
        if (sumber == null) {
            Box(Modifier.fillMaxSize().padding(pad).padding(24.dp), contentAlignment = Alignment.Center) {
                Text(
                    "Data konten situs belum ada di database. Simpan sekali dari admin web untuk inisialisasi awal.",
                    color = Redup,
                )
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                BagianFormSitus("Umum & Hero") {
                    OutlinedTextField(
                        value = namaSitus,
                        onValueChange = { namaSitus = it },
                        label = { Text("Nama studio / situs") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = tagline,
                        onValueChange = { tagline = it },
                        label = { Text("Tagline") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = lencanaHero,
                        onValueChange = { lencanaHero = it },
                        label = { Text("Lencana status Hero") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = judulHero,
                        onValueChange = { judulHero = it },
                        label = { Text("Judul utama Hero") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = subHero,
                        onValueChange = { subHero = it },
                        label = { Text("Subjudul Hero") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )
                }
            }
            item {
                BagianFormSitus("Kontak") {
                    OutlinedTextField(
                        value = whatsapp,
                        onValueChange = { whatsapp = it },
                        label = { Text("Nomor WhatsApp (628…)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = lokasi,
                        onValueChange = { lokasi = it },
                        label = { Text("Lokasi") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = catatanFooter,
                        onValueChange = { catatanFooter = it },
                        label = { Text("Catatan ajakan kontak") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )
                }
            }
            item {
                Button(
                    onClick = {
                        menyimpan = true
                        cakupan.launch {
                            try {
                                var baru = sumber
                                if (baru.containsKey("umum")) {
                                    baru = gabungObjek(baru, "umum", mapOf("nama" to namaSitus.trim(), "tagline" to tagline.trim()))
                                }
                                if (baru.containsKey("hero")) {
                                    baru = gabungObjek(
                                        baru,
                                        "hero",
                                        mapOf(
                                            "lencana" to lencanaHero.trim(),
                                            "judul" to judulHero.trim(),
                                            "subjudul" to subHero.trim(),
                                        ),
                                    )
                                }
                                if (baru.containsKey("kontak")) {
                                    baru = gabungObjek(
                                        baru,
                                        "kontak",
                                        mapOf(
                                            "whatsapp" to whatsapp.trim(),
                                            "email" to email.trim(),
                                            "lokasi" to lokasi.trim(),
                                            "catatan" to catatanFooter.trim(),
                                        ),
                                    )
                                }
                                api.simpanKontenSitus(baru)
                                dataAsli = baru
                                kabar("Perubahan disimpan dan sudah tayang di bakafrawi.com.")
                            } catch (e: Exception) {
                                galat(e)
                            } finally {
                                menyimpan = false
                            }
                        }
                    },
                    enabled = !menyimpan,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    if (menyimpan) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text("Simpan & Tayangkan ke Situs")
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun BagianFormSitus(judul: String, isi: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(Kartu, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(judul, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = EmasMuda)
        isi()
    }
}
