
const axios = require('axios');

async function translate(text, source = 'en', target = 'en') {
  if (!text || source === target) return text;
  try {
    console.log('🟢 [translate] Before LibreTranslate:', { text, source, target });
    const res = await axios.post('http://localhost:5000/translate', {
      q: text,
      source,
      target,
      format: 'text'
    });
    console.log('🟢 [translate] After LibreTranslate:', res.data.translatedText);
    return res.data.translatedText;
  } catch (err) {
    if (err.response) {
      console.error('LibreTranslate error:', err.response.data);
    } else {
      console.error('LibreTranslate error:', err.message || err);
    }
    return text;
  }
}

// LibreTranslate does not support language detection in the free public API
async function detectLanguage(text) {
  // Always fallback to English
  return 'en';
}

module.exports = { translate, detectLanguage };
