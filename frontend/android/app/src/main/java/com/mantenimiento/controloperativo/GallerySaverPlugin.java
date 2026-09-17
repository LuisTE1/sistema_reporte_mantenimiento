package com.mantenimiento.controloperativo;

import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Guarda una imagen directamente en la Galería del celular (colección
 * pública de Fotos de Android) sin pasar por el selector de "Compartir".
 *
 * En Android 10+ (API 29+) esto NO requiere ningún permiso: el sistema
 * permite a cualquier app insertar archivos nuevos en la colección pública
 * de MediaStore.Images sin acceso al almacenamiento en general (ese es el
 * modelo de "scoped storage"). Por eso no se pide permiso de almacenamiento
 * en ningún lado de la app.
 *
 * En Android 9 o anterior (API 24-28) sí hace falta el permiso clásico
 * WRITE_EXTERNAL_STORAGE, declarado en el manifest solo hasta esa versión.
 */
@CapacitorPlugin(name = "GallerySaver")
public class GallerySaverPlugin extends Plugin {

    @PluginMethod
    public void saveBase64Image(PluginCall call) {
        String base64Data = call.getString("data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "image/jpeg");

        if (base64Data == null || fileName == null) {
            call.reject("Falta 'data' o 'fileName'");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            Context context = getContext();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ControlOperativo");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                Uri item = context.getContentResolver().insert(collection, values);
                if (item == null) {
                    call.reject("No se pudo crear el archivo en la galería");
                    return;
                }

                try (OutputStream out = context.getContentResolver().openOutputStream(item)) {
                    if (out == null) {
                        call.reject("No se pudo abrir el archivo para escribir");
                        return;
                    }
                    out.write(bytes);
                }

                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                context.getContentResolver().update(item, values, null, null);
            } else {
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File appDir = new File(picturesDir, "ControlOperativo");
                if (!appDir.exists()) appDir.mkdirs();
                File outFile = new File(appDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(bytes);
                }
                MediaScannerConnection.scanFile(context, new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
            }

            JSObject ret = new JSObject();
            ret.put("saved", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error guardando en galería: " + e.getMessage(), e);
        }
    }
}
