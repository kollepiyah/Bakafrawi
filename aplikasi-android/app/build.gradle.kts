import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// Tanda tangan rilis dibaca dari keystore.properties (tidak ikut git, ada di mesin Kyai):
// storeFile=…, storePassword=…, keyAlias=…, keyPassword=…
val kunci = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "com.bakafrawi.studio"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.bakafrawi.studio"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        // Satu-satunya alamat yang ditanam: URL Supabase & kunci anon diambil dari situs saat masuk.
        buildConfigField("String", "SITUS", "\"https://bakafrawi.com\"")
    }

    signingConfigs {
        if (kunci.isNotEmpty()) {
            create("rilis") {
                storeFile = rootProject.file(kunci.getProperty("storeFile"))
                storePassword = kunci.getProperty("storePassword")
                keyAlias = kunci.getProperty("keyAlias")
                keyPassword = kunci.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (kunci.isNotEmpty()) signingConfig = signingConfigs.getByName("rilis")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    val bom = platform("androidx.compose:compose-bom:2025.10.00")
    implementation(bom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.work:work-runtime-ktx:2.10.5")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
}
