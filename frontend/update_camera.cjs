const fs = require('fs');
const content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

const target = `  const tomarFotoNativa = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });`;

const replacement = `  const tomarFotoNativa = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        width: 1024,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });`;

fs.writeFileSync('src/components/Operario.jsx', content.replace(target, replacement));
