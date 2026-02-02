declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodide: any = null;
let isReady = false;

// โค้ด Python สำหรับ setup
const PYTHON_SETUP_CODE = `
import micropip
await micropip.install("pythainlp")

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

    console.log("Checking Pyodide availability...");

    // 🔴 1. เช็คว่ามีฟังก์ชัน loadPyodide หรือยัง ถ้ายังไม่มี ให้โหลด Script เองเดี๋ยวนี้เลย
    if (typeof window.loadPyodide !== "function") {
        console.log("Pyodide script not loaded. Loading dynamically...");
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
            script.onload = () => {
                console.log("Pyodide script loaded successfully.");
                resolve();
            };
            script.onerror = (e) => reject(new Error("Failed to load Pyodide script"));
            document.head.appendChild(script);
        });
    }

    // 2. ถึงตรงนี้มั่นใจได้ว่า window.loadPyodide มีตัวตนแล้ว
    console.log("Initializing Pyodide...");
    pyodide = await window.loadPyodide();

    // 3. โหลด micropip และรัน setup code
    await pyodide.loadPackage("micropip");
    await pyodide.runPythonAsync(PYTHON_SETUP_CODE);

    isReady = true;
    console.log("PyThaiNLP is ready!");

    // 4. โหลด Custom Dict ต่อทันที
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