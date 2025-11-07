<template>
  <div class="dashboard">
    <div class="dashboard-tabs">
      <button 
        @click="activeTab = 'detail'" 
        class="tab-btn" 
        :class="{ active: activeTab === 'detail' }"
      >
        📈 Chi tiết quỹ
      </button>
      <button 
        @click="activeTab = 'dca'" 
        class="tab-btn" 
        :class="{ active: activeTab === 'dca' }"
      >
        💰 Gợi ý DCA hôm nay
      </button>
    </div>

    <!-- DCA Recommendations Tab -->
    <DCARecommendations 
      v-if="activeTab === 'dca'"
      @select-fund="handleSelectFund"
    />

    <!-- Fund Detail Tab -->
    <div v-if="activeTab === 'detail'" class="dashboard-content">
    <div class="dashboard-header">
      <div class="fund-selector">
        <label for="fund-select">Chọn quỹ:</label>
        <select 
          id="fund-select" 
          v-model="selectedFund" 
          @change="loadFundData"
          class="select-input"
        >
          <option value="">-- Chọn một quỹ --</option>
          <option v-for="fund in funds" :key="fund" :value="fund">
            {{ fund }}
          </option>
        </select>
        <button v-if="selectedFund" @click="toggleFavorite(selectedFund)" class="fav-btn" :class="{ active: isFavorite(selectedFund) }" aria-label="Thêm vào yêu thích">
          ★
        </button>
      </div>

      <div v-if="favoriteFunds.length" class="favorites">
        <span class="fav-title">Yêu thích:</span>
        <button 
          v-for="code in favoriteFunds" 
          :key="code" 
          class="fav-chip" 
          @click="selectFavorite(code)"
        >
          {{ code }}
        </button>
      </div>
    </div>

    <div v-if="selectedFund && navData.length > 0" class="dashboard-content">
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">NAV mới nhất</div>
          <div class="stat-value">{{ latestNAV.toLocaleString('vi-VN') }} VND</div>
          <div class="stat-date">{{ latestDate }}</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Thay đổi ngày</div>
          <div class="stat-value" :class="changeClass">
            {{ changePercent >= 0 ? '+' : '' }}{{ changePercent.toFixed(2) }}%
          </div>
          <div class="stat-change" :class="changeClass">
            {{ change >= 0 ? '+' : '' }}{{ change.toLocaleString('vi-VN') }} VND
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-label">RSI (14 ngày)</div>
          <div class="stat-value" :class="rsiClass">
            {{ rsi !== null ? rsi.toFixed(2) : 'N/A' }}
          </div>
          <div class="stat-hint">RSI < 40 có thể là quá bán</div>
        </div>

        <div class="stat-card" v-if="drawdown !== null">
          <div class="stat-label">Drawdown (52 tuần)</div>
          <div class="stat-value" :class="drawdown < -10 ? 'text-red' : 'text-gray'">
            {{ drawdown.toFixed(2) }}%
          </div>
          <div class="stat-hint">Giảm so với đỉnh 52W</div>
        </div>

        <div class="stat-card" v-if="recoveryRatio !== null">
          <div class="stat-label">Recovery Ratio</div>
          <div class="stat-value" :class="recoveryRatio < 0.3 ? 'text-blue' : 'text-gray'">
            {{ (recoveryRatio * 100).toFixed(1) }}%
          </div>
          <div class="stat-hint">{{ recoveryRatio < 0.3 ? 'Vùng đáy 30% thấp nhất' : 'Đang phục hồi' }}</div>
        </div>

        <div class="stat-card" v-if="return12M !== null">
          <div class="stat-label">Lợi nhuận 12 tháng</div>
          <div class="stat-value" :class="return12M >= 0 ? 'text-green' : 'text-red'">
            {{ return12M >= 0 ? '+' : '' }}{{ return12M.toFixed(2) }}%
          </div>
          <div class="stat-hint">Hiệu suất 1 năm qua</div>
        </div>

        <div class="stat-card buy-signal-card" :class="{ 'signal-active': buySignal }">
          <div class="stat-label">Tín hiệu mua</div>
          <div class="buy-signal-indicator">
            <span class="signal-icon" :class="buySignal ? 'signal-good' : 'signal-neutral'">
              {{ buySignal ? '✓' : '○' }}
            </span>
            <span class="signal-text">{{ buySignal ? 'Nên mua' : 'Chờ thêm' }}</span>
          </div>
          <div class="signal-details">
            <div v-if="buySignal && buySignals.length" class="signal-reason">
              <div v-for="(reason, idx) in buySignals" :key="idx" class="signal-item">
                • {{ reason }}
              </div>
            </div>
            <div v-else class="signal-reason">
              Chưa có tín hiệu mua rõ ràng
            </div>
          </div>
        </div>

        <div class="stat-card sell-signal-card" :class="{ 'signal-active': sellSignal }">
          <div class="stat-label">Tín hiệu bán</div>
          <div class="buy-signal-indicator">
            <span class="signal-icon" :class="sellSignal ? 'signal-bad' : 'signal-neutral'">
              {{ sellSignal ? '⚠' : '○' }}
            </span>
            <span class="signal-text">{{ sellSignal ? 'Cân nhắc bán' : 'Giữ' }}</span>
          </div>
          <div class="signal-details">
            <div v-if="sellSignal && sellSignals.length" class="signal-reason">
              <div v-for="(reason, idx) in sellSignals" :key="idx" class="signal-item">
                • {{ reason }}
              </div>
            </div>
            <div v-else class="signal-reason">
              Không có tín hiệu bán
            </div>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div class="chart-container">
        <div class="chart-header">
          <h2>Xu hướng NAV - {{ selectedFund }}</h2>
          <div class="update-info">
            <span v-if="meta">
              Cập nhật: {{ timeSinceUpdate }} trước · Lần tới: {{ nextUpdateTime }}
            </span>
          </div>
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-color" style="background: #3b82f6;"></span>
              NAV
            </span>
            <span class="legend-item">
              <span class="legend-color" style="background: #10b981;"></span>
              MA 7 ngày
            </span>
            <span class="legend-item">
              <span class="legend-color" style="background: #f59e0b;"></span>
              MA 30 ngày
            </span>
            <span class="legend-item" v-if="ma50.length">
              <span class="legend-color" style="background: #8b5cf6;"></span>
              MA 50 ngày
            </span>
            <span class="legend-item" v-if="ma200.length">
              <span class="legend-color" style="background: #ec4899;"></span>
              MA 200 ngày
            </span>
          </div>
          <div v-if="justDeathCross || justGoldenCross || divergence" class="chart-signals">
            <span v-if="justDeathCross" class="signal-badge death-cross">⚡ Death Cross (MA50 < MA200)</span>
            <span v-if="justGoldenCross" class="signal-badge golden-cross">⭐ Golden Cross (MA50 > MA200)</span>
            <span v-if="divergence === 'bearish'" class="signal-badge divergence-bearish">⚠️ Divergence: Giá lên, RSI xuống</span>
            <span v-if="divergence === 'bullish'" class="signal-badge divergence-bullish">📈 Divergence: Giá xuống, RSI lên</span>
          </div>
        </div>
        <NAVChart 
          :nav-data="navData" 
          :ma7="ma7" 
          :ma30="ma30"
          :ma50="ma50"
          :ma200="ma200"
        />
      </div>

      <!-- So sánh công thức -->
      <div class="formula-comparison" v-if="buySignal || sellSignal">
        <h3>📊 So sánh công thức phân tích</h3>
        <div class="formula-grid">
          <div class="formula-card">
            <h4>🔹 Công thức 1: RSI + MA + Divergence</h4>
            <ul>
              <li>RSI ≤ 30: Đáy đang tạo</li>
              <li>Death Cross (MA50 < MA200): Chuẩn bị bắt đáy</li>
              <li>Divergence: Tín hiệu đổi chiều</li>
              <li>NAV < MA30 & RSI < 40</li>
            </ul>
            <p class="formula-note">→ Tập trung vào tín hiệu kỹ thuật ngắn hạn</p>
          </div>
          <div class="formula-card">
            <h4>🔹 Công thức 2: MA180 + Drawdown + Recovery</h4>
            <ul>
              <li>NAV < 95% MA(180): Vùng đáy tương đối</li>
              <li>Drawdown > 10%: Giảm sâu so với đỉnh</li>
              <li>Recovery Ratio < 30%: Ở vùng đáy thấp nhất</li>
              <li>NAV < MA(90): Dưới trung bình 3 tháng</li>
            </ul>
            <p class="formula-note">→ Phân tích dài hạn và vị trí trong chu kỳ</p>
          </div>
        </div>
        <div class="formula-summary">
          <strong>💡 Kết hợp cả 2:</strong> Công thức 1 phát hiện điểm vào tốt, công thức 2 xác nhận vùng đáy an toàn để tích lũy dài hạn.
        </div>
      </div>
    </div>

    <div v-else-if="selectedFund && (isLoadingFund || navData.length === 0)" class="loading">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu cho {{ selectedFund }}...</p>
    </div>

    <div v-else class="welcome-message">
      <p>Hãy chọn một quỹ ở phía trên để xem phân tích</p>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'
