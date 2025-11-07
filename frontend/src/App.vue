<template>
  <div class="app">
    <header class="header">
      <h1>Phân tích Chứng chỉ Quỹ Việt Nam</h1>
      <p class="subtitle">Theo dõi NAV và nhận biết cơ hội đầu tư</p>
    </header>
    
    <main class="main-content">
      <Dashboard />
    </main>
    
    <footer class="footer">
      <p>Thiết kế bởi Maxim — dành cho nhà đầu tư thông minh tại Việt Nam</p>
    </footer>
  </div>
</template>

<script setup>
import Dashboard from './components/Dashboard.vue'
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1rem;
  opacity: 0.9;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background-color: #ffffff;
  border-top: 1px solid #e0e0e0;
  padding: 1.5rem;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
  margin-top: auto;
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 1.5rem;
  }
  
  .main-content {
    padding: 1rem;
  }
}
</style>

