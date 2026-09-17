const fs = require('fs');
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// Import Network
const importTarget = `import { addToOfflineQueue, syncOfflineReports, initNetworkListener } from '../utils/offlineQueue'`;
const importReplacement = `import { addToOfflineQueue, syncOfflineReports, initNetworkListener } from '../utils/offlineQueue'
import { Network } from '@capacitor/network'`;
if (!content.includes(`import { Network } from '@capacitor/network'`)) {
  content = content.replace(importTarget, importReplacement);
}

// Replace navigator.onLine with Network.getStatus
const navTarget = `if (!navigator.onLine) {`;
const navReplacement = `const networkStatus = await Network.getStatus();
    if (!networkStatus.connected) {`;
content = content.replace(navTarget, navReplacement);

// Just to be safe, also wrap the whole Supabase logic in a timeout or handle the try-catch so it doesn't get stuck forever
// But for now Network.getStatus() is enough.

fs.writeFileSync('src/components/Operario.jsx', content);
