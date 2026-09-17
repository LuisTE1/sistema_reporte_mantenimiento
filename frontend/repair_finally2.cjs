const fs = require('fs');

let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// The exact corrupted block (with mixed line endings)
const bad = `      setIsSubmitting(false)\n    setFechaSuceso(formatDateTimeLocal(new Date()))\r\n    setModulo(type)\r\n  }\r\n\r\n  if (!modulo) {`;

const good = `      setIsSubmitting(false)\n    }\n  }\n\n  const handleNewReport = (type) => {\n    setEditingReportId(null)\n    setOldRepuestoText(null)\n    setDescripcion('')\n    setFotos([])\n    setExistingFotos([])\n    setFechaSuceso(formatDateTimeLocal(new Date()))\n    setModulo(type)\n  }\n\n  if (!modulo) {`;

if (content.includes(bad)) {
  content = content.replace(bad, good);
  fs.writeFileSync('src/components/Operario.jsx', content);
  console.log('SUCCESS: Fixed!');
} else {
  // try different line endings
  const bad2 = "      setIsSubmitting(false)\n    setFechaSuceso(formatDateTimeLocal(new Date()))\n    setModulo(type)\n  }\n\n  if (!modulo) {";
  if (content.includes(bad2)) {
    const good2 = "      setIsSubmitting(false)\n    }\n  }\n\n  const handleNewReport = (type) => {\n    setEditingReportId(null)\n    setOldRepuestoText(null)\n    setDescripcion('')\n    setFotos([])\n    setExistingFotos([])\n    setFechaSuceso(formatDateTimeLocal(new Date()))\n    setModulo(type)\n  }\n\n  if (!modulo) {";
    content = content.replace(bad2, good2);
    fs.writeFileSync('src/components/Operario.jsx', content);
    console.log('SUCCESS via variant 2');
  } else {
    // brute force: split by the anchor and reconstruct
    const anchor = "setIsSubmitting(false)";
    const afterAnchor = "setFechaSuceso(formatDateTimeLocal";
    const idx = content.indexOf(anchor);
    const idx2 = content.indexOf(afterAnchor, idx);
    if (idx !== -1 && idx2 !== -1 && idx2 - idx < 200) {
      const before = content.substring(0, idx + anchor.length);
      const after = content.substring(idx2);
      const repaired = before + "\n    }\n  }\n\n  const handleNewReport = (type) => {\n    setEditingReportId(null)\n    setOldRepuestoText(null)\n    setDescripcion('')\n    setFotos([])\n    setExistingFotos([])\n    " + after;
      fs.writeFileSync('src/components/Operario.jsx', repaired);
      console.log('SUCCESS via brute force');
    } else {
      console.log('FAILED. idx=' + idx + ', idx2=' + idx2);
    }
  }
}