import NAVChart from './NAVChart.vue'
import DCARecommendations from './DCARecommendations.vue'

const activeTab = ref('detail')
const funds = ref([])
const selectedFund = ref('')
const navData = ref([])
const analytics = ref(null)
const meta = ref(null)
const timer = ref(null)
const now = ref(Date.now())
const favoriteFunds = ref([])
const isLoadingFund = ref(false)

function handleSelectFund(fundCode) {
  selectedFund.value = fundCode
  activeTab.value = 'detail'
  loadFundData()
}

// Watch for fund changes and clear data immediately
watch(selectedFund, (newFund, oldFund) => {
  if (newFund !== oldFund && newFund) {
    // Clear old data immediately when switching funds
    navData.value = []
    analytics.value = null
    isLoadingFund.value = true
  }
})

const latestNAV = computed(() => {
  if (navData.value.length === 0) return 0
  return navData.value[navData.value.length - 1].nav
})

const latestDate = computed(() => {
  if (navData.value.length === 0) return ''
  return navData.value[navData.value.length - 1].date
})

const previousNAV = computed(() => {
  if (navData.value.length < 2) return latestNAV.value
  return navData.value[navData.value.length - 2].nav
})

const change = computed(() => {
  return latestNAV.value - previousNAV.value
})

const changePercent = computed(() => {
  if (previousNAV.value === 0) return 0
  return ((change.value / previousNAV.value) * 100)
})

