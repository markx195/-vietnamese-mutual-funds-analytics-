import axios from 'axios';
import { load as loadHtml } from 'cheerio';
import { chromium } from 'playwright';

function parseNumberVN(value) {
  if (typeof value !== 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  // Vietnamese format: 30,687.50 or 30.687,50
  const s = value.replace(/\s/g, '');
  // If has comma as thousands separator (30,687)
  if (s.includes(',') && !s.includes('.')) {
    const cleaned = s.replace(/,/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  // If has dot as thousands separator (30.687,50)
  if (s.includes('.') && s.includes(',')) {
    const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  // Standard format
  const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function normalizeDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  // Try DD/MM/YYYY
  const m1 = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm}-${dd}`;
  }
  // Try YYYY-MM-DD
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

export async function scrapeFmarketNAV(fundCode) {
  const url = `https://fmarket.vn/quy/${fundCode}`;
  
  const res = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9'
    }
  });

  const html = res.data;
  const $ = loadHtml(html);
  const rows = [];
  
  // Try to find API endpoint for chart data
  let apiUrl = null;
  $('script').each((_, el) => {
    const text = $(el).html() || $(el).text();
    if (!text) return;
    
    // Look for API endpoints
    const apiMatches = text.match(/https?:\/\/[^"'\s]+(?:api|chart|nav|data)[^"'\s]*/gi);
    if (apiMatches) {
      apiMatches.forEach(match => {
        if (match.includes('fmarket') && (match.includes('nav') || match.includes('chart') || match.includes('data'))) {
          apiUrl = match.replace(/['"]/g, '');
        }
      });
    }
    
    // Look for fetch/axios calls with fund code
    const fetchMatches = text.match(/(?:fetch|axios|\.get|\.post)\(['"]([^'"]*\/quy\/[^'"]*|.*nav.*|.*chart.*)['"]/gi);
    if (fetchMatches) {
      fetchMatches.forEach(match => {
        const urlMatch = match.match(/['"]([^'"]+)['"]/);
        if (urlMatch && urlMatch[1]) {
          const foundUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://fmarket.vn${urlMatch[1]}`;
          if (foundUrl.includes('fmarket') && !apiUrl) {
            apiUrl = foundUrl;
          }
        }
      });
    }
  });
  
  // Try to fetch chart data from API if found
  if (apiUrl) {
    try {
      const apiRes = await axios.get(apiUrl.replace('{fundCode}', fundCode), {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json'
        }
      });
      if (apiRes.data && Array.isArray(apiRes.data)) {
        apiRes.data.forEach(item => {
          const dateStr = item.date || item.Date || item.t || item.x || item[0];
          const navVal = item.nav || item.NAV || item.value || item.y || item.close || item[1];
          const date = normalizeDate(String(dateStr));
          const nav = parseNumberVN(String(navVal));
          if (date && nav != null && nav > 100) {
            rows.push({ date, nav });
          }
        });
      }
    } catch {}
  }

  // Strategy 1: Look for NAV chart data in script tags (common in modern web apps)
  $('script').each((_, el) => {
    const text = $(el).html() || $(el).text();
    if (!text) return;
    
    // Try to find embedded JSON data arrays
    // Pattern: var data = [{date: "...", value: ...}, ...]
    const jsonArrayPatterns = [
      /(?:var|let|const)\s+\w*[Dd]ata\w*\s*=\s*(\[[\s\S]{100,50000}\])/gi,
      /(?:chartData|navData|seriesData|data)\s*[:=]\s*(\[[\s\S]{100,50000}\])/gi,
      /data:\s*(\[[\s\S]{100,50000}\])/gi,
      /points:\s*(\[[\s\S]{100,50000}\])/gi
    ];
    
    jsonArrayPatterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        try {
          const jsonStr = match[1];
          if (jsonStr && jsonStr.length > 50) {
            const data = JSON.parse(jsonStr);
            if (Array.isArray(data) && data.length > 1) {
              data.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                  const dateStr = item.date || item.Date || item.t || item.time || item.x || item.label || item[0];
                  const navVal = item.nav || item.NAV || item.value || item.y || item.close || item.price || item.v || item[1];
                  const date = normalizeDate(String(dateStr));
                  const nav = parseNumberVN(String(navVal));
                  if (date && nav != null && nav > 100) {
                    rows.push({ date, nav });
                  }
                } else if (Array.isArray(item) && item.length >= 2) {
                  const date = normalizeDate(String(item[0]));
                  const nav = parseNumberVN(String(item[1]));
                  if (date && nav != null && nav > 100) {
                    rows.push({ date, nav });
                  }
                }
              });
            }
          }
        } catch {}
      });
    });
    
    // Try to find 2D arrays: [[date, nav], [date, nav], ...]
    const array2DPattern = /\[\[[\s\S]*?\]/g;
    const arrayMatches = text.match(array2DPattern);
    if (arrayMatches) {
      arrayMatches.forEach(match => {
        try {
          const data = JSON.parse(match);
          if (Array.isArray(data) && data.length > 1 && Array.isArray(data[0])) {
            data.forEach(item => {
              if (Array.isArray(item) && item.length >= 2) {
                const date = normalizeDate(String(item[0]));
                const nav = parseNumberVN(String(item[1]));
                if (date && nav != null && nav > 100) {
                  rows.push({ date, nav });
                }
              }
            });
          }
        } catch {}
      });
    }
  });

  // Strategy 2: Extract from table if available
  if (rows.length < 10) {
    $('table tr, tbody tr').each((_, el) => {
      const tds = $(el).find('td');
      if (tds.length >= 2) {
        for (let i = 0; i < tds.length - 1; i++) {
          const dateText = $(tds[i]).text().trim();
          const navText = $(tds[i + 1]).text().trim();
          const date = normalizeDate(dateText);
          const nav = parseNumberVN(navText);
          if (date && nav != null && nav > 1000 && nav < 1000000) {
            rows.push({ date, nav: Math.round(nav * 100) / 100 });
            break;
          }
        }
      }
    });
  }

  // Strategy 3: Look for "Giá gần nhất" and extract current NAV with date
  const priceSection = $('*:contains("Giá gần nhất"), *:contains("Cập nhật ngày")').first();
  if (priceSection.length) {
    const text = priceSection.text();
    // Extract date: "Cập nhật ngày 06/11/2025"
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    // Extract NAV: "30,687 VND"
    const priceMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*VND/i);
    if (priceMatch) {
      const nav = parseNumberVN(priceMatch[1]);
      if (nav != null) {
        const date = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().split('T')[0];
        rows.push({ date, nav });
      }
    }
  }

  // Strategy 4: Extract 12-month return percentage from class "benefit showDesktop" in fund__chart
  let return12M = null;
  
  // First, try to find in fund__chart div (most reliable)
  const fundChart = $('.fund__chart');
  if (fundChart.length > 0) {
    // Look for benefit element with "12 tháng" active or in the chart area
    const chartFilter = fundChart.find('.fund__chart--filter');
    const active12Month = chartFilter.find('.item.active');
    
    // Check if "12 tháng" is active
    if (active12Month.length > 0 && active12Month.text().includes('12 tháng')) {
      // Find benefit element in the same chart area
      const benefitInChart = fundChart.find('.benefit.showDesktop, .benefit.showDesktop.up, .benefit.showDesktop.down');
      if (benefitInChart.length > 0) {
        benefitInChart.each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          // Extract percentage: "+28.1%" or "-5.2%" or "28.1%"
          // Handle format: <span class="up">+</span> 28.1%
          const fullText = $el.text().replace(/\s+/g, ' ').trim();
          const percentMatch = fullText.match(/([+-]?\s*\d+[.,]\d+|\d+[.,]\d+)\s*%/);
          if (percentMatch) {
            let percentStr = percentMatch[1].replace(/\s/g, '').replace(',', '.');
            // Check if there's a separate + or - sign
            const hasUp = $el.hasClass('up') || $el.find('.up').length > 0;
            const hasDown = $el.hasClass('down') || $el.find('.down').length > 0;
            if (hasUp && !percentStr.startsWith('-')) {
              percentStr = '+' + percentStr;
            } else if (hasDown && !percentStr.startsWith('-')) {
              percentStr = '-' + percentStr;
            }
            const val = parseFloat(percentStr);
            if (val >= -50 && val <= 200) {
              return12M = val;
              return false; // break
            }
          }
        });
      }
    }
  }
  
  // Fallback: Try all benefit elements
  if (return12M === null) {
    const benefitElements = $('.benefit.showDesktop, .benefit.showDesktop.up, .benefit.showDesktop.down');
    if (benefitElements.length > 0) {
      benefitElements.each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        const fullText = $el.text().replace(/\s+/g, ' ').trim();
        const percentMatch = fullText.match(/([+-]?\s*\d+[.,]\d+|\d+[.,]\d+)\s*%/);
        if (percentMatch && return12M === null) {
          let percentStr = percentMatch[1].replace(/\s/g, '').replace(',', '.');
          const hasUp = $el.hasClass('up') || $el.find('.up').length > 0;
          const hasDown = $el.hasClass('down') || $el.find('.down').length > 0;
          if (hasUp && !percentStr.startsWith('-')) {
            percentStr = '+' + percentStr;
          } else if (hasDown && !percentStr.startsWith('-')) {
            percentStr = '-' + percentStr;
          }
          const val = parseFloat(percentStr);
          if (val >= -50 && val <= 200) {
            return12M = val;
            return false; // break
          }
        }
      });
    }
  }
  
  // Also try searching near "12 tháng" text
  if (return12M === null) {
    $('*:contains("12 tháng")').each((_, el) => {
      const $el = $(el);
      const $parent = $el.parent();
      const benefitNearby = $parent.find('.benefit, [class*="benefit"]');
      if (benefitNearby.length > 0) {
        benefitNearby.each((_, benEl) => {
          const $ben = $(benEl);
          const fullText = $ben.text().replace(/\s+/g, ' ').trim();
          const percentMatch = fullText.match(/([+-]?\s*\d+[.,]\d+|\d+[.,]\d+)\s*%/);
          if (percentMatch) {
            let percentStr = percentMatch[1].replace(/\s/g, '').replace(',', '.');
            const hasUp = $ben.hasClass('up') || $ben.find('.up').length > 0;
            const hasDown = $ben.hasClass('down') || $ben.find('.down').length > 0;
            if (hasUp && !percentStr.startsWith('-')) {
              percentStr = '+' + percentStr;
            } else if (hasDown && !percentStr.startsWith('-')) {
              percentStr = '-' + percentStr;
            }
            const val = parseFloat(percentStr);
            if (val >= -50 && val <= 200) {
              return12M = val;
              return false; // break
            }
          }
        });
      }
      if (return12M !== null) return false; // break outer loop
    });
  }

  // If we only got 1 NAV, try using Playwright to get chart data
  if (rows.length <= 1) {
    try {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for chart to load
      
      // Try to extract chart data from page context
      const chartData = await page.evaluate(() => {
        // Strategy 1: Look for Chart.js instances
        if (window.Chart && window.Chart.instances) {
          for (const chart of Object.values(window.Chart.instances)) {
            if (chart.data && chart.data.datasets) {
              for (const dataset of chart.data.datasets) {
                if (dataset.data && Array.isArray(dataset.data) && dataset.data.length > 1) {
                  return dataset.data;
                }
              }
            }
          }
        }
        
        // Strategy 2: Look for Highcharts
        if (window.Highcharts && window.Highcharts.charts) {
          for (const chart of window.Highcharts.charts) {
            if (chart && chart.series) {
              for (const series of chart.series) {
                if (series.options && series.options.data && Array.isArray(series.options.data) && series.options.data.length > 1) {
                  return series.options.data;
                }
                if (series.points && Array.isArray(series.points) && series.points.length > 1) {
                  return series.points.map(p => [p.x, p.y]);
                }
              }
            }
          }
        }
        
        // Strategy 3: Look for ApexCharts
        if (window.ApexCharts) {
          const charts = document.querySelectorAll('.apexcharts-canvas');
          for (const canvas of charts) {
            const chartId = canvas.getAttribute('id');
            if (chartId) {
              const chart = window.ApexCharts.getChartByID(chartId);
              if (chart && chart.w && chart.w.globals && chart.w.globals.seriesData) {
                const data = chart.w.globals.seriesData;
                if (data && data.length > 0 && Array.isArray(data[0]) && data[0].length > 1) {
                  return data[0];
                }
              }
            }
          }
        }
        
        // Strategy 4: Look for data attributes in chart containers
        const chartContainers = document.querySelectorAll('[data-chart], [id*="chart"], [class*="chart"]');
        for (const container of chartContainers) {
          const dataAttr = container.getAttribute('data-chart-data') || container.getAttribute('data-data');
          if (dataAttr) {
            try {
              const parsed = JSON.parse(dataAttr);
              if (Array.isArray(parsed) && parsed.length > 1) {
                return parsed;
              }
            } catch {}
          }
        }
        
        // Strategy 5: Look in window object for large arrays
        for (const key in window) {
          try {
            const obj = window[key];
            if (Array.isArray(obj) && obj.length > 5) {
              const first = obj[0];
              if (typeof first === 'object' && first !== null) {
                if (first.date || first.Date || first.t || first.x || (Array.isArray(first) && first.length >= 2)) {
                  return obj;
                }
              } else if (Array.isArray(first) && first.length >= 2) {
                return obj;
              }
            }
          } catch {}
        }
        
        return null;
      });
      
      if (chartData && Array.isArray(chartData)) {
        chartData.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            const dateStr = item.date || item.Date || item.t || item.x || item[0];
            const navVal = item.nav || item.NAV || item.value || item.y || item.close || item[1];
            const date = normalizeDate(String(dateStr));
            const nav = parseNumberVN(String(navVal));
            if (date && nav != null && nav > 100) {
              rows.push({ date, nav });
            }
          } else if (Array.isArray(item) && item.length >= 2) {
            const date = normalizeDate(String(item[0]));
            const nav = parseNumberVN(String(item[1]));
            if (date && nav != null && nav > 100) {
              rows.push({ date, nav });
            }
          }
        });
      }
      
      await browser.close();
    } catch (e) {
      // Playwright failed, continue with what we have
      console.error(`Playwright error for ${fundCode}:`, e.message);
    }
  }

  if (!rows.length) {
    throw new Error(`No NAV data found for ${fundCode} on fmarket.vn`);
  }

  // Remove duplicates and sort
  const unique = Array.from(new Map(rows.map(r => [r.date, r])).values());
  const sorted = unique.sort((a, b) => a.date.localeCompare(b.date));
  
  // Add 12-month return to the result metadata
  // Return as object with data and metadata
  return {
    data: sorted,
    return12M: return12M !== null ? Math.round(return12M * 100) / 100 : null
  };
}

