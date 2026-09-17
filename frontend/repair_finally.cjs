const fs = require('fs');

// Lee el archivo actual
let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// Encuentra la línea del try y la del handleNewReport que quedó dentro del finally
// El problema es: setIsSubmitting(false) va seguido de setFechaSuceso que pertence a handleNewReport

// Buscamos el bloque corrupto y lo reemplazamos
const badFinallyBlock = `    } finally {
      // SIEMPRE desbloquear el botón — este bloque se ejecuta pase lo que pase
      setIsSubmitting(false)
    setFechaSuceso(formatDateTimeLocal(new Date()))
    setModulo(type)
  }

  if (!modulo) {`;

const goodFinallyBlock = `    } finally {
      // SIEMPRE desbloquear el botón — este bloque se ejecuta pase lo que pase
      setIsSubmitting(false)
    }
  }

  const handleNewReport = (type) => {
    setEditingReportId(null)
    setOldRepuestoText(null)
    setDescripcion('')
    setFotos([])
    setExistingFotos([])
    setFechaSuceso(formatDateTimeLocal(new Date()))
    setModulo(type)
  }

  if (!modulo) {`;

if (content.includes(badFinallyBlock)) {
  content = content.replace(badFinallyBlock, goodFinallyBlock);
  fs.writeFileSync('src/components/Operario.jsx', content);
  console.log('SUCCESS: fixed finally block and restored handleNewReport');
} else {
  console.log('Pattern not found — showing surrounding context...');
  const idx = content.indexOf('setIsSubmitting(false)\n    setFechaSuceso');
  if (idx !== -1) {
    console.log(JSON.stringify(content.substring(idx - 100, idx + 300)));
  }
}
