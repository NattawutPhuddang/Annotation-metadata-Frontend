declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodide: any = null;
let isReady = false;

// โค้ด Python setup (เหมือนเดิม)
const PYTHON_SETUP_CODE = `
import micropip

# 1. ติดตั้งจากไฟล์ local (wheels)
# ต้องใส่ path ให้ตรงกับที่เราวางไว้ใน public
await micropip.install("/wheels/tzdata.whl")
await micropip.install("/wheels/pythainlp.whl")

from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_words
from pythainlp.util import Trie

custom_words = set(thai_words())
custom_trie = Trie(custom_words)

def update_custom_dict(word_list):
    global custom_trie
    for word in word_list:
        custom_words.add(word)
    custom_trie = Trie(custom_words)

def tokenize_py(text):
    if not text:
        return []
    return word_tokenize(text, engine='newmm', custom_dict=custom_trie, keep_whitespace=False)
`;

export const pyThaiNLPService = {
  init: async () => {
    if (isReady) return;

    console.log("Initializing Pyodide (Local Offline Mode)...");

    // ไม่ต้องเช็ค loadPyodide แล้ว เพราะเราใส่ script ไว้ใน index.html แล้วและเป็น local file
    
    // 1. โหลด Pyodide โดยบอก path ว่าไฟล์ .wasm/.zip อยู่ที่ไหน
    // indexURL: "/pyodide" คือบอกให้ไปหาไฟล์ที่ folder public/pyodide
    pyodide = await window.loadPyodide({
        indexURL: "/pyodide"
    });

    // 2. โหลด micropip (มันมีมากับ Pyodide อยู่แล้วใน repodata.json)
    await pyodide.loadPackage("micropip");
    
    // 3. รัน setup (ซึ่งจะไปโหลด .whl จาก folder wheels)
    await pyodide.runPythonAsync(PYTHON_SETUP_CODE);

    isReady = true;
    console.log("PyThaiNLP (Offline) is ready!");

    // 4. โหลด Custom Dict
    await pyThaiNLPService.loadCustomDict();
  },
  
  loadCustomDict: async () => {
    if (!isReady) return;
    try {
        const response = await fetch('/custom_dict.txt');
        if (response.ok) {
            const text = await response.text();
            const words = text.split('\n').map(w => w.trim()).filter(w => w);
            
            const pyNamespace = pyodide.globals;
            const updateFunc = pyNamespace.get('update_custom_dict');
            updateFunc(words);
            
            console.log(`Updated Custom Dictionary with ${words.length} words.`);
        }
    } catch (e) {
        console.warn("Failed to load custom_dict.txt (Using standard dict)", e);
    }
  },

  tokenize: (text: string): string[] => {
    if (!isReady) {
        // Fallback ระหว่างรอโหลด
        return text.split(' ');
    }
    
    try {
        const tokenizeFunc = pyodide.globals.get('tokenize_py');
        const resultProxy = tokenizeFunc(text);
        const result = resultProxy.toJs();
        resultProxy.destroy();
        return result;
    } catch (error) {
        console.error("Tokenize Error:", error);
        return text.split(' ');
    }
  },
  
  isReady: () => isReady
};