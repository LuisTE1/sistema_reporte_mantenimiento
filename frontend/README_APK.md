# 📱 Guía para Generar la APK — Control Operativo

## Pre-requisitos en tu PC

Antes de compilar la APK, necesitas instalar:

1. **Android Studio** (incluye JDK, SDK y Gradle)
   - Descarga: https://developer.android.com/studio
   - Durante la instalación, acepta las licencias del SDK

2. **Variables de entorno** (se configuran automáticamente con Android Studio):
   - `ANDROID_HOME` → ruta al SDK de Android
   - `JAVA_HOME` → ruta al JDK

## Pasos para generar la APK

### 1. Preparar el build web
```bash
cd frontend
npm run build
```

### 2. Agregar la plataforma Android (solo la primera vez)
```bash
npx cap add android
```

### 3. Sincronizar los archivos web con el proyecto nativo
```bash
npx cap sync
```

### 4. Abrir en Android Studio
```bash
npx cap open android
```
Esto abrirá Android Studio con el proyecto.

### 5. Generar la APK
En Android Studio:
1. Menú: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Esperar a que compile (~2-5 minutos la primera vez)
3. El APK se genera en: `android/app/build/outputs/apk/debug/app-debug.apk`

### 6. Para APK firmado (producción)
En Android Studio:
1. Menú: **Build** → **Generate Signed Bundle / APK**
2. Crear un keystore nuevo o usar uno existente
3. Seleccionar APK y firmar

## Después de hacer cambios en el código

Cada vez que modifiques el código React:
```bash
npm run build
npx cap sync
```
Luego vuelve a compilar en Android Studio.

## Configuración

- **App ID:** `com.mantenimiento.controloperativo`
- **Nombre:** `Control Operativo`
- **Icono/Splash:** Los puedes personalizar en `android/app/src/main/res/`

## Solución de problemas

| Problema | Solución |
|----------|---------|
| `ANDROID_HOME not set` | Instalar Android Studio y reiniciar terminal |
| Build falla con Gradle | Usar la versión de Gradle incluida en Android Studio |
| Pantalla blanca en APK | Verificar que `vite.config.js` tiene `base: './'` |
| Assets no cargan | Ejecutar `npx cap sync` después del build |
