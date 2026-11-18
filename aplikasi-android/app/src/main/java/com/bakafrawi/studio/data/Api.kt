package com.bakafrawi.studio.data

import com.bakafrawi.studio.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.util.concurrent.TimeUnit

class GalatApi(pesan: String, val kode: Int = 0) : Exception(pesan)

/**
 * Semua jaringan APK. Login lewat Supabase Auth; data & aksi lewat API situs (/api/…) yang memeriksa
 * status admin dan menjalankan aturan yang sama dengan layar web & bot Telegram.
 */
class Api(private val sesi: Sesi) {
    private val http = OkHttpClient.Builder().callTimeout(45, TimeUnit.SECONDS).build()
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    private val jenisJson = "application/json".toMediaType()

    private fun kirim(req: Request): Pair<Int, JsonObject> {
        http.newCall(req).execute().use { res ->
            val teks = res.body?.string().orEmpty()
            val isi = runCatching { json.parseToJsonElement(teks).jsonObject }.getOrElse { JsonObject(emptyMap()) }
            return res.code to isi
        }
    }

    private fun JsonObject.teks(k: String) = this[k]?.jsonPrimitive?.contentOrNull

    private fun pesanGalat(isi: JsonObject, cadangan: String) =
        isi.teks("pesan") ?: isi.teks("error_description") ?: isi.teks("msg") ?: cadangan

    /** URL Supabase & kunci anon (publik) diambil dari situs, supaya tak perlu ditanam di APK. */
    private fun muatKonfigurasi() {
        val (kode, isi) = kirim(Request.Builder().url("${BuildConfig.SITUS}/api/aplikasi").build())
        val url = isi.teks("supabaseUrl")
        val anon = isi.teks("supabaseAnon")
        if (kode != 200 || url.isNullOrBlank() || anon.isNullOrBlank()) throw GalatApi("Situs belum siap (konfigurasi Supabase kosong).")
        sesi.supabaseUrl = url
        sesi.supabaseAnon = anon
    }

    private fun simpanToken(isi: JsonObject) {
        sesi.aksesToken = isi.teks("access_token") ?: throw GalatApi("Jawaban login tidak lengkap.")
        sesi.refreshToken = isi.teks("refresh_token")
        val detik = isi["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600
        sesi.kedaluwarsa = System.currentTimeMillis() + detik * 1000
        isi["user"]?.jsonObject?.teks("email")?.let { sesi.email = it }
    }

    private fun auth(jenis: String, badan: JsonObject): JsonObject {
        val req = Request.Builder()
            .url("${sesi.supabaseUrl}/auth/v1/token?grant_type=$jenis")
            .header("apikey", sesi.supabaseAnon.orEmpty())
            .post(badan.toString().toRequestBody(jenisJson))
            .build()
        val (kode, isi) = kirim(req)
        if (kode != 200) {
            if (jenis == "refresh_token") {
                sesi.keluar()
                throw GalatApi("Sesi berakhir, silakan masuk lagi.", 401)
            }
            throw GalatApi(if (kode == 400) "Email atau kata sandi salah." else pesanGalat(isi, "Gagal masuk ($kode)."), kode)
        }
        return isi
    }

    suspend fun masuk(email: String, sandi: String) = withContext(Dispatchers.IO) {
        muatKonfigurasi()
        simpanToken(auth("password", buildJsonObject { put("email", email.trim()); put("password", sandi) }))
        // Pastikan akun ini admin: API situs menolak (401) bila bukan.
        try {
            beranda()
        } catch (e: GalatApi) {
            sesi.keluar()
            throw if (e.kode == 401) GalatApi("Akun ini bukan admin Bakafrawi.") else e
        }
    }

    @Synchronized
    private fun token(paksa: Boolean = false): String {
        if (!sesi.masuk) throw GalatApi("Belum masuk.", 401)
        if (sesi.supabaseUrl == null) muatKonfigurasi()
        if (paksa || sesi.aksesToken == null || System.currentTimeMillis() > sesi.kedaluwarsa - 60_000) {
            simpanToken(auth("refresh_token", buildJsonObject { put("refresh_token", sesi.refreshToken) }))
        }
        return sesi.aksesToken!!
    }

    /** Panggil API situs dengan token admin; token disegarkan sekali bila ditolak. */
    private fun situs(jalur: String, badan: JsonObject? = null): JsonObject {
        fun panggil(t: String): Pair<Int, JsonObject> {
            val b = Request.Builder().url("${BuildConfig.SITUS}$jalur").header("Authorization", "Bearer $t")
            if (badan != null) b.post(badan.toString().toRequestBody(jenisJson))
            return kirim(b.build())
        }
        var (kode, isi) = panggil(token())
        if (kode == 401) {
            val ulang = panggil(token(paksa = true))
            kode = ulang.first
            isi = ulang.second
        }
        if (kode == 401) throw GalatApi("Ditolak: akun bukan admin atau sesi berakhir.", 401)
        if (isi["ok"]?.jsonPrimitive?.booleanOrNull != true) throw GalatApi(pesanGalat(isi, "Gagal ($kode)."), kode)
        return isi
    }

    suspend fun beranda(): Ringkasan = withContext(Dispatchers.IO) {
        json.decodeFromJsonElement(Ringkasan.serializer(), situs("/api/beranda"))
    }

    suspend fun agenda(dari: Instant? = null, sampai: Instant? = null): List<Acara> = withContext(Dispatchers.IO) {
        val q = if (dari != null && sampai != null) "?dari=$dari&sampai=$sampai" else ""
        situs("/api/agenda$q")["acara"]!!.jsonArray.map { json.decodeFromJsonElement(Acara.serializer(), it) }
    }

    /** Tambah/ubah acara. Mengembalikan true bila sudah masuk Google Calendar. */
    suspend fun simpanAcara(m: MasukanAcara): Boolean = withContext(Dispatchers.IO) {
        val isi = situs("/api/agenda", json.encodeToJsonElement(MasukanAcara.serializer(), m).jsonObject)
        isi["keGoogle"]?.jsonPrimitive?.booleanOrNull == true
    }

    suspend fun hapusAcara(id: String) = withContext(Dispatchers.IO) {
        situs("/api/agenda", buildJsonObject { put("aksi", "hapus"); put("id", id) })
        Unit
    }
}
