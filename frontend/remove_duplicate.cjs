const fs = require('fs');

let lines = fs.readFileSync('src/components/Operario.jsx', 'utf8').split('\n');

// Remove lines 352 (0-indexed: 351) to 554 (0-indexed: 553) inclusive
// This removes the duplicate useState/useEffect/function block that was injected

// Find start: line containing "const [pendingProductoText, setPendingProductoText] = useState(null)" 
// but NOT the original one (which should be around line 157)
let firstOccurrence = -1;
let secondOccurrence = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('pendingProductoText, setPendingProductoText') && lines[i].includes('useState')) {
    if (firstOccurrence === -1) firstOccurrence = i;
    else secondOccurrence = i;
  }
}

console.log('First occurrence at line:', firstOccurrence + 1);
console.log('Second occurrence at line:', secondOccurrence + 1);

if (secondOccurrence !== -1) {
  // Find the end of the duplicate block: it ends just before "const handleSubmit"
  let endOfDuplicate = -1;
  for (let i = secondOccurrence; i < lines.length; i++) {
    if (lines[i].includes('const handleSubmit = async')) {
      endOfDuplicate = i - 1;
      break;
    }
  }
  
  console.log('Duplicate block ends before line:', endOfDuplicate + 1);
  
  if (endOfDuplicate !== -1) {
    // Also fix the broken catch block before the duplicate
    // Line secondOccurrence-2 should be "    } catch (error) {"
    // followed by the duplicate, so we need to close it properly
    
    // Remove from secondOccurrence-1 (the broken catch line) to endOfDuplicate
    // And replace with proper catch close
    const beforeDuplicate = lines.slice(0, secondOccurrence - 1); // up to line before "const [pendingProductoText..."
    const afterDuplicate = lines.slice(endOfDuplicate + 1); // from "const handleSubmit..." onwards
    
    // The last valid lines should end with the camera function catch
    // We need: "    } catch (error) {\n      console.log('Camera error or user cancelled:', error);\n    }\n  }\n"
    const repairedLines = [
      ...beforeDuplicate,
      "    } catch (error) {",
      "      console.log('Camera error or user cancelled:', error);",
      "    }",
      "  }",
      "",
      ...afterDuplicate
    ];
    
    fs.writeFileSync('src/components/Operario.jsx', repairedLines.join('\n'));
    console.log('SUCCESS: removed duplicate block');
  }
}
