# My Trip

แอปวางแผนทริปบนมือถือ ตัวหน้าเว็บอยู่บน GitHub Pages ส่วนข้อมูลเก็บใน Google Sheet และไฟล์ใบจองเก็บใน Google Drive ใช้ Gemini อ่านใบจอง (แบบฟรี) ใช้ฟรีทั้งหมด

```
index.html                  หน้าเว็บ (อัปขึ้น GitHub)
apps-script/Code.gs         หลังบ้าน (วางใน Apps Script ของ Google Sheet)
apps-script/ImportOldTrip.gs  ย้ายทริป Tokyo 2026 จากแอปเวอร์ชันเดิม (ใช้ครั้งเดียว)
```

---

## ขั้นที่ 1 · สร้างหลังบ้านใน Google Sheet (ประมาณ 10 นาที)

1. เปิด **sheets.new** สร้างชีตใหม่ ตั้งชื่อเช่น `My Trip data`
2. เมนู **ส่วนขยาย → Apps Script**
3. ในไฟล์ `Code.gs` ลบโค้ดเดิมทิ้งทั้งหมด แล้ววางเนื้อหาจาก `apps-script/Code.gs` กด 💾 บันทึก
4. (ถ้าจะย้ายทริปเดิม) กด **+ → Script** ตั้งชื่อ `ImportOldTrip` แล้ววางเนื้อหาจาก `apps-script/ImportOldTrip.gs` กดบันทึก

### ขอ Gemini API key (ฟรี)

5. เปิด **aistudio.google.com/apikey** ล็อกอินด้วยบัญชี Google เดียวกัน กด **Create API key** แล้วคัดลอก key
6. กลับไปที่ Apps Script กดไอคอน ⚙️ **Project Settings** เลื่อนลงไปที่ **Script properties** กด **Add script property**
   - Property: `GEMINI_API_KEY`
   - Value: วาง key ที่คัดลอกมา
   - กด **Save script properties**

### ให้สิทธิ์และเปิดเป็นเว็บแอป

7. กลับไปหน้าโค้ด (ไอคอน `<>`) เลือกฟังก์ชัน **setup** ในแถบด้านบน แล้วกด **Run**
   - จะมีหน้าขอสิทธิ์ขึ้น กด **Review permissions** → เลือกบัญชี
   - ถ้าขึ้นว่า "Google hasn't verified this app" กด **Advanced → Go to … (unsafe)** แล้ว **Allow**
     (เป็นสคริปต์ที่คุณสร้างเอง จึงยังไม่ผ่านการรับรองจาก Google เป็นเรื่องปกติ)
8. (ถ้าจะย้ายทริปเดิม) เลือกฟังก์ชัน **importOldTrip** แล้วกด **Run** อีกครั้ง
9. กด **Deploy → New deployment** → กดรูปเฟือง เลือก **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด **Deploy** แล้วคัดลอก **Web app URL** (ลงท้ายด้วย `/exec`)

---

## ขั้นที่ 2 · ใส่ลิงก์หลังบ้านในหน้าเว็บ

10. เปิดไฟล์ `index.html` หาบรรทัดนี้ (อยู่ช่วงต้นของส่วน script)

    ```js
    const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
    ```

    เปลี่ยนข้อความในเครื่องหมายคำพูดเป็น Web app URL จากข้อ 9

---

## ขั้นที่ 3 · แขวนหน้าเว็บบน GitHub Pages

11. ที่ **github.com** กด **New repository** ตั้งชื่อ `my-trip` เลือก **Public** แล้วกด **Create repository**
12. กด **uploading an existing file** แล้วลาก `index.html` (ที่แก้ API_URL แล้ว) เข้าไป กด **Commit changes**
    (โฟลเดอร์ `apps-script` จะอัปด้วยก็ได้ ไว้เป็นสำรอง ไม่มี key อยู่ในนั้น)
13. ไปที่ **Settings → Pages** ตรง Source เลือก **Deploy from a branch** → Branch **main** / **(root)** → **Save**
14. รอ 1–2 นาที จะได้ลิงก์ `https://ชื่อผู้ใช้.github.io/my-trip/`

### ใช้งานบน iPhone

- เปิดลิงก์ใน Safari → ปุ่มแชร์ → **เพิ่มไปยังหน้าจอโฮม** จะได้ไอคอนเหมือนแอป
- ถ้าย้ายทริปเดิมมา ให้เปิด `https://ชื่อผู้ใช้.github.io/my-trip/#join-DZWB3T` แล้วกดเข้าร่วม
  คนแรกที่เข้าร่วมจะเป็นเจ้าของทริป (ลบทริปได้) และไฟล์ใบจองเดิมต้องกด "แนบใบจอง" ใหม่

---

## แก้หรืออัปเดตทีหลัง

- **แก้หน้าเว็บ:** แก้ `index.html` บน GitHub (ไอคอนดินสอ) แล้ว commit เว็บจะอัปเดตเองใน 1–2 นาที
- **แก้หลังบ้าน:** แก้โค้ดใน Apps Script แล้วไปที่ **Deploy → Manage deployments** → ไอคอนดินสอ → Version: **New version** → **Deploy**
  ลิงก์ `/exec` จะเหมือนเดิม ไม่ต้องแก้ในหน้าเว็บ
- **เปลี่ยนตัวอ่านใบจอง:** เพิ่ม Script property
  - Claude: `AI_PROVIDER` = `claude` และ `CLAUDE_API_KEY` = key จาก console.anthropic.com
  - OpenAI: `AI_PROVIDER` = `openai` และ `OPENAI_API_KEY` = key จาก platform.openai.com
  - ไม่ต้อง deploy ใหม่ มีผลทันที

## ข้อควรรู้

- ใครมีลิงก์เว็บก็เปิดได้ และใครมีรหัสทริปก็เข้าร่วมได้ ส่งลิงก์เฉพาะคนในทริป ไม่ควรโพสต์ที่สาธารณะ
- Gemini แบบฟรี Google อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงบริการ ถ้าไม่ต้องการ เปิดแบบจ่ายเงินใน Google AI Studio (ใช้ key เดิม)
- ไฟล์ใบจองเก็บในโฟลเดอร์ `My Trip – booking files` ใน Drive ของคุณ ตั้งให้เปิดได้เฉพาะคนที่มีลิงก์
- ข้อมูลทริปดูหรือแก้ตรงๆ ในชีตแท็บ `trips` และ `items` ได้ (ช่อง json) แต่ควรแก้ผ่านแอปจะปลอดภัยกว่า
