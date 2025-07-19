const express = require('express');
const router = express.Router();
const dialogflowWebhookController = require('../controllers/dialogflowWebhookController');

// POST /webhook - Main Dialogflow webhook endpoint
router.post('/', dialogflowWebhookController.handleWebhook);

// POST /webhook/voice - Voice-specific webhook
router.post('/voice', dialogflowWebhookController.handleVoiceWebhook);

// GET /webhook/health - Webhook health check
router.get('/health', dialogflowWebhookController.healthCheck);

module.exports = router;
