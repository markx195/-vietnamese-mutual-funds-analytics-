// Calculate RSI (Relative Strength Index)
export function calculateRSI(navHistory, period = 14) {
  if (!navHistory || navHistory.length < period + 1) return null;
  
  const prices = navHistory.map(d => d.nav);
  const changes = [];
  
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return Math.round(rsi * 100) / 100;
}

// Calculate moving average
export function calculateMA(navHistory, period) {
  if (!navHistory || navHistory.length < period) return [];
  
  const result = [];
  for (let i = period - 1; i < navHistory.length; i++) {
    const sum = navHistory.slice(i - period + 1, i + 1)
      .reduce((acc, d) => acc + d.nav, 0);
    result.push({
      date: navHistory[i].date,
      value: Math.round((sum / period) * 100) / 100
    });
  }
  
  return result;
}

// Calculate percentage change
export function calculateChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}