const changeClass = computed(() => {
  return change.value >= 0 ? 'positive' : 'negative'
})

const rsi = computed(() => {
  return analytics.value?.rsi ?? null
})

const rsiClass = computed(() => {
  if (rsi.value === null) return ''
  if (rsi.value < 40) return 'rsi-low'
  if (rsi.value > 70) return 'rsi-high'
  return 'rsi-normal'
})

const ma7 = computed(() => {
  return analytics.value?.ma7 ?? []
})

const ma30 = computed(() => {
  return analytics.value?.ma30 ?? []
})

const ma50 = computed(() => {
  return analytics.value?.ma50 ?? []
})

const ma200 = computed(() => {
  return analytics.value?.ma200 ?? []
})

const buySignal = computed(() => {
  return analytics.value?.buySignal ?? false
})

const sellSignal = computed(() => {
  return analytics.value?.sellSignal ?? false
})

const buySignals = computed(() => {
  return analytics.value?.buySignals ?? []
})

const sellSignals = computed(() => {
  return analytics.value?.sellSignals ?? []
})

const justDeathCross = computed(() => {
  return analytics.value?.justDeathCross ?? false
})

const justGoldenCross = computed(() => {
  return analytics.value?.justGoldenCross ?? false
})

const divergence = computed(() => {
  return analytics.value?.divergence ?? null
})

const drawdown = computed(() => {
  return analytics.value?.drawdown ?? null
})

const recoveryRatio = computed(() => {
  return analytics.value?.recoveryRatio ?? null
})

