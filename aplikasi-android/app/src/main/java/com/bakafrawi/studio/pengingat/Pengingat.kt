package com.bakafrawi.studio.pengingat

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.bakafrawi.studio.MainActivity
import com.bakafrawi.studio.R
import com.bakafrawi.studio.data.Acara
import com.bakafrawi.studio.data.Api
import com.bakafrawi.studio.data.Sesi
import com.bakafrawi.studio.instan
import com.bakafrawi.studio.jamWib
import java.time.Duration
import java.time.Instant
import java.util.concurrent.TimeUnit

// Pengingat di HP: 30 menit sebelum acara. Alarm tak-persis (setAndAllowWhileIdle) cukup untuk
// pengingat 30 menit dan tak butuh izin "alarm tepat waktu". Pekerja tiap jam menyegarkan daftar
// alarm dari server, jadi acara yang ditambah lewat Telegram/Google ikut terpasang (juga sesudah HP restart).

private const val SALURAN = "pengingat"
private const val MENIT_SEBELUM = 30L

object Pengingat {
    fun siapkanSaluran(k: Context) {
        val m = k.getSystemService(NotificationManager::class.java)
        m.createNotificationChannel(NotificationChannel(SALURAN, "Pengingat acara", NotificationManager.IMPORTANCE_HIGH))
    }

    /** Pekerja penyegar alarm tiap jam (bertahan walau HP dinyalakan ulang). */
    fun jadwalkanPekerja(k: Context) {
        val kerja = PeriodicWorkRequestBuilder<PekerjaPengingat>(1, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(k).enqueueUniquePeriodicWork("pengingat", ExistingPeriodicWorkPolicy.KEEP, kerja)
    }

    private fun niat(k: Context, a: Acara?, kunci: String): PendingIntent {
        val i = Intent(k, PenerimaPengingat::class.java).setAction("pengingat:$kunci")
        if (a != null) {
            i.putExtra("judul", a.judul).putExtra("jam", jamWib(a.mulai)).putExtra("lokasi", a.lokasi)
        }
        return PendingIntent.getBroadcast(k, kunci.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** Pasang alarm untuk acara 48 jam ke depan; batalkan alarm acara yang sudah tidak ada/digeser. */
    fun pasang(k: Context, acara: List<Acara>) {
        val sesi = Sesi(k)
        val am = k.getSystemService(AlarmManager::class.java)
        val kini = Instant.now()
        val baru = mutableSetOf<String>()
        if (sesi.pengingatHp) {
            for (a in acara) {
                if (a.seharian) continue
                val saat = instan(a.mulai).minus(Duration.ofMinutes(MENIT_SEBELUM))
                if (!saat.isAfter(kini) || saat.isAfter(kini.plus(Duration.ofHours(48)))) continue
                val kunci = "${a.id}@${a.mulai}"
                baru += kunci
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, saat.toEpochMilli(), niat(k, a, kunci))
            }
        }
        for (lama in sesi.alarmTerpasang - baru) am.cancel(niat(k, null, lama))
        sesi.alarmTerpasang = baru
    }

    fun batalSemua(k: Context) {
        val am = k.getSystemService(AlarmManager::class.java)
        val sesi = Sesi(k)
        for (lama in sesi.alarmTerpasang) am.cancel(niat(k, null, lama))
        sesi.alarmTerpasang = emptySet()
    }
}

class PenerimaPengingat : BroadcastReceiver() {
    override fun onReceive(k: Context, intent: Intent) {
        if (ContextCompat.checkSelfPermission(k, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val judul = intent.getStringExtra("judul") ?: return
        val lokasi = intent.getStringExtra("lokasi")
        val buka = PendingIntent.getActivity(k, 0, Intent(k, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notif = NotificationCompat.Builder(k, SALURAN)
            .setSmallIcon(R.drawable.ikon_depan)
            .setContentTitle(judul)
            .setContentText("Pukul ${intent.getStringExtra("jam")} WIB${if (lokasi.isNullOrBlank()) "" else " · $lokasi"} — 30 menit lagi")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(buka)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(k).notify(intent.action.hashCode(), notif)
    }
}

class PekerjaPengingat(k: Context, p: WorkerParameters) : CoroutineWorker(k, p) {
    override suspend fun doWork(): Result {
        val sesi = Sesi(applicationContext)
        if (!sesi.masuk) return Result.success()
        return try {
            val kini = Instant.now()
            Pengingat.pasang(applicationContext, Api(sesi).agenda(kini, kini.plus(Duration.ofHours(49))))
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
