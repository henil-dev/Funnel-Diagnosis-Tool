const express = require('express');
const path = require('path');
const { analyzeLogic } = require('./Logic');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Analysis endpoint
app.post('/analyze', (req, res) => {
  try {
    const { funnelName, steps, context } = req.body;

    // Validate required fields
    if (!funnelName || !steps) {
      return res.status(400).json({
        error: 'Missing required fields: funnelName, steps'
      });
    }

    // Call logic layer
    const analysis = analyzeLogic(funnelName, steps, context || '');

    // Return structured data (ready for AI)
    res.json({
      funnelName: analysis.funnelName,
      dropsCount: analysis.stepsCount - 1,
      severity: analysis.severity,
      largestDrop: analysis.largestDrop,
      cumulativeLoss: analysis.cumulativeLoss,
      confidence: analysis.confidence,
      // Placeholder - Phase 5 will fill this with AI response
      hypotheses: `Analyzing drop at "${analysis.largestDrop.stepName}"...`,
      experiment: `Test: Investigate ${analysis.largestDrop.stepName} friction point (${analysis.largestDrop.dropPercentage}% drop)`,
      // Pass to AI in next phase
      aiPromptData: analysis.aiPromptData
    });

  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Funnel Diagnosis Tool running on port ${PORT}`);
});