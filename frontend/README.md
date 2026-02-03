🎧 Audio Annotation Tool (Offline Capable)
ระบบสำหรับฟังไฟล์เสียงและแก้ไขข้อความ (Annotation) รองรับการทำงานแบบ Offline Mode เต็มรูปแบบ โดยใช้ React (Frontend) และ Node.js (Backend) พร้อมระบบตัดคำภาษาไทยด้วย PyThaiNLP ที่รันบน Browser

📖 คู่มือสำหรับผู้ใช้งาน (User Manual)
1. การเริ่มต้นใช้งาน
เปิดหน้าเว็บผ่าน Google Chrome หรือ Microsoft Edge (แนะนำ)

ใส่ รหัสพนักงาน (Employee ID) เพื่อเข้าสู่ระบบ (ระบบจะดึงประวัติการทำงานเก่ามาแสดง)

หากเปิดใช้งานครั้งแรก ต้องต่ออินเทอร์เน็ต เพื่อให้ระบบดาวน์โหลดเครื่องมือตัดคำ (AI Engine) ประมาณ 1 นาที

2. การทำงานแบบ Offline (ไม่มีเน็ต)
ระบบนี้ถูกออกแบบมาให้ทำงานต่อได้แม้เน็ตหลุด หรือ Server ดับ

สังเกตสถานะที่มุมขวาบน:

🟢 Online: ปกติ ข้อมูลถูกเซฟลง Server เรียบร้อย

🟡 Syncing: กำลังส่งข้อมูลที่ทำค้างไว้ขึ้น Server (ห้ามปิดหน้าเว็บ)

🔴 Offline: ไม่มีเน็ต ข้อมูลจะถูกเซฟลงเครื่องตัวเอง (Browser) ปลอดภัย 100%

ข้อจำกัดตอน Offline: จะฟังเสียงไม่ได้ (เพราะไฟล์เสียงอยู่บน Server) แต่สามารถแก้ไข Text และกด Save ได้ตามปกติ

3. ปุ่มและการใช้งาน
Correct (ถูกต้อง): เมื่อข้อความตรงกับเสียงแล้ว กดปุ่มนี้เพื่อบันทึก

Fail (ไม่ถูกต้อง): หากเสียงไม่ชัด หรือมีปัญหา กดปุ่มนี้

Scan Directory (หน้า Upload): ใช้สำหรับอ่านไฟล์ใหม่จากเครื่อง (ไม่ต้องใช้เน็ต)

🛠️ คู่มือสำหรับนักพัฒนา (Developer Guide)
ส่วนนี้สำหรับคนที่มารับงานต่อ (Handover) อธิบายโครงสร้างและ Logic สำคัญ

1. Tech Stack
Frontend: React (TypeScript), create-react-app

State Management: React Context API (AnnotationContext)

Storage: localforage (IndexedDB Wrapper) สำหรับเก็บข้อมูล Offline

AI Engine: Pyodide (Python WebAssembly) เพื่อรัน PyThaiNLP บน Browser

Backend: Node.js, Express (TypeScript)

Database: TSV Files (Text-based database)

2. การติดตั้งและรันโปรเจกต์ (Installation)
Prerequisites
Node.js (v16+)

Python 3.11 (สำหรับจัดการ Environment เบื้องต้น ถ้าจำเป็น)

Backend Setup
Bash
cd backend
npm install
npm start
# Server จะรันที่ http://localhost:3003
Folder Data: ข้อมูลทั้งหมดจะถูกเก็บใน backend/data/ (ต้องสร้างโฟลเดอร์นี้ถ้ายังไม่มี)

Frontend Setup
Bash
cd frontend
npm install
npm start
# Web App จะรันที่ http://localhost:3000
3. โครงสร้างไฟล์สำคัญ (Key Files Structure)
📂 Frontend
src/api/audioService.ts: หัวใจหลัก เชื่อมต่อ API และสลับ Logic Online/Offline

