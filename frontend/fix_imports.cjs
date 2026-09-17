const fs = require('fs');

let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// The imports section is corrupted. Fix it:
// Current bad block at start:
// import React...
// import supabase...
// import Camera...
// import addToOfflineQueue...
//     reader.onload = event => {   <-- this is the middle of compressImage and it's missing the start

// We need to put back the missing beginning of compressImage and add Network import and isSyncingBtn state

const badHeader = `import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { addToOfflineQueue, syncOfflineReports, initNetworkListener } from '../utils/offlineQueue'
    reader.onload = event => {`;

const goodHeader = `import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { addToOfflineQueue, syncOfflineReports } from '../utils/offlineQueue'
import { Network } from '@capacitor/network'

const compressImage = (file, maxWidth = 1024, quality = 0.6) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {`;

if (content.includes(badHeader)) {
  content = content.replace(badHeader, goodHeader);
  fs.writeFileSync('src/components/Operario.jsx', content);
  console.log('SUCCESS: fixed header');
} else {
  console.log('Pattern not found');
  // Show current start
  console.log(JSON.stringify(content.substring(0, 400)));
}
