require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./models/Setting');

const title = '📋 UPSSSC PET परीक्षा के महत्वपूर्ण निर्देश / Important Instructions for UPSSSC PET';

const content = `🇮🇳 UPSSSC PET (प्रारंभिक अर्हता परीक्षा) — मॉक टेस्ट
🇮🇳 UPSSSC PET (Preliminary Eligibility Test) — Mock Test

═══════════════════════════════════════

📌 1. सामान्य जानकारी / General Information

• कुल प्रश्न: 100
• निर्धारित समय: 120 मिनट
• कुल अंक: 100
• भाषा: हिंदी एवं अंग्रेजी (Bilingual)
• प्रकार: [Type] Test

• Total Questions: 100
• Duration: 120 minutes
• Total Marks: 100
• Language: Hindi & English (Bilingual)
• Type: [Type] Test

═══════════════════════════════════════

📊 2. अंकन प्रणाली / Marking Scheme

• सही उत्तर: +1 अंक
• गलत उत्तर: कोई ऋणात्मक अंकन नहीं
• छोड़े गए प्रश्न: 0 अंक

• Correct Answer: +1 mark
• Wrong Answer: No Negative Marking
• Unattempted: 0 mark

═══════════════════════════════════════

🎯 3. परीक्षा का स्वरूप / Exam Pattern

UPSSSC PET में निम्नलिखित विषय शामिल हैं —
UPSSSC PET includes the following subjects —

• सामान्य जागरूकता / General Awareness
• सामान्य हिंदी / General Hindi
• सामान्य अंग्रेजी / General English
• गणित / Mathematics
• तार्किक एवं विश्लेषणात्मक क्षमता / Reasoning & Analytical Ability
• भारतीय इतिहास / Indian History
• भारतीय राष्ट्रीय आंदोलन / Indian National Movement
• भारतीय राजव्यवस्था / Indian Polity
• भारत एवं विश्व का भूगोल / Geography
• सामान्य विज्ञान / General Science
• प्रारंभिक संख्यात्मकता / Elementary Mathematics
• सामान्य बुद्धिमता / General Intelligence
• मानसिक योग्यता / Mental Aptitude

═══════════════════════════════════════

⚠️ 4. महत्वपूर्ण निर्देश / Important Instructions

1. परीक्षा प्रारंभ होने के बाद टाइमर को रोका नहीं जा सकता।
   Once the exam starts, the timer cannot be paused.

2. प्रत्येक प्रश्न में 4 विकल्प दिए गए हैं, जिनमें से केवल 1 सही है।
   Each question has 4 options, only 1 is correct.

3. उत्तर चुनने के बाद 'Save & Next' बटन पर क्लिक करना अनिवार्य है।
   After selecting an answer, click 'Save & Next' to save it.

4. उत्तर बदलने के लिए 'Clear Response' बटन का उपयोग करें।
   To change the answer, use 'Clear Response'.

5. किसी प्रश्न को बाद में देखने के लिए 'Mark for Review' करें।
   Use 'Mark for Review' for questions you want to revisit.

6. टेस्ट के दौरान TAB न बदलें, अन्यथा टेस्ट स्वतः सबमिट हो जाएगा।
   Do NOT switch tabs, otherwise test will auto-submit.

7. समय समाप्त होने पर टेस्ट स्वतः सबमिट हो जाएगा।
   Test will auto-submit when time is over.

8. सभी प्रश्नों के उत्तर देने के बाद 'Submit Test' बटन दबाएं।
   After answering all questions, click 'Submit Test'.

═══════════════════════════════════════

📱 5. तकनीकी निर्देश / Technical Instructions

• स्थिर इंटरनेट कनेक्शन का उपयोग करें।
  Use a stable internet connection.

• मोबाइल / लैपटॉप की बैटरी पूरी चार्ज करें।
  Ensure your device is fully charged.

• टेस्ट के दौरान ब्राउज़र रीफ्रेश न करें।
  Do not refresh the browser during the test.

• टेस्ट पूरा होने तक टैब न बदलें।
  Do not switch tabs until the test is complete.

═══════════════════════════════════════

📞 6. सहायता / Help & Support

• ईमेल / Email: examprep776@gmail.com
• वेबसाइट / Website: examprephub-live.onrender.com
• हेल्पलाइन / Helpline: 7753921748

═══════════════════════════════════════

🇮🇳 आप सभी को हार्दिक शुभकामनाएँ! 🇮🇳
🇮🇳 Best of Luck to All! 🇮🇳

कृपया चेकबॉक्स पर टिक करके पुष्टि करें कि आपने सभी निर्देश पढ़ और समझ लिए हैं।
Please tick the checkbox to confirm you have read and understood all instructions.

═══════════════════════════════════════`;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const value = { title, content };

    await Setting.findOneAndUpdate(
      { key: 'instructions' },
      { key: 'instructions', value },
      { upsert: true, new: true }
    );

    console.log('✅ Instructions saved successfully!');
    process.exit(0);
  } catch (e) {
    console.log('❌ Error:', e.message);
    process.exit(1);
  }
})();