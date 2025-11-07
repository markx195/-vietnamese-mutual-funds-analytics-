import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeFmarketNAV } from './scrapers/fmarket.js';
import { loadHistory, mergeNavHistory, getFundHistory, getReturn12M } from './storage/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Store NAV data (loaded from storage)
const rawHistory = loadHistory();
let navData = {};
// Convert storage format to navData format
Object.keys(rawHistory).forEach(fundCode => {
  const fundData = rawHistory[fundCode];
  navData[fundCode] = Array.isArray(fundData) ? fundData : (fundData.data || []);
});
let lastUpdated = new Date();

function loadFundsList() {
  try {
    const p = resolve(__dirname, 'config/funds.json');
    const txt = readFileSync(p, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

function computeNextUpdate() {
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// API endpoint to get all funds
app.get('/api/funds', (req, res) => {
  const fundsList = loadFundsList();
  res.json(fundsList);
});

// API endpoint to get NAV data for a specific fund
app.get('/api/nav/:fundCode', (req, res) => {
  const { fundCode } = req.params;
  
  if (!navData[fundCode] || navData[fundCode].length === 0) {
    return res.status(404).json({ error: 'Fund not found or no data available' });
  }
  
  res.json(navData[fundCode]);
});

// API endpoint to get NAV history stats
app.get('/api/nav/:fundCode/stats', (req, res) => {
  const { fundCode } = req.params;
  
  if (!navData[fundCode] || navData[fundCode].length === 0) {
    return res.status(404).json({ error: 'Fund not found or no data available' });
  }
  
  const history = navData[fundCode];
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const navs = sorted.map(h => h.nav);
  
  const min = Math.min(...navs);
  const max = Math.max(...navs);
  const latest = sorted[sorted.length - 1].nav;
  const oldest = sorted[0].nav;
  const change = latest - oldest;
  const changePercent = ((change / oldest) * 100).toFixed(2);
  
  res.json({
    fundCode,
    totalDays: history.length,
    dateRange: {
      from: sorted[0].date,
      to: sorted[sorted.length - 1].date
    },
    nav: {
      latest,
      oldest,
      min,
      max,
      change,
      changePercent: parseFloat(changePercent)
    }
  });
});

// Calculate DCA score for a fund (0-100, higher = better to buy)
function calculateDCAScore(fundCode, navHistory) {
  if (!navHistory || navHistory.length < 30) return null;
  
  const rsi = calculateRSI(navHistory);
  const ma30 = calculateMA(navHistory, 30);
  const ma90 = calculateMA(navHistory, 90);
  const ma180 = calculateMA(navHistory, 180);
  const latestNAV = navHistory[navHistory.length - 1].nav;
  const latestMA30 = ma30.length > 0 ? ma30[ma30.length - 1].value : null;
  const latestMA90 = ma90.length > 0 ? ma90[ma90.length - 1].value : null;
  const latestMA180 = ma180.length > 0 ? ma180[ma180.length - 1].value : null;
  
  // 52-week stats
  const days52W = 365;
  const recent52W = navHistory.slice(-days52W);
  const navs52W = recent52W.map(h => h.nav);
  const navMax52W = navs52W.length > 0 ? Math.max(...navs52W) : null;
  const navMin52W = navs52W.length > 0 ? Math.min(...navs52W) : null;
  const drawdown = navMax52W ? ((latestNAV - navMax52W) / navMax52W) * 100 : null;
  const recoveryRatio = (navMax52W && navMin52W && navMax52W !== navMin52W) 
    ? (latestNAV - navMin52W) / (navMax52W - navMin52W)
    : null;
  
  const return12M = getReturn12M(fundCode);
  
  let score = 50; // Base score
  
  // RSI scoring (lower is better for DCA)
  if (rsi !== null) {
    if (rsi <= 30) score += 20; // Đáy
    else if (rsi <= 40) score += 15; // Quá bán
    else if (rsi <= 50) score += 10; // Vùng tốt
    else if (rsi <= 60) score += 5; // Vùng trung bình
    else if (rsi >= 70) score -= 10; // Quá mua
  }
  
  // MA scoring (below MA is better for DCA)
  if (latestMA30 && latestNAV < latestMA30) score += 10;
  if (latestMA90 && latestNAV < latestMA90) score += 10;
  if (latestMA180 && latestNAV < (0.95 * latestMA180)) score += 15; // Below 95% of MA180
  
  // Drawdown scoring (deeper drawdown = better entry)
  if (drawdown !== null) {
    if (drawdown < -15) score += 15; // Giảm sâu
    else if (drawdown < -10) score += 10; // Giảm tốt
    else if (drawdown < -5) score += 5; // Giảm nhẹ
  }
  
  // Recovery ratio (lower = better for entry)
  if (recoveryRatio !== null) {
    if (recoveryRatio < 0.2) score += 15; // Vùng đáy rất thấp
    else if (recoveryRatio < 0.3) score += 10; // Vùng đáy
    else if (recoveryRatio < 0.5) score += 5; // Vùng tốt
  }
  
  // 12-month return (moderate positive is good, too high might be overvalued)
  if (return12M !== null) {
    if (return12M > 0 && return12M < 20) score += 5; // Tăng trưởng ổn định
    else if (return12M < 0 && return12M > -10) score += 5; // Giảm nhẹ, cơ hội
    else if (return12M < -10) score += 10; // Giảm nhiều, cơ hội tốt
    else if (return12M > 30) score -= 5; // Tăng quá nhiều, có thể đã đắt
  }
  
  // Cap score between 0-100
  score = Math.max(0, Math.min(100, score));
  
  return Math.round(score);
}

// API endpoint to get all funds with their latest NAV
app.get('/api/funds/overview', (req, res) => {
  const overview = Object.keys(navData).map(fundCode => {
    const history = navData[fundCode];
    if (!history || history.length === 0) return null;
    
    const latest = history[history.length - 1];
    const previous = history[history.length - 2] || latest;
    const change = latest.nav - previous.nav;
    const changePercent = ((change / previous.nav) * 100).toFixed(2);
    
    const dcaScore = calculateDCAScore(fundCode, history);
    const return12M = getReturn12M(fundCode);

    return {
      code: fundCode,
      latestNAV: latest.nav,
      change: change,
      changePercent: parseFloat(changePercent),
      date: latest.date,
      dcaScore: dcaScore,
      return12M: return12M
    };
  }).filter(f => f !== null);

  res.json(overview);
});

// API endpoint to get DCA recommendations (sorted by score)
app.get('/api/dca/recommendations', (req, res) => {
  const { minScore = 50, limit = 10 } = req.query;
  
  const recommendations = Object.keys(navData)
    .map(fundCode => {
      const history = navData[fundCode];
      if (!history || history.length < 30) return null;
      
      const dcaScore = calculateDCAScore(fundCode, history);
      if (dcaScore === null || dcaScore < minScore) return null;
      
      const latest = history[history.length - 1];
      const rsi = calculateRSI(history);
      const ma30 = calculateMA(history, 30);
      const ma180 = calculateMA(history, 180);
      const latestMA30 = ma30.length > 0 ? ma30[ma30.length - 1].value : null;
      const latestMA180 = ma180.length > 0 ? ma180[ma180.length - 1].value : null;
      
      const days52W = 365;
      const recent52W = history.slice(-days52W);
      const navs52W = recent52W.map(h => h.nav);
      const navMax52W = navs52W.length > 0 ? Math.max(...navs52W) : null;
      const drawdown = navMax52W ? ((latest.nav - navMax52W) / navMax52W) * 100 : null;
      
      const return12M = getReturn12M(fundCode);
      
      // Reasons for recommendation
      const reasons = [];
      if (rsi !== null && rsi <= 30) reasons.push('RSI ≤ 30 (đáy)');
      else if (rsi !== null && rsi <= 40) reasons.push('RSI ≤ 40 (quá bán)');
      if (latestMA30 && latest.nav < latestMA30) reasons.push('NAV < MA30');
      if (latestMA180 && latest.nav < (0.95 * latestMA180)) reasons.push('NAV < 95% MA180');
      if (drawdown !== null && drawdown < -10) reasons.push(`Drawdown ${drawdown.toFixed(1)}%`);
      if (return12M !== null && return12M < 0) reasons.push(`12M: ${return12M.toFixed(1)}%`);
      
      return {
        fundCode,
        dcaScore,
        latestNAV: latest.nav,
        date: latest.date,
        rsi: rsi !== null ? Math.round(rsi * 100) / 100 : null,
        drawdown: drawdown !== null ? Math.round(drawdown * 100) / 100 : null,
        return12M: return12M !== null ? Math.round(return12M * 100) / 100 : null,
        reasons: reasons.length > 0 ? reasons : ['Vùng giá tốt cho DCA']
      };
    })
    .filter(f => f !== null)
    .sort((a, b) => b.dcaScore - a.dcaScore)
    .slice(0, parseInt(limit));

  res.json({
    recommendations,
    count: recommendations.length,
    minScore: parseInt(minScore)
  });
});

// Meta endpoint for update info
app.get('/api/meta', (req, res) => {
  res.json({
    lastUpdated: lastUpdated.toISOString(),
    nextUpdate: computeNextUpdate().toISOString()
  });
});

// Calculate RSI (Relative Strength Index)
function calculateRSI(navHistory, period = 14) {
  if (navHistory.length < period + 1) return null;
  
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
function calculateMA(navHistory, period) {
  if (navHistory.length < period) return [];
  
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

// Detect divergence: price going up but RSI going down (bearish divergence)
function detectDivergence(navHistory, rsiHistory) {
  if (!navHistory || navHistory.length < 5 || !rsiHistory || rsiHistory.length < 5) return null;
  
  const recent = navHistory.slice(-5);
  const recentRSI = rsiHistory.slice(-5);
  
  const priceTrend = recent[recent.length - 1].nav - recent[0].nav;
  const rsiTrend = recentRSI[recentRSI.length - 1] - recentRSI[0];
  
  // Bearish divergence: price up but RSI down
  if (priceTrend > 0 && rsiTrend < -5) {
    return 'bearish'; // Tín hiệu đổi chiều - không nên mua
  }
  
  // Bullish divergence: price down but RSI up
  if (priceTrend < 0 && rsiTrend > 5) {
    return 'bullish'; // Tín hiệu đổi chiều - có thể mua
  }
  
  return null;
}

// Calculate RSI history for divergence detection
function calculateRSIHistory(navHistory, period = 14) {
  if (navHistory.length < period + 1) return [];
  
  const rsiHistory = [];
  for (let i = period; i < navHistory.length; i++) {
    const slice = navHistory.slice(0, i + 1);
    const rsi = calculateRSI(slice, period);
    if (rsi !== null) rsiHistory.push(rsi);
  }
  
  return rsiHistory;
}

// API endpoint to get analytics for a fund
app.get('/api/analytics/:fundCode', (req, res) => {
  const { fundCode } = req.params;
  
  if (!navData[fundCode]) {
    return res.status(404).json({ error: 'Fund not found' });
  }
  
  const navHistory = navData[fundCode];
  const rsi = calculateRSI(navHistory);
  const rsiHistory = calculateRSIHistory(navHistory);
  
  // Calculate multiple MAs
  const ma7 = calculateMA(navHistory, 7);
  const ma30 = calculateMA(navHistory, 30);
  const ma50 = calculateMA(navHistory, 50);
  const ma90 = calculateMA(navHistory, 90);
  const ma180 = calculateMA(navHistory, 180);
  const ma200 = calculateMA(navHistory, 200);
  
  const latestNAV = navHistory[navHistory.length - 1].nav;
  const latestMA30 = ma30.length > 0 ? ma30[ma30.length - 1].value : null;
  const latestMA50 = ma50.length > 0 ? ma50[ma50.length - 1].value : null;
  const latestMA90 = ma90.length > 0 ? ma90[ma90.length - 1].value : null;
  const latestMA180 = ma180.length > 0 ? ma180[ma180.length - 1].value : null;
  const latestMA200 = ma200.length > 0 ? ma200[ma200.length - 1].value : null;
  
  // Calculate 52-week (365 days) statistics for drawdown and recovery
  const days52W = 365; // 52 weeks ≈ 365 days
  const recent52W = navHistory.slice(-days52W);
  const navs52W = recent52W.map(h => h.nav);
  const navMax52W = navs52W.length > 0 ? Math.max(...navs52W) : null;
  const navMin52W = navs52W.length > 0 ? Math.min(...navs52W) : null;
  
  // Công thức 2: Drawdown
  const drawdown = navMax52W ? ((latestNAV - navMax52W) / navMax52W) * 100 : null;
  const isDeepDrawdown = drawdown !== null && drawdown < -10; // Drawdown > 10%
  
  // Công thức 3: Recovery Ratio
  const recoveryRatio = (navMax52W && navMin52W && navMax52W !== navMin52W) 
    ? (latestNAV - navMin52W) / (navMax52W - navMin52W)
    : null;
  const isAtBottomZone = recoveryRatio !== null && recoveryRatio < 0.3; // Ở vùng đáy 30% thấp nhất
  
  // Công thức 1: NAV < 0.95 × MA(180) hoặc NAV < MA(90)
  const isBelowMA180 = latestMA180 ? latestNAV < (0.95 * latestMA180) : false;
  const isBelowMA90 = latestMA90 ? latestNAV < latestMA90 : false;
  
  // Death Cross: MA50 cắt xuống MA200 (downtrend - chuẩn bị bắt đáy)
  const deathCross = latestMA50 && latestMA200 ? latestMA50 < latestMA200 : false;
  
  // Golden Cross: MA50 cắt lên MA200 (uptrend - thị trường đi lên)
  const goldenCross = latestMA50 && latestMA200 ? latestMA50 > latestMA200 : false;
  
  // Previous MA values to detect cross
  const prevMA50 = ma50.length > 1 ? ma50[ma50.length - 2].value : null;
  const prevMA200 = ma200.length > 1 ? ma200[ma200.length - 2].value : null;
  const justDeathCross = deathCross && prevMA50 && prevMA200 && prevMA50 >= prevMA200;
  const justGoldenCross = goldenCross && prevMA50 && prevMA200 && prevMA50 <= prevMA200;
  
  // Divergence detection
  const divergence = detectDivergence(navHistory, rsiHistory);
  
  // Buy signals (theo note của bạn)
  const rsiAtBottom = rsi !== null && rsi <= 30; // RSI chạm 30 = đáy đang tạo
  const isBelowMA30 = latestMA30 ? latestNAV < latestMA30 : false;
  const isRSILow = rsi !== null && rsi < 40;
  
  // Buy signal conditions (kết hợp cả 2 công thức)
  const buySignals = [];
  
  // Công thức đầu tiên (RSI, MA, Divergence)
  if (rsiAtBottom) buySignals.push('RSI ≤ 30 (đáy đang tạo)');
  if (deathCross && justDeathCross) buySignals.push('Death Cross (MA50 < MA200 - chuẩn bị bắt đáy)');
  if (divergence === 'bullish') buySignals.push('Divergence tăng (giá xuống nhưng RSI lên)');
  if (isBelowMA30 && isRSILow) buySignals.push('NAV < MA30 & RSI < 40');
  
  // Công thức mới (MA180, Drawdown, Recovery Ratio)
  if (isBelowMA180) buySignals.push(`NAV < 95% MA(180) (${((latestNAV / latestMA180) * 100).toFixed(1)}% - vùng đáy tương đối)`);
  if (isBelowMA90) buySignals.push('NAV < MA(90) (dưới trung bình 3 tháng)');
  if (isDeepDrawdown) buySignals.push(`Drawdown sâu ${drawdown.toFixed(1)}% (giảm >10% so với đỉnh 52W)`);
  if (isAtBottomZone) buySignals.push(`Recovery Ratio ${(recoveryRatio * 100).toFixed(1)}% (ở vùng đáy 30% thấp nhất)`);
  
  const buySignal = buySignals.length > 0;
  
  // Sell signals
  const sellSignals = [];
  if (rsi !== null && rsi >= 70) sellSignals.push('RSI ≥ 70 (quá mua)');
  if (goldenCross && justGoldenCross) sellSignals.push('Golden Cross (MA50 > MA200 - thị trường đi lên, có thể đã qua đáy)');
  if (divergence === 'bearish') sellSignals.push('Divergence giảm (giá lên nhưng RSI xuống - tín hiệu đổi chiều)');
  
  const sellSignal = sellSignals.length > 0;
  
  // Get 12-month return from metadata
  const return12M = getReturn12M(fundCode);
  
  res.json({
    fundCode,
    rsi,
    ma7,
    ma30,
    ma50,
    ma90,
    ma180,
    ma200,
    buySignal,
    sellSignal,
    buySignals,
    sellSignals,
    isBelowMA30,
    isBelowMA90,
    isBelowMA180,
    isRSILow,
    rsiAtBottom,
    deathCross,
    goldenCross,
    justDeathCross,
    justGoldenCross,
    divergence,
    // Công thức mới
    drawdown,
    isDeepDrawdown,
    recoveryRatio,
    isAtBottomZone,
    navMax52W,
    navMin52W,
    // 12-month return
    return12M,
    latestNAV,
    latestMA30,
    latestMA50,
    latestMA90,
    latestMA180,
    latestMA200
  });
});

// API endpoint to update NAV data for a fund
app.post('/api/nav/:fundCode', (req, res) => {
  const { fundCode } = req.params;
  const data = req.body;
  
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Data must be an array of {date, nav} objects' });
  }
  
  navData[fundCode] = data;
  lastUpdated = new Date();
  
  res.json({ ok: true, fundCode, count: data.length });
});

// Crawl NAV from fmarket.vn for a specific fund
app.post('/api/crawl/:fundCode', async (req, res) => {
  try {
    const { fundCode } = req.params;
    const existingCount = (navData[fundCode] || []).length;
    const result = await scrapeFmarketNAV(fundCode);
    
    // Handle both old format (array) and new format (object with data and return12M)
    const newRows = Array.isArray(result) ? result : result.data;
    const return12M = result.return12M !== undefined ? result.return12M : null;
    
    // Merge with existing history (preserves old data, adds new dates)
    const mergedRows = mergeNavHistory(fundCode, newRows, return12M);
    navData[fundCode] = mergedRows;
    lastUpdated = new Date();
    res.json({ 
      ok: true, 
      fundCode, 
      newCount: newRows.length,
      totalCount: mergedRows.length,
      added: mergedRows.length - existingCount,
      return12M: return12M
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Crawl all funds from fmarket.vn
app.post('/api/crawl-all', async (req, res) => {
  try {
    const fundsList = loadFundsList();
    const limit = Number(process.env.CRAWL_CONCURRENCY || 3);
    const results = [];
    let i = 0;
    
    async function worker() {
      while (i < fundsList.length) {
        const idx = i++;
        const fundCode = fundsList[idx];
        try {
          const result = await scrapeFmarketNAV(fundCode);
          // Handle both old format (array) and new format (object with data and return12M)
          const newRows = Array.isArray(result) ? result : result.data;
          const return12M = result.return12M !== undefined ? result.return12M : null;
          // Merge with existing history
          const mergedRows = mergeNavHistory(fundCode, newRows, return12M);
          navData[fundCode] = mergedRows;
          results.push({ 
            code: fundCode, 
            ok: true, 
            newCount: newRows.length,
            totalCount: mergedRows.length,
            return12M: return12M
          });
        } catch (e) {
          results.push({ code: fundCode, ok: false, error: e.message });
        }
      }
    }
    
    await Promise.all(Array.from({ length: Math.min(limit, fundsList.length) }, worker));
    lastUpdated = new Date();
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Daily crawl at 9 AM to accumulate NAV history
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily NAV crawl...');
  try {
    const fundsList = loadFundsList();
    const limit = Number(process.env.CRAWL_CONCURRENCY || 3);
    let i = 0;
    
    async function worker() {
      while (i < fundsList.length) {
        const idx = i++;
        const fundCode = fundsList[idx];
        try {
          const newRows = await scrapeFmarketNAV(fundCode);
          const mergedRows = mergeNavHistory(fundCode, newRows);
          navData[fundCode] = mergedRows;
          console.log(`✓ ${fundCode}: ${newRows.length} new, ${mergedRows.length} total`);
        } catch (e) {
          console.error(`✗ ${fundCode}: ${e.message}`);
        }
      }
    }
    
    await Promise.all(Array.from({ length: Math.min(limit, fundsList.length) }, worker));
    lastUpdated = new Date();
    console.log('Daily crawl completed');
  } catch (e) {
    console.error('Daily crawl error:', e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Loaded ${Object.keys(navData).length} funds with historical data`);
  console.log('Daily crawl scheduled at 9:00 AM');
});
