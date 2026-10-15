// Logic Layer: Funnel Analysis
// Prevents hallucination by structuring data before AI sees it

function validateFunnelData(steps) {
  if (!steps || steps.length < 2) {
    throw new Error('At least 2 funnel steps required');
  }

  if (steps.length > 10) {
    throw new Error('Maximum 10 funnel steps allowed');
  }

  steps.forEach((step, idx) => {
    if (!step.name || step.name.trim() === '') {
      throw new Error(`Step ${idx + 1}: Missing step name`);
    }
    if (typeof step.rate !== 'number' || step.rate < 0 || step.rate > 100) {
      throw new Error(`Step ${idx + 1}: Invalid conversion rate (must be 0-100)`);
    }
  });

  return true;
}

function calculateFunnelMetrics(steps, totalUsers = 100) {
  const metrics = [];
  let previousUsers = totalUsers;

  steps.forEach((step, idx) => {
    const conversionRate = step.rate / 100;
    const currentUsers = Math.round(previousUsers * conversionRate);
    const usersLost = previousUsers - currentUsers;
    const dropPercentage = previousUsers > 0 
      ? ((usersLost / previousUsers) * 100).toFixed(1) 
      : 0;

    metrics.push({
      stepName: step.name,
      conversionRate: step.rate,
      usersReaching: currentUsers,
      usersLost: usersLost,
      dropPercentage: parseFloat(dropPercentage),
      stepIndex: idx
    });

    previousUsers = currentUsers;
  });

  return metrics;
}

function classifySeverity(dropPercentage) {
  if (dropPercentage >= 50) return 'Critical';
  if (dropPercentage >= 30) return 'High';
  if (dropPercentage >= 20) return 'Watch';
  return 'Normal';
}

function identifyLargestDrop(metrics) {
  let largestDrop = metrics[0];

  metrics.forEach(m => {
    if (m.dropPercentage > largestDrop.dropPercentage) {
      largestDrop = m;
    }
  });

  return largestDrop;
}

function analyzeLogic(funnelName, stepsData, context = '') {
  try {
    // Parse input
    const lines = stepsData.trim().split('\n').filter(l => l.trim());
    const steps = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        name: parts[0],
        rate: parseFloat(parts[1])
      };
    });

    // Validate
    validateFunnelData(steps);

    // Calculate metrics
    const metrics = calculateFunnelMetrics(steps);

    // Find largest drop
    const largestDrop = identifyLargestDrop(metrics);
    const severity = classifySeverity(largestDrop.dropPercentage);

    // Calculate cumulative loss
    const cumulativeLoss = ((steps[0].rate - steps[steps.length - 1].rate) / steps[0].rate * 100).toFixed(1);

    // Determine confidence based on data completeness
    const dataCompleteness = steps.length >= 3 ? 'Medium' : 'Low';
    const hasContext = context && context.trim().length > 0;
    const confidence = (hasContext && dataCompleteness === 'Medium') ? 'Medium-High' : dataCompleteness;

    return {
      funnelName,
      stepsCount: steps.length,
      largestDrop: {
        stepName: largestDrop.stepName,
        dropPercentage: largestDrop.dropPercentage,
        usersLost: largestDrop.usersLost,
        stepIndex: largestDrop.stepIndex
      },
      severity,
      cumulativeLoss: parseFloat(cumulativeLoss),
      confidence,
      context,
      metrics,
      // Structured for AI: only ask about the largest drop location
      aiPromptData: {
        problemStatement: `${largestDrop.dropPercentage}% of users drop off at "${largestDrop.stepName}" (largest observed drop)`,
        dropLocation: largestDrop.stepName,
        severity,
        context,
        metrics
      }
    };
  } catch (error) {
    throw new Error(`Data Error: ${error.message}`);
  }
}

module.exports = { analyzeLogic, validateFunnelData, calculateFunnelMetrics, classifySeverity };