syncOfflineActions: ฟังก์ชันสำหรับส่งข้อมูลที่ค้างในคิวไป Server

src/api/offlineManager.ts: จัดการคิว (Queue) ลง localforage เมื่อไม่มีเน็ต

src/utils/pyThaiNLPService.ts: สำคัญมาก เป็นตัวโหลด Pyodide และติดตั้ง pythainlp แบบ Local

src/context/AnnotationContext.tsx: จัดการ Global State และ Loop Auto-Sync

📂 Public (Static Files)
public/pyodide/: เก็บไฟล์ Engine ของ Python (WASM)

public/wheels/: เก็บไฟล์ .whl สำหรับติดตั้ง Library โดยไม่ต้องต่อเน็ต

ห้ามเปลี่ยนชื่อไฟล์ในนี้เด็ดขาด เพราะ micropip จะอ่าน Metadata จากชื่อไฟล์

4. เจาะลึกระบบ Offline (Deep Dive)
1. การบันทึกข้อมูล (Save Logic) เมื่อ User กด Save (appendTsv):

เช็ค navigator.onLine

ถ้า Online: ยิง fetch ไปหา Server -> ถ้า Error (Server ดับ) -> ลง Offline Queue

ถ้า Offline: ลง Offline Queue ทันที (offlineManager.addAction)

2. การซิงค์ข้อมูล (Auto Sync) ใน AnnotationContext จะมี setInterval วิ่งทุก 5-10 วินาที:

เช็คว่ามี Queue ค้างไหม?

ถ้ามี + มีเน็ต -> เรียก syncOfflineActions()

วนลูปยิง API ทีละรายการ

สำเร็จ -> ลบออกจากคิว

ไม่สำเร็จ -> เก็บไว้ลองใหม่รอบหน้า

เมื่อ Sync หมด -> สั่ง initData() เพื่อโหลดข้อมูลล่าสุดจาก Server มาแสดงผล (แก้ปัญหาข้อมูลย้อนหลัง)

3. ระบบตัดคำ (Tokenizer) เปลี่ยนจากยิง API Python มาเป็นรันบน Browser:

ไฟล์: src/utils/pyThaiNLPService.ts

หลักการ: ใช้ Pyodide โหลด Python Runtime ลง Memory

Dependency: โหลด pythainlp-x.x.x.whl และ tzdata-x.x.x.whl จาก folder public/wheels (เพื่อให้ทำงาน Offline ได้ 100%)

5. วิธีอัปเดต Python Library (ถ้าต้องการเปลี่ยนเวอร์ชัน)
หากต้องการอัปเดต PyThaiNLP:

ดาวน์โหลดไฟล์ .whl เวอร์ชันใหม่จาก PyPI

วางใน frontend/public/wheels/

แก้ไขชื่อไฟล์ใน src/utils/pyThaiNLPService.ts ให้ตรงกับชื่อไฟล์ใหม่เป๊ะๆ

🚨 ปัญหาที่พบบ่อย (Troubleshooting)
Q: หน้าเว็บขึ้น Error "PyThaiNLP failed to load"

A: ตรวจสอบว่าไฟล์ใน public/wheels/ มีครบไหม และชื่อไฟล์ในโค้ด pyThaiNLPService.ts ตรงกับไฟล์จริงหรือไม่

Q: กด Correct แล้วข้อมูลไม่ไป Server

A: ดูที่ปุ่มสถานะ ถ้าขึ้น Offline หรือ Syncing ให้รอสักครู่ ระบบจะทำงานอัตโนมัติเมื่อ Server พร้อม

Q: ฟังเสียงไม่ได้

A: เป็นปกติในโหมด Offline เพราะไฟล์เสียงไม่ได้ถูก Cache ลงเครื่อง (เพื่อประหยัดพื้นที่) เสียงจะมาเมื่อต่อ Server ได้