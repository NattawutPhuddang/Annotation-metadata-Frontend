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

# 1. ติดตั้ง tzdata
await micropip.install("/wheels/tzdata-2025.3-py2.py3-none-any.whl")

# 2. ติดตั้ง pythainlp (deps=False)
await micropip.install("/wheels/pythainlp-5.2.0-py3-none-any.whl", deps=False)

from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_words
from pythainlp.util import Trie

# ... (Logic เดิม) ...
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

    // 1. โหลด Pyodide Core
    pyodide = await window.loadPyodide({
        indexURL: "/pyodide"
    });

    // 2. โหลด Micropip และ Packaging แบบระบุไฟล์ตรงๆ (Manual Load)
    // เพื่อความชัวร์ว่ามันจะไม่งงกับ repodata.json
    console.log("Loading micropip from local wheels...");
    try {
        await pyodide.loadPackage("/pyodide/packaging-23.1-py3-none-any.whl");
        await pyodide.loadPackage("/pyodide/micropip-0.5.0-py3-none-any.whl");
    } catch (e) {
        console.error("Failed to load micropip/packaging wheels. Please check filenames in public/pyodide/", e);
        throw e;
    }
    
    // 3. รัน Setup Script
    console.log("Installing PyThaiNLP...");
    await pyodide.runPythonAsync(PYTHON_SETUP_CODE);

    isReady = true;
    console.log("PyThaiNLP (Offline) is ready!");

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