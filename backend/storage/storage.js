import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_PATH = resolve(__dirname, 'nav-history.json');

export function loadHistory() {
  try {
    if (existsSync(STORAGE_PATH)) {
      const data = readFileSync(STORAGE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading history:', e.message);
  }
  return {};
}

export function saveHistory(data) {
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error saving history:', e.message);
    return false;
  }
}

// Merge new NAV data with existing history
// Only adds new dates, preserves old data
export function mergeNavHistory(fundCode, newData, return12M = null) {
  const history = loadHistory();
  const fundData = history[fundCode];
  
  // Handle both old format (array) and new format (object with data)
  const existing = Array.isArray(fundData) ? fundData : (fundData?.data || []);
  
  // Handle both array and object format for newData
  const navArray = Array.isArray(newData) ? newData : (newData.data || newData);
  
  // Create a map of existing dates for quick lookup
  const dateMap = new Map(existing.map(item => [item.date, item.nav]));
  
  // Add new data, only if date doesn't exist or is newer
  navArray.forEach(item => {
    const existingNav = dateMap.get(item.date);
    if (!existingNav || item.nav !== existingNav) {
      dateMap.set(item.date, item.nav);
    }
  });
  
  // Convert back to array and sort
  const merged = Array.from(dateMap.entries())
    .map(([date, nav]) => ({ date, nav }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Store NAV history
  if (!history[fundCode]) {
    history[fundCode] = {};
  }
  history[fundCode].data = merged;
  
  // Store 12-month return if provided
  if (return12M !== null) {
    if (!history[fundCode].metadata) {
      history[fundCode].metadata = {};
    }
    history[fundCode].metadata.return12M = return12M;
    history[fundCode].metadata.return12MUpdated = new Date().toISOString();
  }
  
  saveHistory(history);
  
  return merged;
}

// Get 12-month return for a fund
export function getReturn12M(fundCode) {
  const history = loadHistory();
  return history[fundCode]?.metadata?.return12M ?? null;
}

// Get history for a specific fund
export function getFundHistory(fundCode) {
  const history = loadHistory();
  const fundData = history[fundCode];
  if (!fundData) return [];
  // Handle both old format (array) and new format (object with data)
  return Array.isArray(fundData) ? fundData : (fundData.data || []);
}

