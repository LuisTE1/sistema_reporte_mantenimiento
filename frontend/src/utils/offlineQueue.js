import { get, set } from 'idb-keyval';
import { supabase } from '../supabaseClient';
import { Network } from '@capacitor/network';
import { invalidateCache, invalidateAllCache } from './cache';

const QUEUE_KEY = 'offline_reports_queue';

// Flag para evitar sincronizaciones simultáneas que causan duplicados
let isSyncing = false;

/**
 * Agrega un reporte a la cola offline usando IndexedDB
 */
export const addToOfflineQueue = async (reportData) => {
  try {
    const existingQueue = await get(QUEUE_KEY) || [];
    const newReport = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      data: reportData,
      status: 'pending'
    };
    existingQueue.push(newReport);
    await set(QUEUE_KEY, existingQueue);
    return true;
  } catch (error) {
    console.error('Error adding to offline queue:', error);
    return false;
  }
};

/**
 * Obtiene todos los reportes pendientes
 */
export const getOfflineQueue = async () => {
  try {
    return await get(QUEUE_KEY) || [];
  } catch (error) {
    console.error('Error getting offline queue:', error);
    return [];
  }
};

/**
 * Elimina un reporte específico de la cola (ANTES de insertar para evitar duplicados)
 */
const removeFromQueue = async (reportId) => {
  try {
    const existingQueue = await get(QUEUE_KEY) || [];
    const filteredQueue = existingQueue.filter(report => report.id !== reportId);
    await set(QUEUE_KEY, filteredQueue);
  } catch (error) {
    console.error('Error removing from offline queue:', error);
  }
};

/**
 * Intenta sincronizar todos los reportes pendientes.
 * Tiene un guard de "isSyncing" para evitar ejecuciones simultáneas que causarían duplicados.
 * Retorna: { total, synced, offline }
 *   - total: cuántos reportes había en cola
 *   - synced: cuántos se subieron
 *   - offline: si no había internet
 */
export const syncOfflineReports = async () => {
  // Evitar ejecuciones simultáneas
  if (isSyncing) {
    return { total: 0, synced: 0, offline: false, alreadyRunning: true };
  }

  const queue = await getOfflineQueue();
  if (queue.length === 0) return { total: 0, synced: 0, offline: false };

  // Verificar estado real de conexión
  try {
    const status = await Network.getStatus();
    if (!status.connected) {
      return { total: queue.length, synced: 0, offline: true };
    }
  } catch (e) {
    return { total: queue.length, synced: 0, offline: true };
  }

  isSyncing = true;
  let syncedCount = 0;

  for (const report of queue) {
    try {
      const { data: payload } = report;
      const { fotosObj, dbPayload } = payload;

      // Si el reporte ya traía fotos subidas de un intento anterior (ej: la
      // subida de fotos funcionó pero el guardado del reporte falló), esas
      // URLs ya están en dbPayload.fotos: las conservamos en vez de volver a
      // subir esas mismas fotos y duplicarlas en el Storage.
      const publicUrls = (dbPayload.fotos && dbPayload.fotos !== 'Pendiente offline')
        ? dbPayload.fotos.split(',').filter(Boolean)
        : [];

      // 1. Subir solo las fotos que todavía faltan
      if (fotosObj && fotosObj.length > 0) {
        for (const foto of fotosObj) {
          try {
            const fileExt = foto.name ? foto.name.split('.').pop() : 'jpg';
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `reportes/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, foto, { cacheControl: '31536000' });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(filePath);
              publicUrls.push(urlData.publicUrl);
            }
          } catch (fotoErr) {
            console.error('Error uploading offline photo:', fotoErr);
          }
        }
      }

      // Armar el string de fotos
      dbPayload.fotos = publicUrls.length > 0 ? publicUrls.join(',') : 'Sin foto';

      // 2. PRIMERO remover de la cola, LUEGO insertar en BD
      // Esto evita duplicados si la app se cierra en medio de la sincronización
      await removeFromQueue(report.id);

      // 3. Insertar en base de datos
      const { error: insertError } = await supabase.from('reportes').insert([dbPayload]);

      if (insertError) {
        console.error('Error inserting offline report:', insertError.message);
        // Reencolamos para reintentar más tarde, pero SIN las fotos como
        // archivos (ya están subidas y su URL quedó en dbPayload.fotos),
        // así el próximo intento no las vuelve a subir.
        const currentQueue = await get(QUEUE_KEY) || [];
        currentQueue.push({ ...report, data: { dbPayload, fotosObj: [] }, status: 'pending' });
        await set(QUEUE_KEY, currentQueue);
      } else {
        syncedCount++;
        invalidateCache('operario_reportes');
      }

    } catch (err) {
      console.error(`Error sincronizando reporte offline ${report.id}:`, err);
    }
  }
  
  isSyncing = false;
  return { total: queue.length, synced: syncedCount, offline: false };
};

/**
 * Configura el listener de red global.
 * Cuando vuelve internet, dispara la sincronización automática.
 */
export const initNetworkListener = () => {
  Network.addListener('networkStatusChange', async status => {
    if (status.connected) {
      // Al volver la señal, lo cacheado mientras estuvo sin internet puede
      // haber quedado desactualizado (reportes nuevos de otros usuarios,
      // etc.). Se borra todo el caché y se avisa a las pantallas abiertas
      // para que recarguen solas, sin que el usuario tenga que salir y
      // volver a entrar a la app.
      invalidateAllCache();
      window.dispatchEvent(new Event('sm-reconectado'));

      const result = await syncOfflineReports();
      if (result.synced > 0) {
        console.log(`✅ Sincronización automática: ${result.synced} reportes enviados.`);
      }
    }
  });
};
