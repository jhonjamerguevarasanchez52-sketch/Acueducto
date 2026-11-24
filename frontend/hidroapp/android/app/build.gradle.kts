import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firma de release: se lee de android/key.properties (NUNCA se sube al repo,
// ver .gitignore). Si no existe, se avisa y se sigue firmando con la clave de
// debug para que `flutter run --release` funcione en desarrollo, pero un
// build así no debe publicarse.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val tieneKeystoreReal = keystorePropertiesFile.exists()
if (tieneKeystoreReal) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
} else {
    logger.warn(
        "ADVERTENCIA: android/key.properties no existe. El build de release se " +
            "firmará con la clave de debug (ver android/key.properties.example) y " +
            "NO debe publicarse ni distribuirse."
    )
}

android {
    namespace = "com.acueductocampoamor.acueducto_app"
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Identificador de la app en Google Play. Es permanente: una vez subido
        // el primer .aab no se puede cambiar. El `namespace` de arriba es solo
        // el paquete interno del código Kotlin y no tiene que coincidir.
        applicationId = "com.hidroapp.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (tieneKeystoreReal) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (tieneKeystoreReal) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

// El .aab es lo que se sube a Play Store. Firmado con la clave de debug, Play
// Console lo rechaza (y si se perdiera la clave real no se podría actualizar
// la app): sin android/key.properties el bundle de release no se genera.
gradle.taskGraph.whenReady {
    // Solo la tarea que genera el .aab (flutter build appbundle); el APK de
    // prueba (flutter build apk --release) sigue funcionando sin la clave.
    val generaBundleRelease = allTasks.any { it.path == ":app:bundleRelease" }
    if (generaBundleRelease && !tieneKeystoreReal) {
        throw GradleException(
            "Falta android/key.properties: el .aab para Play Store debe firmarse con la " +
                "clave de subida (ver android/key.properties.example)."
        )
    }
}

dependencies {
    // Los temas de arranque heredan de Theme.AppCompat: local_auth lo exige para
    // que el diálogo de huella no cierre la app en Android 8 y anteriores.
    implementation("androidx.appcompat:appcompat:1.7.0")
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
