<template>
  <div class="dca-recommendations">
    <div class="dca-header">
      <h2>📊 Gợi ý DCA hôm nay</h2>
      <p class="dca-subtitle">Danh sách quỹ nên mua cho chiến lược DCA (Dollar Cost Averaging)</p>
      <div class="dca-filters">
        <label>
          Điểm tối thiểu:
          <input 
            type="number" 
            v-model.number="minScore" 
            min="0" 
            max="100" 
            @change="loadRecommendations"
            class="filter-input"
          />
        </label>
        <label>
          Số lượng:
          <input 
            type="number" 
            v-model.number="limit" 
            min="5" 
            max="20" 
            @change="loadRecommendations"
            class="filter-input"
          />
        </label>
        <button @click="loadRecommendations" class="refresh-btn">🔄 Làm mới</button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Đang tải gợi ý...</p>
    </div>

    <div v-else-if="recommendations.length === 0" class="no-data">
      <p>Không có quỹ nào đạt điểm tối thiểu {{ minScore }}. Hãy thử giảm điểm hoặc chờ cập nhật dữ liệu.</p>
    </div>

    <div v-else class="recommendations-list">
      <div 
        v-for="(fund, index) in recommendations" 
        :key="fund.fundCode"
        class="recommendation-card"
        :class="getScoreClass(fund.dcaScore)"
        @click="selectFund(fund.fundCode)"
      >
        <div class="recommendation-rank">
          <span class="rank-number">#{{ index + 1 }}</span>
          <span class="score-badge" :class="getScoreClass(fund.dcaScore)">
            {{ fund.dcaScore }}/100
          </span>
        </div>
        
        <div class="recommendation-main">
          <h3 class="fund-code">{{ fund.fundCode }}</h3>
          <div class="fund-stats">
            <div class="stat-item">
              <span class="stat-label">NAV:</span>
              <span class="stat-value">{{ fund.latestNAV.toLocaleString('vi-VN') }} VND</span>
            </div>
            <div class="stat-item" v-if="fund.rsi !== null">
              <span class="stat-label">RSI:</span>
              <span class="stat-value" :class="getRSIClass(fund.rsi)">{{ fund.rsi }}</span>
            </div>
            <div class="stat-item" v-if="fund.drawdown !== null">
              <span class="stat-label">Drawdown:</span>
              <span class="stat-value" :class="fund.drawdown < -10 ? 'text-red' : 'text-gray'">
                {{ fund.drawdown.toFixed(1) }}%
              </span>
            </div>
            <div class="stat-item" v-if="fund.return12M !== null">
              <span class="stat-label">12M:</span>
              <span class="stat-value" :class="fund.return12M >= 0 ? 'text-green' : 'text-red'">
                {{ fund.return12M >= 0 ? '+' : '' }}{{ fund.return12M.toFixed(1) }}%
              </span>
            </div>
          </div>
          
          <div class="reasons">
            <div class="reasons-label">Lý do:</div>
            <div class="reasons-list">
              <span 
                v-for="(reason, idx) in fund.reasons" 
                :key="idx"
                class="reason-badge"
              >
                {{ reason }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="dca-info">
      <h4>💡 Về DCA Score</h4>
      <ul>
        <li><strong>80-100:</strong> Cơ hội mua rất tốt (đáy hoặc vùng giá tốt)</li>
        <li><strong>60-79:</strong> Vùng giá tốt, phù hợp DCA</li>
        <li><strong>50-59:</strong> Vùng giá ổn, có thể mua ít</li>
        <li><strong>&lt;50:</strong> Giá đang cao, nên chờ</li>
      </ul>
      <p class="dca-note">
        <strong>Lưu ý:</strong> DCA là chiến lược mua đều đặn theo thời gian, không cần đợi đáy tuyệt đối. 
        Điểm số này giúp bạn biết khi nào nên mua nhiều hơn (điểm cao) và khi nào nên mua ít hơn (điểm thấp).
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['select-fund'])

const recommendations = ref([])
const loading = ref(false)
const minScore = ref(50)
const limit = ref(10)

function getScoreClass(score) {
  if (score >= 80) return 'score-excellent'
  if (score >= 60) return 'score-good'
  if (score >= 50) return 'score-ok'
  return 'score-low'
}

function getRSIClass(rsi) {
  if (rsi <= 30) return 'text-blue'
  if (rsi <= 40) return 'text-green'
  if (rsi >= 70) return 'text-red'
  return 'text-gray'
}

function selectFund(fundCode) {
  emit('select-fund', fundCode)
}

async function loadRecommendations() {
  loading.value = true
  try {
    const response = await axios.get('/api/dca/recommendations', {
      params: {
        minScore: minScore.value,
        limit: limit.value
      }
    })
    recommendations.value = response.data.recommendations || []
  } catch (error) {
    console.error('Error loading DCA recommendations:', error)
    recommendations.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRecommendations()
})
</script>

<style scoped>
.dca-recommendations {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dca-header {
  margin-bottom: 1.5rem;
}

.dca-header h2 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.5rem;
}

.dca-subtitle {
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.dca-filters {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.dca-filters label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.filter-input {
  width: 60px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.refresh-btn:hover {
  background: #2563eb;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommendation-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.recommendation-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.recommendation-card.score-excellent {
  border-color: #10b981;
  background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
}

.recommendation-card.score-good {
  border-color: #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%);
}

.recommendation-card.score-ok {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
}

.recommendation-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  gap: 0.5rem;
}

.rank-number {
  font-size: 1.5rem;
  font-weight: bold;
  color: #3b82f6;
}

.score-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.score-badge.score-excellent {
  background: #10b981;
  color: white;
}

.score-badge.score-good {
  background: #3b82f6;
  color: white;
}

.score-badge.score-ok {
  background: #f59e0b;
  color: white;
}

.recommendation-main {
  flex: 1;
}

.fund-code {
  margin: 0 0 0.75rem 0;
  font-size: 1.25rem;
  color: #1f2937;
}

.fund-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
}

.stat-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1f2937;
}

.reasons {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.reasons-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.reasons-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.reason-badge {
  padding: 0.25rem 0.75rem;
  background: #f3f4f6;
  color: #4b5563;
  border-radius: 999px;
  font-size: 0.75rem;
}

.dca-info {
  margin-top: 2rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.dca-info h4 {
  margin: 0 0 0.75rem 0;
  color: #1f2937;
}

.dca-info ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  color: #4b5563;
  line-height: 1.8;
}

.dca-info li {
  margin: 0.25rem 0;
}

.dca-note {
  margin: 1rem 0 0 0;
  padding: 0.75rem;
  background: #eff6ff;
  border-radius: 6px;
  color: #1e40af;
  font-size: 0.875rem;
  line-height: 1.6;
}

.text-red {
  color: #ef4444;
}

.text-green {
  color: #10b981;
}

.text-blue {
  color: #3b82f6;
}

.text-gray {
  color: #6b7280;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: #6b7280;
}

.loading p {
  margin-top: 1rem;
  font-size: 1rem;
}

.no-data {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}
</style>

