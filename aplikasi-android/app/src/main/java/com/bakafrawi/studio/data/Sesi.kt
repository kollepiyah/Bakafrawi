package com.bakafrawi.studio.data

import android.content.Context

/**
 * Sesi login & konfigurasi tersimpan di SharedPreferences privat aplikasi (tak terbaca aplikasi lain).
 * Refresh token Supabase memungkinkan pekerja pengingat jalan tanpa Kyai membuka aplikasi.
 */
class Sesi(konteks: Context) {
    private val p = konteks.getSharedPreferences("sesi", Context.MODE_PRIVATE)

    var supabaseUrl: String? by teks("supabase_url")
    var supabaseAnon: String? by teks("supabase_anon")
    var aksesToken: String? by teks("akses")
    var refreshToken: String? by teks("refresh")
    var email: String? by teks("email")

    /** Kapan token akses kedaluwarsa (milidetik epoch). */
    var kedaluwarsa: Long
        get() = p.getLong("kedaluwarsa", 0)
        set(v) = p.edit().putLong("kedaluwarsa", v).apply()

    var pengingatHp: Boolean
        get() = p.getBoolean("pengingat_hp", true)
        set(v) = p.edit().putBoolean("pengingat_hp", v).apply()

    /** Id alarm pengingat yang sedang terpasang, supaya yang usang bisa dibatalkan. */
    var alarmTerpasang: Set<String>
        get() = p.getStringSet("alarm", emptySet()) ?: emptySet()
        set(v) = p.edit().putStringSet("alarm", v).apply()

    val masuk: Boolean get() = refreshToken != null

    fun keluar() {
        p.edit().remove("akses").remove("refresh").remove("email").remove("kedaluwarsa").apply()
    }

    private fun teks(kunci: String) = object : kotlin.properties.ReadWriteProperty<Any?, String?> {
        override fun getValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>) = p.getString(kunci, null)
        override fun setValue(thisRef: Any?, property: kotlin.reflect.KProperty<*>, value: String?) {
            p.edit().putString(kunci, value).apply()
        }
    }
}