const isBelowMA180 = computed(() => {
  return analytics.value?.isBelowMA180 ?? false
})

const return12M = computed(() => {
  return analytics.value?.return12M ?? null
})

const isBelowMA30 = computed(() => {
  return analytics.value?.isBelowMA30 ?? false
})

const isRSILow = computed(() => {
  return analytics.value?.isRSILow ?? false
})

async function loadFunds() {
  try {
    const response = await axios.get('/api/funds')
    funds.value = response.data
  } catch (error) {
    console.error('Error loading funds:', error)
  }
}

async function loadFundData() {
  if (!selectedFund.value) {
    navData.value = []
    analytics.value = null
    isLoadingFund.value = false
    return
  }

  // Store current fund to check if user switched
  const currentFund = selectedFund.value

  // Clear old data immediately
  navData.value = []
  analytics.value = null
  isLoadingFund.value = true

  try {
    // Try to load data first
    try {
      const [navResponse, analyticsResponse] = await Promise.all([
        axios.get(`/api/nav/${currentFund}`),
        axios.get(`/api/analytics/${currentFund}`)
      ])
      
      // Only update if still the same fund (user didn't switch)
      if (selectedFund.value === currentFund) {
        navData.value = navResponse.data
        analytics.value = analyticsResponse.data
      }
      isLoadingFund.value = false
      return
    } catch (loadError) {
      // If 404, try to crawl first
      if (loadError.response?.status === 404) {
        try {
          // Check again if user switched
          if (selectedFund.value !== currentFund) {
            isLoadingFund.value = false
            return
          }
          
          await axios.post(`/api/crawl/${currentFund}`)
          // Wait a bit for data to be stored
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Check again if user switched during crawl
          if (selectedFund.value !== currentFund) {
            isLoadingFund.value = false
            return
          }
          
          // Retry loading
          const [navResponse, analyticsResponse] = await Promise.all([
            axios.get(`/api/nav/${currentFund}`),
            axios.get(`/api/analytics/${currentFund}`)
          ])
          
          // Only update if still the same fund
          if (selectedFund.value === currentFund) {
            navData.value = navResponse.data
            analytics.value = analyticsResponse.data
          }
          isLoadingFund.value = false
          return
        } catch (crawlError) {
          console.error('Error crawling fund:', crawlError)
          if (selectedFund.value === currentFund) {
            isLoadingFund.value = false
          }
          throw crawlError
        }
      }
      if (selectedFund.value === currentFund) {
        isLoadingFund.value = false
      }
      throw loadError
    }
  } catch (error) {
    console.error('Error loading fund data:', error)
    // Only clear if still the same fund
    if (selectedFund.value === currentFund) {
      navData.value = []
      analytics.value = null
      isLoadingFund.value = false
    }
  }
}

async function loadMeta() {
  try {
    const res = await axios.get('/api/meta')
    meta.value = res.data
  } catch (e) {
    // silent
  }
}

