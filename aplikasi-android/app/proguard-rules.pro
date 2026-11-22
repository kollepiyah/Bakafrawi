# Aturan R8 untuk Bakafrawi Studio (kotlinx.serialization, OkHttp, WorkManager)
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# Pertahankan serializer kotlinx.serialization pada model data
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class * {
    public static kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.bakafrawi.studio.data.**$$serializer { *; }
-keepclassmembers class com.bakafrawi.studio.data.** {
    *** Companion;
}

# OkHttp opsional (Conscrypt / BouncyCastle / OpenJSSE tidak dipakai di Android)
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn javax.annotation.**
