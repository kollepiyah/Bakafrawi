package com.bakafrawi.studio.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Warna sama dengan situs (src/app/globals.css): gelap dengan aksen emas.
val Emas = Color(0xFFC9A24B)
val EmasMuda = Color(0xFFE3C989)
val Redup = Color(0xFF9AA1AD)
val Kartu = Color(0xFF13161C)

private val skema = darkColorScheme(
    primary = Emas,
    onPrimary = Color(0xFF1A1408),
    secondary = EmasMuda,
    background = Color(0xFF0C0E12),
    onBackground = Color(0xFFE9EAEE),
    surface = Color(0xFF0C0E12),
    onSurface = Color(0xFFE9EAEE),
    surfaceVariant = Kartu,
    onSurfaceVariant = Redup,
    surfaceContainer = Kartu,
    surfaceContainerHigh = Color(0xFF1A1E25),
    outline = Color(0x33FFFFFF),
    error = Color(0xFFF87171),
)

@Composable
fun TemaBakafrawi(isi: @Composable () -> Unit) = MaterialTheme(colorScheme = skema, content = isi)
