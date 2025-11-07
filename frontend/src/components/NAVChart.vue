<template>
  <div class="chart-wrapper">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  navData: {
    type: Array,
    required: true,
    default: () => []
  },
  ma7: {
    type: Array,
    default: () => []
  },
  ma30: {
    type: Array,
    default: () => []
  },
  ma50: {
    type: Array,
    default: () => []
  },
  ma200: {
    type: Array,
    default: () => []
  }
})

const chartCanvas = ref(null)
let chartInstance = null

function createChart() {
  if (!chartCanvas.value || props.navData.length === 0) return

  const ctx = chartCanvas.value.getContext('2d')

  // Prepare labels (dates)
  const labels = props.navData.map(d => {
    const date = new Date(d.date)
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' })
  })

  // Prepare NAV dataset
  const navDataset = {
    label: 'NAV',
    data: props.navData.map(d => d.nav),
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 2,
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4
  }

  // Prepare MA7 dataset
  const ma7Dataset = {
    label: '7-day MA',
    data: props.ma7.map(ma => {
      // Find corresponding index in navData
      const index = props.navData.findIndex(d => d.date === ma.date)
      return index >= 0 ? ma.value : null
    }),
    borderColor: '#10b981',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [5, 5],
    fill: false,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4
  }

  // Prepare MA30 dataset
  const ma30Dataset = {
    label: '30-day MA',
    data: props.ma30.map(ma => {
      const index = props.navData.findIndex(d => d.date === ma.date)
      return index >= 0 ? ma.value : null
    }),
    borderColor: '#f59e0b',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [8, 4],
    fill: false,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4
  }

  // Prepare MA50 dataset
  const ma50Dataset = {
    label: '50-day MA',
    data: props.ma50.map(ma => {
      const index = props.navData.findIndex(d => d.date === ma.date)
      return index >= 0 ? ma.value : null
    }),
    borderColor: '#8b5cf6',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [10, 5],
    fill: false,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4
  }

  // Prepare MA200 dataset
  const ma200Dataset = {
    label: '200-day MA',
    data: props.ma200.map(ma => {
      const index = props.navData.findIndex(d => d.date === ma.date)
      return index >= 0 ? ma.value : null
    }),
    borderColor: '#ec4899',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [15, 5],
    fill: false,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4
  }

  const datasets = [navDataset]
  
  if (props.ma7.length > 0) {
    datasets.push(ma7Dataset)
  }
  
  if (props.ma30.length > 0) {
    datasets.push(ma30Dataset)
  }
  
  if (props.ma50.length > 0) {
    datasets.push(ma50Dataset)
  }
  
  if (props.ma200.length > 0) {
    datasets.push(ma200Dataset)
  }

  // Destroy existing chart if it exists
  if (chartInstance) {
    chartInstance.destroy()
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false // We handle legend in parent component
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
              const value = context.parsed.y
              return `${context.dataset.label}: ${value.toLocaleString('vi-VN')} VND`
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: {
              size: 11
            },
            color: '#666'
          }
        },
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          ticks: {
            font: {
              size: 11
            },
            color: '#666',
            callback: function(value) {
              return value.toLocaleString('vi-VN')
            }
          }
        }
      }
    }
  })
}

watch([() => props.navData, () => props.ma7, () => props.ma30], () => {
  createChart()
}, { deep: true })

onMounted(() => {
  createChart()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
.chart-wrapper {
  position: relative;
  height: 400px;
  width: 100%;
}

@media (max-width: 768px) {
  .chart-wrapper {
    height: 300px;
  }
}
</style>

