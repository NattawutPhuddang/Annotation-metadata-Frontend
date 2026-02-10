declare global {
  interface Window {
    loadPyodide: any;
  }
}

let pyodide: any = null;
let isReady = false;

// ✅ แยกโค้ด Setup เป็นส่วนๆ เพื่อรันทีละขั้นตอน
const PYTHON_INSTALL_WHEELS = `
import micropip
import js

try:
    # 1. ติดตั้ง tzdata (ชื่อไฟล์ตามที่คุณมี)
    await micropip.install("/wheels/tzdata-2025.3-py2.py3-none-any.whl")

    # 2. ติดตั้ง pythainlp (ชื่อไฟล์ตามที่คุณมี)
    await micropip.install("/wheels/pythainlp-5.2.0-py3-none-any.whl", deps=False)
    
except Exception as e:
    js.console.error(f"Wheel Install Error: {e}")
    raise e
`;

const PYTHON_MAIN_LOGIC = `
from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_words
from pythainlp.util import Trie

# สร้าง Trie เริ่มต้น
custom_words = set(thai_words())
custom_trie = Trie(custom_words)

def update_custom_dict_py(word_list_js):
    global custom_trie, custom_words
    words = word_list_js.to_py()
    for word in words:
        custom_words.add(word)
    custom_trie = Trie(custom_words)

def tokenize_py(text):
    if not text: return []
    return word_tokenize(text, engine='newmm', custom_dict=custom_trie, keep_whitespace=False)
`;

export const pyThaiNLPService = {
  init: async () => {
    if (isReady) return;

    console.log("Initializing Pyodide (Local Offline Mode)...");

    try {
      // 1. โหลด Pyodide Core
      if (!pyodide) {
          pyodide = await window.loadPyodide({
            indexURL: "/pyodide"
          });
      }

      // 2. ✅ โหลด Micropip (สำคัญมาก ต้องรอก่อนรัน Python)
      // ถ้าบรรทัดนี้ผ่าน แสดงว่า micropip พร้อมใช้งาน
      console.log("Loading micropip...");
      await pyodide.loadPackage("micropip");

      // 3. 🛡️ ตรวจสอบความพร้อม (Self-Check)
      // ลองรัน import micropip เพื่อยืนยันว่าไม่มี Error
      try {
          await pyodide.runPythonAsync("import micropip");
      } catch (e) {
          // ถ้า Error ตรงนี้ แสดงว่า loadPackage ข้างบนมีปัญหา (อาจจะไม่มีไฟล์ lock)
          console.warn("Standard load failed. Attempting manual load of micropip...");
          // Fallback: ลองโหลดจากไฟล์ตรงๆ (ถ้าคุณมีไฟล์นี้ใน public/pyodide/)
          try {
             await pyodide.loadPackage("/pyodide/packaging-23.1-py3-none-any.whl");
             await pyodide.loadPackage("/pyodide/micropip-0.5.0-py3-none-any.whl");
          } catch (manualErr) {
             console.error("Manual load failed too. Check public/pyodide folder.");
             throw e;
          }
      }

      // 4. ติดตั้ง Custom Wheels (tzdata, pythainlp)
      console.log("Installing Custom Wheels...");
      await pyodide.runPythonAsync(PYTHON_INSTALL_WHEELS);

      // 5. รัน Logic หลัก
      console.log("Setting up NLP Logic...");
      await pyodide.runPythonAsync(PYTHON_MAIN_LOGIC);

      isReady = true;
      console.log("PyThaiNLP (Offline) is ready!");

      // 6. โหลด Custom Dictionary
      await pyThaiNLPService.loadCustomDict();

    } catch (e) {
      console.error("PyThaiNLP Init Failed:", e);
      // ไม่ต้อง throw e ออกไป เพื่อให้ App ยังทำงานต่อได้ (แต่ tokenize จะใช้ fallback)
    }
  },

  loadCustomDict: async () => {
    if (!isReady || !pyodide) return;
    try {
        const response = await fetch('/custom_dict.txt');
        if (response.ok) {
            const text = await response.text();
            const words = text.split('\n').map(w => w.trim()).filter(w => w);
            if (words.length > 0) {
                const updateFunc = pyodide.globals.get('update_custom_dict_py');
                updateFunc(words);
                updateFunc.destroy();
                console.log(`Updated Custom Dictionary with ${words.length} words.`);
            }
        }
    } catch (e) {
        console.warn("Failed to load custom_dict.txt", e);
    }
  },

  tokenize: async (text: string): Promise<string[]> => {
    // Fallback ถ้า Pyodide ยังไม่พร้อม หรือพัง
    if (!isReady || !pyodide) return text.split(' ');
    
    try {
        const tokenizeFunc = pyodide.globals.get('tokenize_py');
        const resultProxy = tokenizeFunc(text);
        const result = resultProxy.toJs();
        
        resultProxy.destroy(); 
        tokenizeFunc.destroy();
        
        return result;
    } catch (error) {
        console.error("Tokenize Error:", error);
        return text.split(' ');
    }
  },
  
  isReady: () => isReady
};