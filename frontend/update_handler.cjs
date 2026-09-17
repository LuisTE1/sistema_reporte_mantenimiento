const fs = require('fs');
const content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

const target = `  const handleFileChange = (e) => {
    const filesArray = Array.from(e.target.files)
    const newFotos = filesArray.map(file => ({
      file: file,
      preview: URL.createObjectURL(file)
    }))
    setFotos(prev => [...prev, ...newFotos])
    e.target.value = ''
  }`;

const replacement = `  const handleFileChange = async (e) => {
    const filesArray = Array.from(e.target.files)
    const compressedFiles = await Promise.all(
      filesArray.map(async file => {
        try {
          const compressed = await compressImage(file, 1024, 0.6);
          return { file: compressed, preview: URL.createObjectURL(compressed) };
        } catch (err) {
          console.error("Error compressing image:", err);
          return { file: file, preview: URL.createObjectURL(file) };
        }
      })
    )
    setFotos(prev => [...prev, ...compressedFiles])
    e.target.value = ''
  }`;

fs.writeFileSync('src/components/Operario.jsx', content.replace(target, replacement));
