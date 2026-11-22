package com.bakafrawi.studio.pembaruan

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.bakafrawi.studio.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

data class InfoRilis(
    val versi: String,
    val nama: String,
    val catatan: String,
    val urlApk: String,
    val ukuranByte: Long,
    val urlHalaman: String,
    val lebihBaru: Boolean,
)

/**
 * Pemeriksa dan pengunduh pembaruan APK langsung dari GitHub Releases repo Bakafrawi.
 */
object Pembaruan {
    private val http = OkHttpClient.Builder()
        .callTimeout(120, TimeUnit.SECONDS)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    fun urlHalamanRilis(): String = "https://github.com/${BuildConfig.GITHUB_REPO}/releases"

    /** Bandingkan dua versi semver ("2.1.0" > "2.0.0" → positif). */
    fun bandingkanVersi(baru: String, lama: String): Int {
        fun pecah(s: String): List<Int> = s
            .trim()
            .removePrefix("apk-")
            .removePrefix("v")
            .substringBefore("-")
            .split(".")
            .map { it.toIntOrNull() ?: 0 }

        val a = pecah(baru)
        val b = pecah(lama)
        val n = maxOf(a.size, b.size)
        for (i in 0 until n) {
            val va = a.getOrElse(i) { 0 }
            val vb = b.getOrElse(i) { 0 }
            if (va != vb) return va.compareTo(vb)
        }
        return 0
    }

    /** Ambil rilis terbaru dari GitHub Releases. Mengembalikan null bila belum ada rilis/APK. */
    suspend fun cek(): InfoRilis? = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("https://api.github.com/repos/${BuildConfig.GITHUB_REPO}/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "BakafrawiStudio-Android/${BuildConfig.VERSION_NAME}")
            .build()

        http.newCall(req).execute().use { res ->
            if (res.code == 404) return@withContext null
            if (!res.isSuccessful) throw Exception("Gagal cek pembaruan (HTTP ${res.code}).")
            val teks = res.body?.string().orEmpty()
            val obj = json.parseToJsonElement(teks).jsonObject
            val tag = obj["tag_name"]?.jsonPrimitive?.contentOrNull?.trim().orEmpty()
            if (tag.isBlank()) return@withContext null
            val nama = obj["name"]?.jsonPrimitive?.contentOrNull?.ifBlank { tag } ?: tag
            val catatan = obj["body"]?.jsonPrimitive?.contentOrNull.orEmpty().trim()
            val urlHalaman = obj["html_url"]?.jsonPrimitive?.contentOrNull ?: urlHalamanRilis()
            val aset = obj["assets"]?.jsonArray
                ?.map { it.jsonObject }
                ?.firstOrNull { it["name"]?.jsonPrimitive?.contentOrNull?.endsWith(".apk", ignoreCase = true) == true }
                ?: return@withContext null

            val urlApk = aset["browser_download_url"]?.jsonPrimitive?.contentOrNull ?: return@withContext null
            val ukuran = aset["size"]?.jsonPrimitive?.longOrNull ?: 0L
            val bersih = tag.removePrefix("apk-").removePrefix("v")
            InfoRilis(
                versi = bersih,
                nama = nama,
                catatan = catatan,
                urlApk = urlApk,
                ukuranByte = ukuran,
                urlHalaman = urlHalaman,
                lebihBaru = bandingkanVersi(bersih, BuildConfig.VERSION_NAME) > 0,
            )
        }
    }

    /** Cek apakah izin memasang APK dari aplikasi ini sudah diberikan (Android 8+). */
    fun bolehPasang(konteks: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) konteks.packageManager.canRequestPackageInstalls() else true

    /** Buka pengaturan izin "Pasang aplikasi tak dikenal" khusus untuk Bakafrawi Studio. */
    fun bukaIzinPasang(konteks: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${konteks.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            konteks.startActivity(intent)
        }
    }

    /** Unduh APK ke cache privat aplikasi lalu buka installer Android. */
    suspend fun unduhDanPasang(
        konteks: Context,
        urlApk: String,
        padaProgres: (Int) -> Unit,
    ) = withContext(Dispatchers.IO) {
        val dir = File(konteks.cacheDir, "updates").apply { mkdirs() }
        val berkas = File(dir, "bakafrawi-update.apk")
        if (berkas.exists()) berkas.delete()

        val req = Request.Builder()
            .url(urlApk)
            .header("User-Agent", "BakafrawiStudio-Android/${BuildConfig.VERSION_NAME}")
            .build()

        http.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw Exception("Gagal mengunduh APK (HTTP ${res.code}).")
            val body = res.body ?: throw Exception("Berkas APK kosong.")
            val total = body.contentLength()
            var terkumpul = 0L
            var terakhirPersen = -1
            body.byteStream().use { masukan ->
                berkas.outputStream().use { keluaran ->
                    val buf = ByteArray(8192)
                    while (true) {
                        val n = masukan.read(buf)
                        if (n == -1) break
                        keluaran.write(buf, 0, n)
                        terkumpul += n
                        if (total > 0) {
                            val persen = ((terkumpul * 100) / total).toInt().coerceIn(0, 100)
                            if (persen != terakhirPersen) {
                                terakhirPersen = persen
                                withContext(Dispatchers.Main) { padaProgres(persen) }
                            }
                        }
                    }
                }
            }
        }

        withContext(Dispatchers.Main) {
            padaProgres(100)
            val uri = FileProvider.getUriForFile(konteks, "${konteks.packageName}.fileprovider", berkas)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            konteks.startActivity(intent)
        }
    }
}
