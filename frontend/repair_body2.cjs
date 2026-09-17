const fs = require('fs');

let content = fs.readFileSync('src/components/Operario.jsx', 'utf8');

// Mixed line endings \r\n
const broken = `      img.onerror = error => reject(error);\r\n  const [unidadesCarretas, setUnidadesCarretas] = useState([])`;

const fixed = `      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};


export default function Operario({ onLogout, user, onSwitchView, reportToEdit, setReportToEdit }) {
  const [modulo, setModulo] = useState(null)
  const [isSyncingBtn, setIsSyncingBtn] = useState(false)
  
  // Datos Reales de Supabase
  const [estaciones, setEstaciones] = useState([])
  const [islasLados, setIslasLados] = useState([])
  const [unidadesTractos, setUnidadesTractos] = useState([])
  const [unidadesCarretas, setUnidadesCarretas] = useState([])`;

if (content.includes(broken)) {
  content = content.replace(broken, fixed);
  fs.writeFileSync('src/components/Operario.jsx', content);
  console.log('SUCCESS');
} else {
  // Brute-force: find exact bytes
  const idx = content.indexOf('img.onerror = error => reject(error);');
  const idx2 = content.indexOf('const [unidadesCarretas');
  if (idx !== -1 && idx2 !== -1) {
    const insertStr = `      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};


export default function Operario({ onLogout, user, onSwitchView, reportToEdit, setReportToEdit }) {
  const [modulo, setModulo] = useState(null)
  const [isSyncingBtn, setIsSyncingBtn] = useState(false)
  
  // Datos Reales de Supabase
  const [estaciones, setEstaciones] = useState([])
  const [islasLados, setIslasLados] = useState([])
  const [unidadesTractos, setUnidadesTractos] = useState([])
  `;
    const before = content.substring(0, idx);
    const after = content.substring(idx2);
    content = before + insertStr + after;
    fs.writeFileSync('src/components/Operario.jsx', content);
    console.log('SUCCESS via brute force');
  } else {
    console.log('FAILED. idx1=', idx, 'idx2=', idx2);
  }
}
