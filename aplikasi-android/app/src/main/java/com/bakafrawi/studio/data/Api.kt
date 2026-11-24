package com.bakafrawi.studio.data

import com.bakafrawi.studio.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.NumberFormat
import java.time.Instant
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.roundToLong

class GalatApi(pesan: String, val kode: Int = 0) : Exception(pesan)

/**
 * Semua jaringan APK. Login lewat Supabase Auth; data & aksi lewat API situs (/api/…) dan
 * Supabase PostgREST menggunakan token sesi admin yang sama dengan layar web.
 */
class Api(private val sesi: Sesi) {
    private val http = OkHttpClient.Builder().callTimeout(60, TimeUnit.SECONDS).build()
    private val httpUnggah = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .callTimeout(240, TimeUnit.SECONDS)
        .build()
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }
    private val jenisJson = "application/json".toMediaType()
    private val nfId = NumberFormat.getIntegerInstance(Locale("id", "ID"))

    private fun kirim(req: Request): Pair<Int, JsonObject> {
        http.newCall(req).execute().use { res ->
            val teks = res.body?.string().orEmpty()
            val isi = runCatching { json.parseToJsonElement(teks).jsonObject }.getOrElse { JsonObject(emptyMap()) }
            return res.code to isi
        }
    }

    private fun kirimElemen(req: Request): Pair<Int, JsonElement?> {
        http.newCall(req).execute().use { res ->
            val teks = res.body?.string().orEmpty()
            val isi = runCatching { json.parseToJsonElement(teks) }.getOrNull()
            return res.code to isi
        }
    }

    private fun JsonObject.prim(k: String): JsonPrimitive? = (this[k] as? JsonPrimitive)?.takeUnless { it is JsonNull }
    private fun JsonObject.obj(k: String): JsonObject? = this[k] as? JsonObject
    private fun JsonObject.arr(k: String): JsonArray? = this[k] as? JsonArray
    private fun JsonObject.teks(k: String) = prim(k)?.contentOrNull
    private fun JsonObject.angka(k: String) = prim(k)?.doubleOrNull ?: 0.0
    private fun JsonObject.bulat(k: String) = prim(k)?.intOrNull ?: angka(k).roundToInt()
    private fun JsonObject.bool(k: String) = prim(k)?.booleanOrNull == true

    private fun rupiah(v: Double) = "Rp${nfId.format(v.roundToLong())}"

    private fun selisihPersen(kini: Double, lalu: Double): String {
        if (lalu == 0.0) return ""
        val p = (((kini - lalu) / lalu) * 100.0).roundToInt()
        return if (p >= 0) "+${abs(p)}%" else "−${abs(p)}%"
    }

    private fun pesanGalat(isi: JsonObject, cadangan: String) =
        isi.teks("pesan") ?: isi.teks("message") ?: isi.teks("error_description") ?: isi.teks("msg") ?: cadangan

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
        if (sesi.supabaseUrl == null || sesi.supabaseAnon == null) muatKonfigurasi()
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

    /** Panggil Supabase PostgREST langsung dengan sesi admin. */
    private fun rest(
        jalur: String,
        metode: String = "GET",
        badan: JsonElement? = null,
        prefer: String? = null,
    ): JsonElement? {
        fun panggil(t: String): Pair<Int, JsonElement?> {
            val b = Request.Builder()
                .url("${sesi.supabaseUrl}/rest/v1$jalur")
                .header("apikey", sesi.supabaseAnon.orEmpty())
                .header("Authorization", "Bearer $t")
            if (prefer != null) b.header("Prefer", prefer)
            when (metode) {
                "POST" -> b.post((badan?.toString() ?: "{}").toRequestBody(jenisJson))
                "PATCH" -> b.patch((badan?.toString() ?: "{}").toRequestBody(jenisJson))
                "DELETE" -> b.delete()
                else -> b.get()
            }
            return kirimElemen(b.build())
        }
        var (kode, isi) = panggil(token())
        if (kode == 401) {
            val ulang = panggil(token(paksa = true))
            kode = ulang.first
            isi = ulang.second
        }
        if (kode == 401) throw GalatApi("Sesi berakhir, silakan masuk lagi.", 401)
        if (kode !in 200..299) {
            val obj = runCatching { isi?.jsonObject }.getOrNull() ?: JsonObject(emptyMap())
            throw GalatApi(pesanGalat(obj, "Gagal mengakses database ($kode)."), kode)
        }
        return isi
    }

    // ==================== BERANDA & AGENDA ====================

    suspend fun beranda(): Ringkasan = withContext(Dispatchers.IO) {
        json.decodeFromJsonElement(Ringkasan.serializer(), situs("/api/beranda"))
    }

    suspend fun deck(): DataDeck = withContext(Dispatchers.IO) {
        val isi = situs("/api/deck")
        val workflows = isi.arr("workflows")?.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            WorkflowRunItem(
                nama = o.teks("nama") ?: o.teks("name") ?: "Workflow",
                status = o.teks("status") ?: "",
                kesimpulan = o.teks("kesimpulan") ?: o.teks("conclusion"),
                dibuat = o.teks("mulai") ?: o.teks("created_at") ?: o.teks("dibuat"),
                url = o.teks("url") ?: o.teks("html_url"),
            )
        } ?: emptyList()

        val biayaObj = isi.obj("biaya")
        val ringkasBiaya = biayaObj?.let { b ->
            val usd = b.prim("usd")?.doubleOrNull
            val tugas = b.prim("tugas")?.intOrNull ?: 0
            if (usd != null) "${rupiah(usd * 16_300.0)} · $tugas tugas" else null
        }

        val insightObj = isi.obj("insight")
        val insight = insightObj?.let { ig ->
            val posts = ig.arr("posts")?.mapNotNull { el ->
                val p = el as? JsonObject ?: return@mapNotNull null
                PostInsightItem(
                    id = p.teks("id") ?: return@mapNotNull null,
                    merek = p.teks("merek") ?: "",
                    jenis = p.teks("jenis") ?: "",
                    format = p.teks("format") ?: if (p.teks("jenis") == "video") "reels" else "feed",
                    caption = p.teks("caption"),
                    permalink = p.teks("permalink"),
                    likes = p.bulat("likes"),
                    comments = p.bulat("comments"),
                    views = p.prim("views")?.intOrNull,
                    reach = p.prim("reach")?.intOrNull,
                    saved = p.prim("saved")?.intOrNull,
                    shares = p.prim("shares")?.intOrNull,
                    replies = p.prim("replies")?.intOrNull,
                    arsipStory = p.bool("arsipStory"),
                )
            } ?: emptyList()
            RingkasInsightIg(
                tersambung = ig.bool("tersambung"),
                akun = ig.teks("akun"),
                totalTayang = ig.bulat("totalTayang"),
                totalLikes = ig.bulat("totalLikes"),
                totalComments = ig.bulat("totalComments"),
                totalViews = ig.bulat("totalViews"),
                posts = posts.take(30),
                pesan = ig.teks("pesan"),
                galatInsight = ig.teks("galatInsight"),
            )
        }

        DataDeck(workflows = workflows.take(5), ringkasBiaya = ringkasBiaya, insight = insight)
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

    // ==================== DASBOR APLIKASI ====================

    suspend fun ringkasanAplikasi(): List<RingkasAplikasi> = withContext(Dispatchers.IO) {
        val arr = situs("/api/aplikasi/ringkasan").arr("aplikasi") ?: JsonArray(emptyList())
        arr.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            val jenis = o.teks("jenis")
            val ok = o.bool("ok")
            val data = o.obj("data")
            val penilaian = o.obj("penilaian")
            val tingkat = penilaian?.teks("tingkat") ?: "baik"
            val catatan = penilaian?.arr("catatan")?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()

            val angka = if (ok && data != null && jenis != null) hitungAngkaAplikasi(jenis, data) else emptyList()
            RingkasAplikasi(
                slug = o.teks("slug") ?: "",
                nama = o.teks("nama") ?: "",
                jenis = jenis,
                ok = ok,
                galat = o.teks("galat"),
                tingkat = tingkat,
                catatan = catatan,
                angka = angka,
            )
        }
    }

    private fun hitungAngkaAplikasi(jenis: String, d: JsonObject): List<Pair<String, String>> = when (jenis) {
        "saas" -> listOf(
            "Toko" to "${d.bulat("toko")} (${d.bulat("aktif")} aktif · ${d.bulat("trial")} trial)",
            "Pendapatan bulan ini" to rupiah(d.angka("pendapatan_bulan_ini")),
            "MRR" to rupiah(d.angka("mrr")),
            "Toko baru 7 hari" to "${d.bulat("toko_baru_7h")}",
            "Transaksi 24 jam" to nfId.format(d.bulat("transaksi_24j")),
        )
        "kedai" -> {
            val s = selisihPersen(d.angka("omzet"), d.angka("omzet_kemarin"))
            val laris = runCatching { d["terlaris"]?.jsonArray }.getOrNull()?.mapNotNull { el ->
                val x = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
                val nm = x.teks("nama") ?: return@mapNotNull null
                "$nm (${x.bulat("qty")})"
            }?.joinToString(", ").orEmpty()
            listOf(
                "Omzet hari ini" to "${rupiah(d.angka("omzet"))}${if (s.isNotEmpty()) " ($s vs kemarin)" else ""}",
                "Transaksi" to "${d.bulat("trx")} · ${d.bulat("cup")} cup",
                "Terlaris" to laris.ifEmpty { "-" },
                "Kas hari ini" to "+${rupiah(d.angka("kas_masuk"))} / −${rupiah(d.angka("kas_keluar"))}",
                "Bon & hutang" to "bon ${rupiah(d.angka("piutang"))} · hutang ${rupiah(d.angka("hutang_toko"))}",
            )
        }
        else -> listOf(
            "Akun" to nfId.format(d.bulat("akun")),
            "Aktif 24 jam / 7 hari" to "${d.bulat("aktif_24j")} / ${d.bulat("aktif_7h")}",
            "Aktivitas 24 jam" to nfId.format(d.bulat("aktivitas_24j")),
            "Database" to "${d.bulat("ukuran_db_mb")} MB",
        )
    }

    // ==================== STUDIO KONTEN ====================

    suspend fun daftarMerekStudio(): List<MerekStudio> = withContext(Dispatchers.IO) {
        val el = rest("/studio_merek?select=slug,nama,aktif,profil&order=urutan")
        val arr = runCatching { el?.jsonArray }.getOrNull() ?: return@withContext emptyList()
        arr.mapNotNull { item ->
            val o = runCatching { item.jsonObject }.getOrNull() ?: return@mapNotNull null
            val profil = runCatching { o["profil"]?.jsonObject }.getOrNull()
            val bahan = runCatching { profil?.get("bahan")?.jsonArray }.getOrNull()
                ?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()
            MerekStudio(
                slug = o.teks("slug") ?: return@mapNotNull null,
                nama = o.teks("nama") ?: "",
                aktif = o["aktif"]?.jsonPrimitive?.booleanOrNull == true,
                adalahBank = bahan.contains("bank"),
            )
        }
    }

    suspend fun daftarProdukSitus(): List<ProdukRingkas> = withContext(Dispatchers.IO) {
        val situs = bacaKontenSitus() ?: return@withContext listOf(
            ProdukRingkas("maktaba-pos", "Maktaba POS"),
            ProdukRingkas("ammu-online", "Ammu Online"),
            ProdukRingkas("waseela", "Waseela"),
        )
        val arr = runCatching { situs["produk"]?.jsonArray }.getOrNull() ?: return@withContext emptyList()
        arr.mapNotNull { el ->
            val o = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
            val slug = o.teks("slug") ?: return@mapNotNull null
            val nama = o.teks("nama") ?: slug
            ProdukRingkas(slug, nama)
        }
    }

    suspend fun daftarTugasStudio(): List<TugasStudio> = withContext(Dispatchers.IO) {
        val el = rest("/studio_tugas?select=*&order=dibuat.desc&limit=30")
        val arr = runCatching { el?.jsonArray }.getOrNull() ?: return@withContext emptyList()
        arr.mapNotNull { item ->
            val o = runCatching { item.jsonObject }.getOrNull() ?: return@mapNotNull null
            val hasil = runCatching { o["hasil"]?.jsonArray }.getOrNull()?.mapNotNull { h ->
                val ho = runCatching { h.jsonObject }.getOrNull() ?: return@mapNotNull null
                HasilStudio(
                    jenis = ho.teks("jenis") ?: "video",
                    rasio = ho.teks("rasio") ?: "9:16",
                    url = ho.teks("url") ?: return@mapNotNull null,
                )
            } ?: emptyList()
            val tayang = o.obj("tayang")
            val ig = tayang?.obj("instagram")
            val permalink = ig?.obj("reels")?.teks("permalink")
                ?: ig?.obj("feed")?.teks("permalink")
                ?: ig?.obj("story")?.teks("permalink")
            TugasStudio(
                id = o.teks("id") ?: return@mapNotNull null,
                merek = o.teks("merek") ?: "bakafrawi",
                dibuat = o.teks("dibuat") ?: "",
                jenis = o.teks("jenis") ?: "video",
                produkSlug = o.teks("produk_slug") ?: "",
                arahan = o.teks("arahan") ?: "",
                status = o.teks("status") ?: "antre",
                caption = o.teks("caption"),
                hasil = hasil,
                galat = o.teks("galat"),
                statusTayang = o.teks("status_tayang") ?: "belum",
                jadwalTayang = o.teks("jadwal_tayang"),
                sasaran = tayang?.teks("sasaran"),
                permalink = permalink,
                adaNaskah = runCatching { o["naskah"]?.jsonObject }.getOrNull() != null,
            )
        }
    }

    suspend fun usulkanArahan(merek: String, produk: String, jenis: String): List<UsulanArahan> = withContext(Dispatchers.IO) {
        val isi = situs(
            "/api/studio/arahan",
            buildJsonObject {
                put("merek", merek)
                put("produk", produk)
                put("jenis", jenis)
            },
        )
        isi["usulan"]?.jsonArray?.mapNotNull { el ->
            val o = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
            UsulanArahan(judul = o.teks("judul") ?: "Ide", arahan = o.teks("arahan") ?: "")
        } ?: emptyList()
    }

    suspend fun buatTugasStudio(
        merek: String,
        adalahBank: Boolean,
        jenis: String,
        produkSlug: String,
        arahan: String,
        latarAi: Boolean,
        sasaran: String,
        jadwalIso: String?,
    ): String = withContext(Dispatchers.IO) {
        if (adalahBank) {
            val badan = buildJsonObject {
                put("aksi", "buat")
                put("merek", merek)
                put("permintaan", arahan)
                if (jadwalIso != null) put("jadwal_tayang", jadwalIso)
                if (sasaran != "otomatis") put("sasaran", sasaran)
            }
            val isi = situs("/api/studio/naskah", badan)
            return@withContext isi.teks("pesan") ?: "Naskah dibuat — cek Riwayat untuk menyetujui."
        }

        val baris = buildJsonObject {
            put("merek", merek)
            put("jenis", jenis)
            put("produk_slug", produkSlug)
            put("arahan", arahan)
            put("latar", if (latarAi) "ai" else "polos")
            if (jadwalIso != null) {
                put("status_tayang", "dijadwalkan")
                put("jadwal_tayang", jadwalIso)
            }
            if (sasaran != "otomatis") {
                put("tayang", buildJsonObject { put("sasaran", sasaran) })
            }
        }
        rest("/studio_tugas", metode = "POST", badan = baris, prefer = "return=minimal")
        val j = runCatching { situs("/api/studio/jalankan", buildJsonObject {}) }.getOrNull()
        val dipicu = j?.get("dipicu")?.jsonPrimitive?.booleanOrNull == true
        if (dipicu) "Tugas dibuat & mesin Studio dinyalakan! Gambar ±1–2 mnt, video ±3–6 mnt."
        else "Tugas dibuat. Mesin akan memproses pada putaran jadwal berikutnya."
    }

    suspend fun aksiTayang(id: String, aksi: String, jadwalIso: String? = null, sasaran: String? = null): String =
        withContext(Dispatchers.IO) {
            val badan = buildJsonObject {
                put("id", id)
                put("aksi", aksi)
                if (jadwalIso != null) put("jadwal", jadwalIso)
                if (sasaran != null && sasaran != "otomatis") put("sasaran", sasaran)
            }
            situs("/api/studio/tayang", badan)
            when (aksi) {
                "sekarang" -> "Dijadwalkan tayang sekarang."
                "jadwal" -> "Jadwal tayang diperbarui."
                "ulang" -> "Tugas baru dibuat untuk dirender ulang."
                "tolak" -> "Konten ditolak."
                "batal" -> "Jadwal tayang dibatalkan."
                else -> "Berhasil."
            }
        }

    suspend fun setujuiNaskah(id: String): String = withContext(Dispatchers.IO) {
        val isi = situs("/api/studio/naskah", buildJsonObject { put("aksi", "setujui"); put("id", id) })
        isi.teks("pesan") ?: "Naskah disetujui & mesin dinyalakan."
    }

    suspend fun hapusTugasStudio(id: String) = withContext(Dispatchers.IO) {
        rest("/studio_tugas?id=eq.$id", metode = "DELETE")
        Unit
    }

    // ==================== UNGGAH MANUAL & STORY JAM BUKA (RUTIN) ====================

    private fun unggahKeUrlBertanda(uploadUrl: String, bytes: ByteArray, mime: String) {
        val req = Request.Builder()
            .url(uploadUrl)
            .put(bytes.toRequestBody(mime.toMediaType()))
            .build()
        httpUnggah.newCall(req).execute().use { res ->
            if (!res.isSuccessful) {
                throw GalatApi("Gagal mengunggah berkas ke penyimpanan (HTTP ${res.code}).", res.code)
            }
        }
    }

    /** Unggah video/foto manual dari HP lalu tayangkan sekarang, jadwalkan otomatis (WIB), atau simpan draf. */
    suspend fun unggahKontenManual(
        merek: String,
        namaBerkas: String,
        bytes: ByteArray,
        adalahGambar: Boolean,
        judul: String,
        caption: String,
        sasaran: String,
        modeTayang: String, // "jadwal" | "sekarang" | "draf"
        jadwalWib: String?,
    ): String = withContext(Dispatchers.IO) {
        val izin = situs(
            "/api/studio/unggah",
            buildJsonObject {
                put("aksi", "izin-unggah")
                put("merek", merek)
                put("namaBerkas", namaBerkas)
            },
        )
        val uploadUrl = izin.teks("uploadUrl") ?: throw GalatApi("Server tidak mengembalikan alamat unggah.")
        val publicUrl = izin.teks("publicUrl") ?: throw GalatApi("Server tidak mengembalikan tautan media.")
        val mime = if (adalahGambar) {
            if (namaBerkas.lowercase().endsWith(".png")) "image/png" else "image/jpeg"
        } else {
            "video/mp4"
        }
        unggahKeUrlBertanda(uploadUrl, bytes, mime)

        val buat = situs(
            "/api/studio/unggah",
            buildJsonObject {
                put("aksi", "buat")
                put("merek", merek)
                put("judul", judul.ifBlank { namaBerkas.substringBeforeLast('.') })
                put("url", publicUrl)
                put("jenis", if (adalahGambar) "gambar" else "video")
                put("caption", if (sasaran == "story") "" else caption)
                put("sasaran", sasaran)
                put("modeTayang", modeTayang)
                if (modeTayang == "jadwal" && !jadwalWib.isNullOrBlank()) put("jadwal", jadwalWib)
            },
        )
        buat.teks("pesan") ?: "Konten berhasil diunggah!"
    }

    /** Buat caption & hashtag konsisten merek otomatis untuk unggahan manual. */
    suspend fun buatCaptionOtomatis(
        merek: String,
        judul: String,
        konteks: String,
        jenis: String,
        sasaran: String,
    ): String = withContext(Dispatchers.IO) {
        val res = situs(
            "/api/studio/caption",
            buildJsonObject {
                put("merek", merek)
                put("judul", judul)
                if (konteks.isNotBlank()) put("konteks", konteks)
                put("jenis", jenis)
                put("sasaran", sasaran)
            },
        )
        res.teks("caption") ?: throw GalatApi("Server tidak mengembalikan caption.")
    }

    /** Buat paket storyboard + prompt siap-copy Google Flow (Veo 3) per adegan + caption konsisten. */
    suspend fun buatPaketGoogleFlow(
        merek: String,
        topik: String,
        bahasa: String,
        gaya: String,
        jumlahAdegan: Int,
    ): PaketFlow = withContext(Dispatchers.IO) {
        val res = situs(
            "/api/studio/google-flow",
            buildJsonObject {
                put("merek", merek)
                if (topik.isNotBlank()) put("topik", topik)
                put("bahasa", bahasa)
                put("gaya", gaya)
                put("jumlahAdegan", jumlahAdegan)
            },
        )
        val p = res.obj("paket") ?: throw GalatApi(res.teks("pesan") ?: "Paket Google Flow kosong.")
        val adegan = p.arr("adegan")?.mapIndexedNotNull { idx, el ->
            val o = runCatching { el.jsonObject }.getOrNull() ?: return@mapIndexedNotNull null
            AdeganFlow(
                nomor = o.bulat("nomor").takeIf { it > 0 } ?: (idx + 1),
                durasiDetik = o.bulat("durasiDetik").takeIf { it > 0 } ?: 8,
                ringkasAksi = o.teks("ringkasAksi") ?: "",
                dialog = o.teks("dialog") ?: "",
                arahanLogat = o.teks("arahanLogat") ?: "",
                teksLayar = o.teks("teksLayar") ?: "",
                promptGoogleFlow = o.teks("promptGoogleFlow") ?: "",
            )
        } ?: emptyList()
        PaketFlow(
            judul = p.teks("judul") ?: "Konsep Video AI",
            ringkasanKonsep = p.teks("ringkasanKonsep") ?: "",
            karakterBible = p.teks("karakterBible") ?: "",
            adegan = adegan,
            caption = p.teks("caption") ?: "",
            penyedia = res.teks("penyedia") ?: "",
        )
    }

    /** Unggah 1 video/foto ke koleksi Story Otomatis (rutin-buka) dan kembalikan item baru. */
    suspend fun unggahVideoRutin(
        merek: String,
        namaBerkas: String,
        bytes: ByteArray,
        adalahGambar: Boolean,
    ): VideoRutinItem = withContext(Dispatchers.IO) {
        val izin = situs(
            "/api/studio/rutin",
            buildJsonObject {
                put("aksi", "izin-unggah")
                put("merek", merek)
                put("namaBerkas", namaBerkas)
            },
        )
        val uploadUrl = izin.teks("uploadUrl") ?: throw GalatApi("Server tidak mengembalikan alamat unggah.")
        val publicUrl = izin.teks("publicUrl") ?: throw GalatApi("Server tidak mengembalikan tautan media.")
        val mime = if (adalahGambar) {
            if (namaBerkas.lowercase().endsWith(".png")) "image/png" else "image/jpeg"
        } else {
            "video/mp4"
        }
        unggahKeUrlBertanda(uploadUrl, bytes, mime)
        VideoRutinItem(
            id = "rutin-${System.currentTimeMillis()}",
            judul = namaBerkas.substringBeforeLast('.').replace(Regex("[-_]+"), " ").trim().ifBlank { "Video Story" },
            url = publicUrl,
            jenis = if (adalahGambar) "gambar" else "video",
            sasaran = "story",
            wajib = false,
            aktif = true,
            caption = "We are OPEN! Lek Kopi Waru Sidoarjo ☕",
        )
    }

    suspend fun bacaRutin(merek: String = "lekkopi"): JadwalRutinData = withContext(Dispatchers.IO) {
        val isi = situs("/api/studio/rutin?merek=$merek")
        val j = runCatching { isi["jadwal"]?.jsonObject }.getOrNull() ?: JsonObject(emptyMap())
        val hari = runCatching { j["hari"]?.jsonArray }.getOrNull()?.mapNotNull { it.jsonPrimitive.intOrNull }
            ?: listOf(1, 2, 3, 4, 5, 6)
        val daftarVideo = runCatching { j["video"]?.jsonArray }.getOrNull()?.mapNotNull { el ->
            val v = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
            val url = v.teks("url") ?: return@mapNotNull null
            VideoRutinItem(
                id = v.teks("id") ?: "video-${url.hashCode()}",
                judul = v.teks("judul") ?: "Video Story",
                url = url,
                jenis = v.teks("jenis") ?: "video",
                sasaran = v.teks("sasaran") ?: "story",
                wajib = v.bool("wajib"),
                aktif = v["aktif"]?.jsonPrimitive?.booleanOrNull != false,
                durasi = v.prim("durasi")?.intOrNull,
                caption = v.teks("caption") ?: "",
            )
        } ?: emptyList()
        val vb = runCatching { isi["videoBerikutnya"]?.jsonObject }.getOrNull()
        JadwalRutinData(
            aktif = j.bool("aktif"),
            jam = j.teks("jam") ?: "14:00",
            hari = hari,
            mode = j.teks("mode") ?: "acak",
            aiAktif = j.bool("aiAktif"),
            aiFormat = j.teks("aiFormat") ?: "video-animasi",
            aiGaya = j.teks("aiGaya") ?: "otomatis",
            berikutnya = isi.teks("berikutnya"),
            videoBerikutnyaId = vb?.teks("id"),
            videoBerikutnyaJudul = vb?.teks("judul"),
            video = daftarVideo,
        )
    }

    suspend fun simpanRutin(merek: String, data: JadwalRutinData): String = withContext(Dispatchers.IO) {
        val badan = buildJsonObject {
            put("aksi", "simpan")
            put("merek", merek)
            put(
                "jadwal",
                buildJsonObject {
                    put("aktif", data.aktif)
                    put("jam", data.jam)
                    put("hari", buildJsonArray { data.hari.forEach { add(it) } })
                    put("mode", data.mode)
                    put("aiAktif", data.aiAktif)
                    put("aiFormat", data.aiFormat)
                    put("aiGaya", data.aiGaya)
                    put(
                        "video",
                        buildJsonArray {
                            data.video.forEach { v ->
                                add(
                                    buildJsonObject {
                                        put("id", v.id)
                                        put("judul", v.judul)
                                        put("url", v.url)
                                        put("jenis", v.jenis)
                                        put("sasaran", v.sasaran)
                                        put("wajib", v.wajib)
                                        put("aktif", v.aktif)
                                        if (v.durasi != null) put("durasi", v.durasi)
                                        put("caption", v.caption)
                                    },
                                )
                            }
                        },
                    )
                },
            )
        }
        val isi = situs("/api/studio/rutin", badan)
        isi.teks("pesan") ?: "Pengaturan Story Otomatis disimpan."
    }

    suspend fun aksiRutin(merek: String, aksi: String): String = withContext(Dispatchers.IO) {
        val isi = situs("/api/studio/rutin", buildJsonObject { put("aksi", aksi); put("merek", merek) })
        isi.teks("pesan") ?: "Permintaan Story Otomatis dikirim."
    }

    // ==================== RISET & SAMBUNGAN ====================

    suspend fun risetViral(merek: String, produk: String, topik: String): DataRiset = withContext(Dispatchers.IO) {
        val isi = situs(
            "/api/studio/riset",
            buildJsonObject {
                put("merek", merek)
                put("produk", produk)
                if (topik.isNotBlank()) put("topik", topik.trim())
            },
        )
        val stObj = runCatching { isi["statusJadwal"]?.jsonObject }.getOrNull()
        val statusJadwal = stObj?.let { "${it.teks("status") ?: ""} — ${it.teks("saran") ?: ""}".trim(' ', '—') } ?: ""
        val jamOpt = runCatching { isi["jadwal"]?.jsonArray }.getOrNull()?.mapNotNull { el ->
            val o = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
            "${o.teks("jam") ?: ""} · ${o.teks("label") ?: ""}".trim(' ', '·')
        } ?: emptyList()
        val konsep = runCatching { isi["konsep"]?.jsonArray }.getOrNull()?.mapNotNull { el ->
            val o = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
            KonsepViral(
                judul = o.teks("judul") ?: "Konsep",
                hook = o.teks("hook") ?: "",
                ringkas = o.teks("alur") ?: o.teks("konsep") ?: o.teks("arahan") ?: "",
                cta = o.teks("cta") ?: "",
            )
        } ?: emptyList()
        DataRiset(statusJadwal = statusJadwal, daftarJamOptimal = jamOpt, konsep = konsep)
    }

    suspend fun bacaSambungan(): DataSambungan = withContext(Dispatchers.IO) {
        val isi = situs("/api/studio/sambungan")
        val siap = isi["siap"]?.jsonPrimitive?.booleanOrNull == true
        val merek = runCatching { isi["instagram"]?.jsonArray }.getOrNull()?.mapNotNull { el ->
            val o = runCatching { el.jsonObject }.getOrNull() ?: return@mapNotNull null
            SambunganMerek(
                merek = o.teks("merek") ?: return@mapNotNull null,
                nama = o.teks("nama") ?: "",
                aktif = o["aktif"]?.jsonPrimitive?.booleanOrNull == true,
                igAkun = runCatching { o["akun"]?.jsonObject }.getOrNull()?.teks("akun"),
                tiktokAkun = runCatching { o["tiktok"]?.jsonObject }.getOrNull()?.teks("akun"),
            )
        } ?: emptyList()
        val tg = runCatching { isi["telegram"]?.jsonObject }.getOrNull()
        DataSambungan(
            siap = siap,
            pesan = isi.teks("pesan"),
            merek = merek,
            telegramTerdaftar = tg?.get("terdaftar")?.jsonPrimitive?.booleanOrNull == true,
            telegramWebhook = runCatching { tg?.get("webhook")?.jsonObject }.getOrNull()?.teks("url"),
        )
    }

    suspend fun ubahAktifMerek(merek: String, aktif: Boolean): String = withContext(Dispatchers.IO) {
        val isi = situs("/api/studio/sambungan", buildJsonObject { put("merek", merek); put("aktif", aktif) })
        isi.teks("pesan") ?: "Status merek diperbarui."
    }

    suspend fun pasangWebhookTelegram(): String = withContext(Dispatchers.IO) {
        val isi = situs("/api/studio/sambungan", buildJsonObject { put("pasangWebhook", true) })
        isi.teks("pesan") ?: "Webhook Telegram dipasang."
    }

    // ==================== EDITOR SITUS ====================

    suspend fun bacaKontenSitus(): JsonObject? = withContext(Dispatchers.IO) {
        val el = rest("/konten?select=data&id=eq.situs")
        val arr = runCatching { el?.jsonArray }.getOrNull() ?: return@withContext null
        val pertama = arr.firstOrNull()?.jsonObject ?: return@withContext null
        runCatching { pertama["data"]?.jsonObject }.getOrNull()
    }

    suspend fun simpanKontenSitus(data: JsonObject) = withContext(Dispatchers.IO) {
        val baris = buildJsonObject {
            put("id", "situs")
            put("data", data)
        }
        rest("/konten?on_conflict=id", metode = "POST", badan = baris, prefer = "resolution=merge-duplicates,return=minimal")
        // Segarkan cache ISR situs bakafrawi.com agar langsung tayang
        runCatching { situs("/api/segarkan", buildJsonObject {}) }
        Unit
    }
}
