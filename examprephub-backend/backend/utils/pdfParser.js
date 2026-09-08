const pdfParse = require('pdf-parse');
const fs = require('fs');

const parsePDF = async (pdfPath) => {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;
    
    console.log('📄 PDF Text Extracted, Length:', text.length);
    
    const questions = [];
    const lines = text.split('\n').filter(line => line.trim() !== '');
    let currentQuestion = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      const questionMatch = line.match(/^Q(\d+)\.\s*(.*)/i);
      if (questionMatch) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          questionText: questionMatch[2].trim(),
          options: { A: '', B: '', C: '', D: '' },
          correctAnswer: '',
          explanation: ''
        };
        continue;
      }
      
      if (currentQuestion) {
        const optionMatch = line.match(/^\(([A-D])\)\s*(.*)/);
        if (optionMatch) {
          currentQuestion.options[optionMatch[1]] = optionMatch[2].trim();
          continue;
        }
        
        const answerMatch = line.match(/^Ans:?\s*([A-D])/i);
        if (answerMatch) {
          currentQuestion.correctAnswer = answerMatch[1].toUpperCase();
          continue;
        }
        
        if (line.includes('Explanation:')) {
          currentQuestion.explanation = line.replace('Explanation:', '').trim();
        }
      }
    }
    
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    console.log(`✅ ${questions.length} Questions Extracted from PDF`);
    return questions;
    
  } catch (error) {
    console.error('❌ PDF Parse Error:', error);
    throw error;
  }
};

module.exports = parsePDF;