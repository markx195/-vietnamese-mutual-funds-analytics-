#!/usr/bin/env node
/**
 * Standalone script to crawl NAV data daily
 * Can be run via system cron (crontab) or cloud scheduler
 * 
 * Usage:
 *   node backend/scripts/daily-crawl.js
 * 
 * Or add to crontab:
 *   0 9 * * * cd /path/to/TradeApp && node backend/scripts/daily-crawl.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeFmarketNAV } from '../scrapers/fmarket.js';
import { mergeNavHistory } from '../storage/storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFundsList() {
  try {
    const p = resolve(__dirname, '../config/funds.json');
    const txt = readFileSync(p, 'utf-8');
    return Object.keys(JSON.parse(txt));
  } catch {
    return [];
  }
}

async function crawlAllFunds() {
  const fundsList = loadFundsList();
  if (fundsList.length === 0) {
    console.log('No funds configured');
    return;
  }

  console.log(`Starting daily crawl for ${fundsList.length} funds...`);
  const limit = Number(process.env.CRAWL_CONCURRENCY || 3);
  const results = [];
  let i = 0;
  
  async function worker() {
    while (i < fundsList.length) {
      const idx = i++;
      const fundCode = fundsList[idx];
      try {
        console.log(`Crawling ${fundCode}...`);
        const result = await scrapeFmarketNAV(fundCode);
        const newRows = Array.isArray(result) ? result : result.data;
        const return12M = result.return12M !== undefined ? result.return12M : null;
        const merged = mergeNavHistory(fundCode, newRows, return12M);
        results.push({ 
          code: fundCode, 
          ok: true, 
          newCount: newRows.length,
          totalCount: merged.length,
          return12M: return12M
        });
        console.log(`✓ ${fundCode}: ${newRows.length} new, ${merged.length} total`);
      } catch (e) {
        console.error(`✗ ${fundCode}: ${e.message}`);
        results.push({ code: fundCode, ok: false, error: e.message });
      }
    }
  }
  
  await Promise.all(Array.from({ length: Math.min(limit, fundsList.length) }, worker));
  
  const success = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  
  console.log(`\nDaily crawl completed: ${success} success, ${failed} failed`);
  return results;
}

// Run if called directly
// In ES modules, we can check if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('daily-crawl.js');

if (isMainModule) {
  crawlAllFunds()
    .then(() => {
      console.log('Crawl script finished');
      process.exit(0);
    })
    .catch((e) => {
      console.error('Crawl script error:', e);
      process.exit(1);
    });
}

export { crawlAllFunds };

