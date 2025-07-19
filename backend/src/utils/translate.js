// Translation utility for backend (uses LibreTranslate)
const axios = require('axios');
const LIBRETRANSLATE_URL = 'https://libretranslate.de';

async function detectLanguage(text) {
  try {
    const res = await axios.post(`${LIBRETRANSLATE_URL}/detect`, { q: text });
    return res.data && res.data[0] ? res.data[0].language : 'en';
  } catch (err) {
    return 'en';
  }
}

async function translate(text, source, target) {
  if (!text || source === target) return text;
  try {
    const res = await axios.post(`${LIBRETRANSLATE_URL}/translate`, {
      q: text,
      source,
      target,
      format: 'text',
    });
    return res.data.translatedText;
  } catch (err) {
    return text;
  }
}

module.exports = { detectLanguage, translate };
