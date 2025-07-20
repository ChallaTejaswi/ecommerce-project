const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const path = require('path');

// Path to your Dialogflow service account key
const keyFilePath = path.resolve(__dirname, '../../config/dialogflow-service-account.json');
const projectId = 'shoppingassistant-pstu';

class DialogflowService {
  async detectIntent(userId, userInput, languageCode = 'en') {
    try {
      const sessionId = uuid.v4();
      const sessionClient = new dialogflow.SessionsClient({ keyFilename: keyFilePath });
      const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
      // Truncate userInput to avoid exceeding Dialogflow's 256 char limit
      let safeInput = userInput;
      if (typeof safeInput === 'string' && safeInput.length > 200) safeInput = safeInput.slice(0, 197) + '...';
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: safeInput,
            languageCode: languageCode,
          },
        },
      };
      const responses = await sessionClient.detectIntent(request);
      const result = responses[0].queryResult;
      return {
        queryResult: result,
        flowDecision: {
          flow: result.intent ? result.intent.displayName : 'unknown',
          reason: 'Dialogflow intent detection',
          confidence: result.intentDetectionConfidence || 0.8
        },
        intent: result.intent ? result.intent.displayName : 'unknown',
        confidence: result.intentDetectionConfidence || 0.8,
        parameters: result.parameters || {},
        fulfillmentText: result.fulfillmentText || '',
        languageCode: languageCode
      };
    } catch (error) {
      console.error('Dialogflow intent detection error:', error);
      return {
        queryResult: {
          queryText: userInput,
          intent: { displayName: 'unknown' },
          parameters: {},
          fulfillmentText: '',
          languageCode: languageCode
        },
        flowDecision: {
          flow: 'IVR',
          reason: 'Dialogflow error',
          confidence: 0.5
        },
        intent: 'unknown',
        confidence: 0.5,
        parameters: {},
        fulfillmentText: '',
        languageCode: languageCode
      };
    }
  }
}

module.exports = new DialogflowService();

