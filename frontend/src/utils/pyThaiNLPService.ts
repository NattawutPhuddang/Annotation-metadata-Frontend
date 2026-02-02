declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodide: any = null;
let isReady = false;

// โค้ด Python จำลอง logic เดิมของคุณใน backend/src/tokenizer.py
const PYTHON_SETUP_CODE = `
import micropip
await micropip.install("pythainlp")

from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_words
from pythainlp.util import Trie

# 1. โหลดคำพื้นฐาน
custom_words = set(thai_words())

# ตัวแปรสำหรับเก็บ Trie (จะถูก update เมื่อ JS ส่ง dictionary มา)
custom_trie = Trie(custom_words)

def update_custom_dict(word_list):
    global custom_trie
    for word in word_list:
        custom_words.add(word)
    # สร้าง Trie ใหม่
    custom_trie = Trie(custom_words)

def tokenize_py(text):
    if not text:
        return []
    # logic แบบเดียวกับ Backend: engine='newmm', keep_whitespace=False
    return word_tokenize(text, engine='newmm', custom_dict=custom_trie, keep_whitespace=False)
`;

export const pyThaiNLPService = {
  // 1. Initialize (เรียกครั้งแรกตอนเข้าเว็บ - ต้องมีเน็ต)
  init: async () => {
    if (isReady) return;
    
    console.log("Loading Pyodide & PyThaiNLP... (This may take a while)");
    
    // โหลด Pyodide
    pyodide = await window.loadPyodide();
    
    // โหลด micropip เพื่อลง library
    await pyodide.loadPackage("micropip");
    
    // รัน setup script (จะ load pythainlp ในขั้นตอนนี้)
    await pyodide.runPythonAsync(PYTHON_SETUP_CODE);
    
    isReady = true;
    console.log("PyThaiNLP is ready!");
    
    // โหลด Custom Dict ทันทีถ้าพร้อม
    await pyThaiNLPService.loadCustomDict();
  },

  // 2. โหลด Custom Dict จากไฟล์ public/custom_dict.txt
  loadCustomDict: async () => {
    if (!isReady) return;
    try {
        const response = await fetch('/custom_dict.txt');
        if (response.ok) {
            const text = await response.text();
            const words = text.split('\n').map(w => w.trim()).filter(w => w);
            
            // ส่ง Array ของคำไปให้ Python
            // Pyodide แปลง JS Array -> Python List ให้อัตโนมัติ
            const pyNamespace = pyodide.globals;
            const updateFunc = pyNamespace.get('update_custom_dict');
            updateFunc(words);
            
            console.log(`Updated Custom Dictionary with ${words.length} words.`);
        }
    } catch (e) {
        console.warn("Failed to load custom_dict.txt", e);
    }
  },

  // 3. ฟังก์ชันตัดคำ (เรียก Python)
  tokenize: (text: string): string[] => {
    if (!isReady) {
        console.warn("PyThaiNLP not ready yet. Returning space-split.");
        return text.split(' ');
    }
    
    try {
        const tokenizeFunc = pyodide.globals.get('tokenize_py');
        const resultProxy = tokenizeFunc(text);
        const result = resultProxy.toJs(); // แปลง Python List -> JS Array
        resultProxy.destroy(); // คืน Memory
        return result;
    } catch (error) {
        console.error("Tokenize Error:", error);
        return text.split(' ');
    }
  },
  
  isReady: () => isReady
};