function startClock() {
  stopClock()
  timer.value = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopClock() {
  if (timer.value) clearInterval(timer.value)
}

const timeSinceUpdate = computed(() => {
  if (!meta.value?.lastUpdated) return 'N/A'
  const diff = Math.max(0, Math.floor((now.value - new Date(meta.value.lastUpdated).getTime()) / 1000))
  if (diff < 60) return `${diff}s`
  const m = Math.floor(diff / 60)
  const s = diff % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m`
})

const nextUpdateTime = computed(() => {
  if (!meta.value?.nextUpdate) return 'N/A'
  const dt = new Date(meta.value.nextUpdate)
  return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
})

function loadFavorites() {
  try {
    const raw = localStorage.getItem('favoriteFunds')
    favoriteFunds.value = raw ? JSON.parse(raw) : []
  } catch {
    favoriteFunds.value = []
  }
}

function saveFavorites() {
  localStorage.setItem('favoriteFunds', JSON.stringify(favoriteFunds.value))
}

function isFavorite(code) {
  return favoriteFunds.value.includes(code)
}

function toggleFavorite(code) {
  if (!code) return
  if (isFavorite(code)) {
    favoriteFunds.value = favoriteFunds.value.filter(c => c !== code)
  } else {
    favoriteFunds.value = [...new Set([code, ...favoriteFunds.value])].slice(0, 12)
  }
  saveFavorites()
}

function selectFavorite(code) {
  selectedFund.value = code
  loadFundData()
}

onMounted(() => {
  loadFavorites()
  loadFunds()
  loadMeta()
  startClock()
})

onBeforeUnmount(() => {
  stopClock()
})
</script>

<style scoped>
.dashboard {
  width: 100%;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.fund-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.fund-selector label {
  font-weight: 600;
  color: #333;
}

.select-input {
  padding: 0.75rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 200px;
}

.select-input:hover {
  border-color: #667eea;
}

.select-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.fav-btn {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.fav-btn.active,
.fav-btn:hover {
  border-color: #f59e0b;
  color: #f59e0b;
}

.favorites {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.fav-title {
  font-size: 0.875rem;
  color: #666;
}

.fav-chip {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  background: #eef2ff;
  color: #334155;
  border: none;
  cursor: pointer;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.stat-label {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 0.25rem;
}

.stat-value.positive {
  color: #10b981;
}

.stat-value.negative {
  color: #ef4444;
}

.stat-date {
  font-size: 0.875rem;
  color: #999;
}

.stat-change {
  font-size: 0.875rem;
  font-weight: 500;
}

.stat-change.positive {
  color: #10b981;
}

.stat-change.negative {
  color: #ef4444;
}

.stat-hint {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.5rem;
}

.rsi-low {
  color: #10b981;
}

.rsi-high {
  color: #ef4444;
}

.rsi-normal {
  color: #3b82f6;
}

.buy-signal-card {
  border: 2px solid #e0e0e0;
}

.buy-signal-card.signal-active {
  border-color: #10b981;
  background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
}

.buy-signal-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.signal-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
}

.signal-icon.signal-good {
  background: #10b981;
  color: white;
}

.signal-icon.signal-neutral {
  background: #e5e7eb;
  color: #6b7280;
}

.signal-text {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.signal-details {
  margin-top: 0.75rem;
}

.signal-reason {
  font-size: 0.875rem;
  color: #666;
  line-height: 1.4;
}

.signal-item {
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

.sell-signal-card {
  border: 2px solid #e0e0e0;
}

.sell-signal-card.signal-active {
  border-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
}

.signal-icon.signal-bad {
  background: #ef4444;
  color: white;
}

.chart-signals {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.signal-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.signal-badge.death-cross {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fbbf24;
}

.signal-badge.golden-cross {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
}

.signal-badge.divergence-bearish {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}

.signal-badge.divergence-bullish {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #3b82f6;
}

.text-red {
  color: #ef4444;
}

.text-blue {
  color: #3b82f6;
}

.text-gray {
  color: #6b7280;
}

.text-green {
  color: #10b981;
}

.formula-comparison {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 1.5rem;
}

.formula-comparison h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.125rem;
}

.formula-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.formula-card {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.formula-card h4 {
  margin: 0 0 0.75rem 0;
  color: #1f2937;
  font-size: 0.95rem;
}

.formula-card ul {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
  color: #4b5563;
  font-size: 0.875rem;
  line-height: 1.6;
}

.formula-card li {
  margin: 0.25rem 0;
}

.formula-note {
  margin: 0.75rem 0 0 0;
  font-size: 0.8rem;
  color: #6b7280;
  font-style: italic;
}

.formula-summary {
  background: #eff6ff;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
  color: #1e40af;
  font-size: 0.9rem;
  line-height: 1.6;
}

.dashboard-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  color: #6b7280;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-btn:hover {
  color: #3b82f6;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.chart-container {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 2rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.chart-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
}

.update-info {
  font-size: 0.85rem;
  color: #6b7280;
}

.chart-legend {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: #666;
  font-size: 1.1rem;
}

.loading p {
  margin-top: 1rem;
}

.welcome-message {
  text-align: center;
  padding: 3rem;
  color: #666;
  font-size: 1.1rem;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

