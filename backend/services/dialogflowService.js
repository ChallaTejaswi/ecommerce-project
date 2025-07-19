const { SessionsClient } = require('@google-cloud/dialogflow');

class DialogflowService {
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'shoppingassistant-pstu';
    this.sessionClient = new SessionsClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
  }

  async detectIntent(sessionId, query, languageCode = 'en') {
    // Dialogflow API limit: 256 characters for input text
    let safeQuery = query;
    if (typeof safeQuery === 'string' && safeQuery.length > 200) {
      safeQuery = safeQuery.slice(0, 197) + '...';
    }
    try {
      const sessionPath = this.sessionClient.projectAgentSessionPath(
        this.projectId,
        sessionId
      );

      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: query,
            languageCode: languageCode,
          },
        },
      };

      console.log(`🤖 Dialogflow request: ${query} (${languageCode})`);
      
      const [response] = await this.sessionClient.detectIntent(request);
      
      console.log(`🎯 Intent: ${response.queryResult.intent?.displayName || 'Unknown'}`);
      console.log(`🎲 Confidence: ${response.queryResult.intentDetectionConfidence}`);
      
      return {
        success: true,
        queryResult: response.queryResult,
        intent: response.queryResult.intent?.displayName,
        confidence: response.queryResult.intentDetectionConfidence,
        parameters: response.queryResult.parameters,
        fulfillmentText: response.queryResult.fulfillmentText,
        languageCode: response.queryResult.languageCode
      };
    } catch (error) {
      console.error('❌ Dialogflow error:', error);
      return {
        success: false,
        error: error.message,
        fallback: true
      };
    }
  }

  // Create session ID based on user ID and current date
  generateSessionId(userId) {
    const today = new Date().toISOString().split('T')[0];
    return `${userId}-${today}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = DialogflowService;