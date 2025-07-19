const AgentHandoff = require('../../models/AgentHandoff');
const User = require('../../models/User');
const flowDecisionEngine = require('../ml/models/flowDecisionEngine');
const sentimentAnalyzer = require('../ml/models/sentimentAnalyzer');

class AgentHandoffController {
  // Create new escalation ticket
  static async createEscalation(req, res) {
    try {
      const userId = req.userId;
      const {
        escalationReason,
        category,
        conversationHistory,
        priority,
        userMessage,
        metadata
      } = req.body;

      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Perform ML analysis on the escalation
      const mlAnalysis = await AgentHandoffController.performMLAnalysis(
        userMessage || escalationReason, 
        conversationHistory,
        user
      );

      // Create escalation ticket
      const escalation = new AgentHandoff({
        userId: userId,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone,
        escalationReason: escalationReason,
        category: category,
        priority: priority || mlAnalysis.recommendedPriority,
        mlAnalysis: mlAnalysis,
        conversationHistory: conversationHistory || [],
        metadata: metadata || {},
        status: 'pending'
      });

      await escalation.save();

      // Update user escalation history
      user.conversationAnalytics.escalationHistory.push({
        date: new Date(),
        reason: escalationReason,
        resolved: false
      });
      await user.save();

      // Send notifications (in production, integrate with email/SMS/Slack)
      await AgentHandoffController.sendEscalationNotifications(escalation, mlAnalysis);

      console.log(`🚨 New escalation created: ${escalation.ticketId} (Priority: ${escalation.priority})`);

      res.status(201).json({
        success: true,
        message: 'Escalation ticket created successfully',
        data: {
          ticket: escalation,
          estimatedResponseTime: AgentHandoffController.getEstimatedResponseTime(escalation.priority),
          mlInsights: {
            sentimentAnalysis: mlAnalysis.sentimentScore,
            urgencyLevel: mlAnalysis.urgencyLevel,
            recommendedAgent: mlAnalysis.recommendedAgent
          }
        }
      });

    } catch (error) {
      console.error('Create escalation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create escalation ticket'
      });
    }
  }

  // Get user's escalation tickets
  static async getUserEscalations(req, res) {
    try {
      const userId = req.userId;
      const { status, limit = 10 } = req.query;

      const query = { userId };
      if (status) {
        query.status = status;
      }

      const escalations = await AgentHandoff.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: {
          escalations: escalations,
          summary: {
            total: escalations.length,
            pending: escalations.filter(e => e.status === 'pending').length,
            resolved: escalations.filter(e => e.status === 'resolved').length
          }
        }
      });

    } catch (error) {
      console.error('Get user escalations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get escalation tickets'
      });
    }
  }

  // Get specific escalation details
  static async getEscalationDetails(req, res) {
    try {
      const userId = req.userId;
      const { ticketId } = req.params;

      const escalation = await AgentHandoff.findOne({ 
        ticketId: ticketId,
        userId: userId 
      }).populate('userId', 'name email phone');

      if (!escalation) {
        return res.status(404).json({
          success: false,
          message: 'Escalation ticket not found'
        });
      }

      res.json({
        success: true,
        data: {
          escalation: escalation,
          statusHistory: AgentHandoffController.getStatusHistory(escalation),
          estimatedResolution: AgentHandoffController.getEstimatedResolution(escalation)
        }
      });

    } catch (error) {
      console.error('Get escalation details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get escalation details'
      });
    }
  }

  // Admin: Get all escalations with ML insights
  static async getAllEscalations(req, res) {
    try {
      const { 
        status, 
        priority, 
        category, 
        page = 1, 
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const query = {};
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (category) query.category = category;

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const escalations = await AgentHandoff.find(query)
        .populate('userId', 'name email phone conversationAnalytics')
        .sort(sort)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await AgentHandoff.countDocuments(query);

      // Calculate ML insights
      const mlInsights = await AgentHandoffController.calculateMLInsights(escalations);

      res.json({
        success: true,
        data: {
          escalations: escalations,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            pages: Math.ceil(total / parseInt(limit))
          },
          mlInsights: mlInsights,
          priorityQueue: await AgentHandoff.getPriorityQueue()
        }
      });

    } catch (error) {
      console.error('Get all escalations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get escalations'
      });
    }
  }

  // Admin: Assign escalation to agent
  static async assignEscalation(req, res) {
    try {
      const { ticketId } = req.params;
      const { agentId, agentName, department } = req.body;

      const escalation = await AgentHandoff.findOne({ ticketId });
      if (!escalation) {
        return res.status(404).json({
          success: false,
          message: 'Escalation ticket not found'
        });
      }

      escalation.status = 'assigned';
      escalation.assignedAgent = {
        agentId: agentId,
        agentName: agentName,
        assignedAt: new Date(),
        department: department
      };

      await escalation.save();

      console.log(`✅ Escalation ${ticketId} assigned to ${agentName}`);

      res.json({
        success: true,
        message: 'Escalation assigned successfully',
        data: {
          escalation: escalation
        }
      });

    } catch (error) {
      console.error('Assign escalation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign escalation'
      });
    }
  }

  // Admin: Resolve escalation
  static async resolveEscalation(req, res) {
    try {
      const { ticketId } = req.params;
      const { resolvedBy, resolutionNotes, customerSatisfaction } = req.body;

      const escalation = await AgentHandoff.findOne({ ticketId });
      if (!escalation) {
        return res.status(404).json({
          success: false,
          message: 'Escalation ticket not found'
        });
      }

      await escalation.resolve(resolvedBy, resolutionNotes, customerSatisfaction);

      // Update user escalation history
      const user = await User.findById(escalation.userId);
      if (user) {
        const escalationIndex = user.conversationAnalytics.escalationHistory.findIndex(
          e => e.date.getTime() === escalation.createdAt.getTime()
        );
        
        if (escalationIndex > -1) {
          user.conversationAnalytics.escalationHistory[escalationIndex].resolved = true;
          await user.save();
        }
      }

      console.log(`✅ Escalation ${ticketId} resolved by ${resolvedBy}`);

      res.json({
        success: true,
        message: 'Escalation resolved successfully',
        data: {
          escalation: escalation,
          resolutionTime: escalation.resolution.resolutionTime
        }
      });

    } catch (error) {
      console.error('Resolve escalation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve escalation'
      });
    }
  }

  // Perform ML analysis on escalation
  static async performMLAnalysis(message, conversationHistory, user) {
    try {
      // Analyze sentiment of the escalation message
      const sentimentAnalysis = sentimentAnalyzer.analyzeSentiment(message);
      
      // Calculate escalation score based on multiple factors
      let escalationScore = 0;
      
      // Sentiment contribution (0-3 points)
      if (sentimentAnalysis.score < -0.5) escalationScore += 3;
      else if (sentimentAnalysis.score < -0.2) escalationScore += 2;
      else if (sentimentAnalysis.score < 0) escalationScore += 1;
      
      // Complaint indicators (0-2 points)
      if (sentimentAnalysis.isComplaint) escalationScore += 2;
      
      // User history contribution (0-2 points)
      const userEscalations = user.conversationAnalytics?.escalationHistory?.length || 0;
      if (userEscalations > 2) escalationScore += 2;
      else if (userEscalations > 0) escalationScore += 1;
      
      // Conversation complexity (0-2 points)
      const conversationLength = conversationHistory?.length || 0;
      if (conversationLength > 10) escalationScore += 2;
      else if (conversationLength > 5) escalationScore += 1;
      
      // Determine urgency level
      let urgencyLevel = 'low';
      let recommendedPriority = 'medium';
      let recommendedAgent = 'general';
      
      if (escalationScore >= 7) {
        urgencyLevel = 'critical';
        recommendedPriority = 'critical';
        recommendedAgent = 'senior';
      } else if (escalationScore >= 5) {
        urgencyLevel = 'high';
        recommendedPriority = 'high';
        recommendedAgent = 'senior';
      } else if (escalationScore >= 3) {
        urgencyLevel = 'medium';
        recommendedPriority = 'medium';
        recommendedAgent = 'general';
      }
      
      // Detect specific agent type needed
      const messageLower = message.toLowerCase();
      if (messageLower.includes('payment') || messageLower.includes('billing') || messageLower.includes('refund')) {
        recommendedAgent = 'billing';
      } else if (messageLower.includes('technical') || messageLower.includes('bug') || messageLower.includes('error')) {
        recommendedAgent = 'technical';
      }

      return {
        sentimentScore: sentimentAnalysis.score,
        escalationScore: escalationScore,
        urgencyLevel: urgencyLevel,
        recommendedPriority: recommendedPriority,
        detectedEmotions: sentimentAnalysis.analysis?.negativeWords || [],
        conversationComplexity: conversationLength > 10 ? 'complex' : 
                               conversationLength > 5 ? 'moderate' : 'simple',
        recommendedAgent: recommendedAgent
      };
      
    } catch (error) {
      console.error('ML analysis error:', error);
      return {
        sentimentScore: 0,
        escalationScore: 3,
        urgencyLevel: 'medium',
        recommendedPriority: 'medium',
        detectedEmotions: [],
        conversationComplexity: 'moderate',
        recommendedAgent: 'general'
      };
    }
  }

  // Send escalation notifications
  static async sendEscalationNotifications(escalation, mlAnalysis) {
    try {
      // In production, integrate with email/SMS/Slack APIs
      console.log(`📧 Escalation notification sent for ticket ${escalation.ticketId}`);
      console.log(`📊 ML Analysis: Priority ${escalation.priority}, Agent: ${mlAnalysis.recommendedAgent}`);
      
      // Mock notification - replace with real notification service
      const notification = {
        to: 'support@meesho.com',
        subject: `🚨 New ${escalation.priority} Priority Escalation - ${escalation.ticketId}`,
        body: `
          Ticket ID: ${escalation.ticketId}
          Customer: ${escalation.customerName} (${escalation.customerEmail})
          Category: ${escalation.category}
          Reason: ${escalation.escalationReason}
          
          ML Analysis:
          - Sentiment Score: ${mlAnalysis.sentimentScore}
          - Urgency Level: ${mlAnalysis.urgencyLevel}
          - Recommended Agent: ${mlAnalysis.recommendedAgent}
          - Escalation Score: ${mlAnalysis.escalationScore}/10
          
          Please assign this ticket to the appropriate agent.
        `
      };
      
      // Here you would send actual notifications
      return notification;
      
    } catch (error) {
      console.error('Notification sending error:', error);
    }
  }

  // Get estimated response time based on priority
  static getEstimatedResponseTime(priority) {
    const responseTimes = {
      'critical': '15 minutes',
      'high': '1 hour',
      'medium': '4 hours',
      'low': '24 hours'
    };
    return responseTimes[priority] || '4 hours';
  }

  // Get status history for ticket
  static getStatusHistory(escalation) {
    const history = [
      {
        status: 'created',
        timestamp: escalation.createdAt,
        description: 'Escalation ticket created'
      }
    ];
    
    if (escalation.assignedAgent?.assignedAt) {
      history.push({
        status: 'assigned',
        timestamp: escalation.assignedAgent.assignedAt,
        description: `Assigned to ${escalation.assignedAgent.agentName}`
      });
    }
    
    if (escalation.resolution?.resolvedAt) {
      history.push({
        status: 'resolved',
        timestamp: escalation.resolution.resolvedAt,
        description: `Resolved by ${escalation.resolution.resolvedBy}`
      });
    }
    
    return history;
  }

  // Get estimated resolution time
  static getEstimatedResolution(escalation) {
    const baseTimes = {
      'critical': 2, // hours
      'high': 8,
      'medium': 24,
      'low': 72
    };
    
    const baseTime = baseTimes[escalation.priority] || 24;
    const complexity = escalation.mlAnalysis?.conversationComplexity;
    
    let multiplier = 1;
    if (complexity === 'complex') multiplier = 1.5;
    else if (complexity === 'simple') multiplier = 0.7;
    
    return Math.round(baseTime * multiplier);
  }

  // Calculate ML insights for admin dashboard
  static async calculateMLInsights(escalations) {
    const insights = {
      averageSentiment: 0,
      averageEscalationScore: 0,
      urgencyDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      agentRecommendations: { general: 0, senior: 0, technical: 0, billing: 0 },
      resolutionTimes: {
        average: 0,
        byPriority: {}
      }
    };

    if (escalations.length === 0) return insights;

    // Calculate averages
    insights.averageSentiment = escalations.reduce((sum, e) => 
      sum + (e.mlAnalysis?.sentimentScore || 0), 0) / escalations.length;
    
    insights.averageEscalationScore = escalations.reduce((sum, e) => 
      sum + (e.mlAnalysis?.escalationScore || 0), 0) / escalations.length;

    // Count distributions
    escalations.forEach(escalation => {
      const urgency = escalation.mlAnalysis?.urgencyLevel || 'medium';
      insights.urgencyDistribution[urgency]++;
      
      const agent = escalation.mlAnalysis?.recommendedAgent || 'general';
      insights.agentRecommendations[agent]++;
    });

    // Calculate resolution times
    const resolvedEscalations = escalations.filter(e => e.resolution?.resolutionTime);
    if (resolvedEscalations.length > 0) {
      insights.resolutionTimes.average = resolvedEscalations.reduce((sum, e) => 
        sum + e.resolution.resolutionTime, 0) / resolvedEscalations.length;
    }

    return insights;
  }
}

module.exports = AgentHandoffController;
