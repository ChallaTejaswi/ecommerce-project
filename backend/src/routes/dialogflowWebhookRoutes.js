const express = require('express');
const router = express.Router();
const DialogflowService = require('../services/dialogflowService');

// instantiate the service
const dialogflowService = new DialogflowService();

router.post('/', async (req, res) => {
  const { queryResult, userId, languageCode } = req.body;

  if (!queryResult || !queryResult.queryText) {
    return res.status(400).json({ success: false, message: 'Missing query text' });
  }

  const sessionId = dialogflowService.generateSessionId(userId || 'anonymous');

  try {
    const result = await dialogflowService.detectIntent(
      sessionId,
      queryResult.queryText,
      languageCode || 'en'  // fallback to English if no language passed
    );

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      fulfillmentText: result.fulfillmentText,
      intent: result.intent,
      confidence: result.confidence,
      parameters: result.parameters,
      session: sessionId
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;