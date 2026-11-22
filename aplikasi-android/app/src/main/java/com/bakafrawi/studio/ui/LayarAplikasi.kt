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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bakafrawi.studio.data.RingkasAplikasi

private val Hijau = Color(0xFF4ADE80)
private val Kuning = Color(0xFFFBBF24)

@Composable
fun LayarAplikasi(
    daftar: List<RingkasAplikasi>?,
    sedangMemuat: Boolean,
    pesanGalat: String?,
    cobaLagi: () -> Unit,
) {
    if (daftar == null) {
        if (sedangMemuat) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator(color = Emas)
                    Text("Menghubungi pintu 5 aplikasi…", color = Redup, fontSize = 13.sp)
                }
            }
            return
        }
        Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    pesanGalat ?: "Gagal memuat dasbor aplikasi.",
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                )
                Button(onClick = cobaLagi) { Text("Coba Lagi") }
            }
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(
                "Ringkasan pintu baca-saja tiap aplikasi · diperbarui tiap ±5 menit",
                color = Redup,
                fontSize = 13.sp,
            )
        }
        if (!pesanGalat.isNullOrBlank()) {
            item {
                Text(pesanGalat, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
            }
        }
        items(daftar, key = { it.slug }) { a ->
            KartuAplikasiDetail(a)
        }
        item {
            Text(
                "Ammu Online, Waseela, & Fastabiqu hanya menampilkan angka teknis (akun, pengguna aktif, aktivitas, ukuran database) tanpa data pribadi/keuangan.",
                color = Redup,
                fontSize = 12.sp,
                lineHeight = 16.sp,
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
fun TitikStatusAplikasi(a: RingkasAplikasi) {
    val warna = when {
        !a.ok -> Redup
        a.tingkat == "perhatian" -> Kuning
        else -> Hijau
    }
    Box(Modifier.size(10.dp).background(warna, CircleShape))
}

@Composable
private fun KartuAplikasiDetail(a: RingkasAplikasi) {
    val labelJenis = when (a.jenis) {
        "saas" -> "SaaS"
        "kedai" -> "Kedai"
        "teknis" -> "Teknis saja"
        else -> null
    }
    Column(
        Modifier
            .fillMaxWidth()
            .background(Kartu, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TitikStatusAplikasi(a)
                Text(a.nama, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            }
            if (labelJenis != null) {
                Text(
                    labelJenis,
                    color = Redup,
                    fontSize = 11.sp,
                    modifier = Modifier
                        .background(Color(0x14FFFFFF), RoundedCornerShape(999.dp))
                        .padding(horizontal = 10.dp, vertical = 3.dp),
                )
            }
        }

        if (!a.ok) {
            Text(a.galat ?: "Belum tersambung.", color = Redup, fontSize = 14.sp)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                a.angka.forEach { (label, nilai) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(label, color = Redup, fontSize = 13.sp, modifier = Modifier.weight(0.44f))
                        Text(
                            nilai,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            textAlign = TextAlign.End,
                            modifier = Modifier.weight(0.56f),
                        )
                    }
                }
            }
            if (a.catatan.isNotEmpty()) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(Emas.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    a.catatan.forEach { c ->
                        Text("• $c", color = EmasMuda, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
