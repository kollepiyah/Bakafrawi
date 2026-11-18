package com.bakafrawi.studio

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.bakafrawi.studio.data.Api
import com.bakafrawi.studio.data.Sesi
import com.bakafrawi.studio.pengingat.Pengingat
import com.bakafrawi.studio.ui.LayarMasuk
import com.bakafrawi.studio.ui.LayarUtama
import com.bakafrawi.studio.ui.TemaBakafrawi

class MainActivity : ComponentActivity() {
    private val izinNotif = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val sesi = Sesi(this)
        val api = Api(sesi)
        Pengingat.siapkanSaluran(this)
        if (Build.VERSION.SDK_INT >= 33) izinNotif.launch(Manifest.permission.POST_NOTIFICATIONS)

        setContent {
            TemaBakafrawi {
                var masuk by remember { mutableStateOf(sesi.masuk) }
                if (masuk) {
                    LayarUtama(api, sesi, keluar = {
                        Pengingat.batalSemua(this)
                        sesi.keluar()
                        masuk = false
                    })
                } else {
                    LayarMasuk(api) {
                        Pengingat.jadwalkanPekerja(this)
                        masuk = true
                    }
                }
            }
        }
        if (sesi.masuk) Pengingat.jadwalkanPekerja(this)
    }
}
