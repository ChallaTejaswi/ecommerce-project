const express = require('express');
const router = express.Router();
const AgentHandoffController = require('../controllers/agentHandoffController');
const { authenticateToken } = require('../middleware/auth');

// User routes (require authentication)
router.use(authenticateToken);

// @route   POST /api/agent-handoff/escalate
// @desc    Create new escalation ticket with ML analysis
// @access  Private
router.post('/escalate', AgentHandoffController.createEscalation);

// @route   GET /api/agent-handoff/my-tickets
// @desc    Get user's escalation tickets
// @access  Private
router.get('/my-tickets', AgentHandoffController.getUserEscalations);

// @route   GET /api/agent-handoff/ticket/:ticketId
// @desc    Get specific escalation details
// @access  Private
router.get('/ticket/:ticketId', AgentHandoffController.getEscalationDetails);

// Admin routes (in production, add admin middleware)
// @route   GET /api/agent-handoff/admin/all
// @desc    Get all escalations with ML insights (Admin only)
// @access  Private (Admin)
router.get('/admin/all', AgentHandoffController.getAllEscalations);

// @route   PUT /api/agent-handoff/admin/assign/:ticketId
// @desc    Assign escalation to agent (Admin only)
// @access  Private (Admin)
router.put('/admin/assign/:ticketId', AgentHandoffController.assignEscalation);

// @route   PUT /api/agent-handoff/admin/resolve/:ticketId
// @desc    Resolve escalation ticket (Admin only)
// @access  Private (Admin)
router.put('/admin/resolve/:ticketId', AgentHandoffController.resolveEscalation);

module.exports = router;
