# Vietnamese Mutual Funds Analytics

A clean and modern financial analytics website for Vietnamese mutual funds (chứng chỉ quỹ) that helps investors identify good buying opportunities.

## Features

- 📊 Display daily NAV (Net Asset Value) for major Vietnamese mutual funds
- 📈 Interactive charts with 7-day, 30-day, 50-day, 90-day, 180-day, and 200-day moving averages
- 🎯 Advanced buy/sell signal detection:
  - RSI-based signals (RSI ≤ 30 = đáy, RSI ≥ 70 = quá mua)
  - Death Cross / Golden Cross (MA50 vs MA200)
  - Divergence detection (price vs RSI)
  - Drawdown analysis (52-week)
  - Recovery Ratio analysis
  - DCA recommendations với scoring system
- 📱 Responsive dashboard with fund selector and favorites
- 🔄 Daily auto-update via GitHub Actions (không cần server chạy 24/7)
- 💰 DCA recommendations cho chiến lược đầu tư dài hạn

## Supported Funds

- VFMVF1
- TCBF
- DCBC
- SSI-SCA
- VESAF

## Tech Stack

- **Frontend**: Vue 3 with Vite
- **Backend**: Node.js with Express
- **Charts**: Chart.js
- **Styling**: Modern CSS with fintech design

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Start both frontend and backend:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Data

Ứng dụng chạy ở chế độ crawler-only (không còn dữ liệu demo). Bạn cần cấu hình URL nguồn để có dữ liệu.

Crawler (tùy chọn, best-effort):

1) Tạo biến môi trường khi chạy backend (hoặc `.envrc`/process manager):
```
SCRAPE_ENABLED=true
FUND_URLS={"VESAF":"https://fmarket.vn/...","DCBC":"https://fireant.vn/..."}
# hoặc dùng registry file:
# backend/config/fund-urls.json
# ENV sẽ override file nếu trùng mã
SCRAPE_CONCURRENCY=3
```
2) Gọi thủ công cho 1 quỹ:
```
curl -X POST http://localhost:3000/api/scrape/VESAF
```
Hoặc crawl tất cả đã cấu hình:
```
curl -X POST http://localhost:3000/api/scrape-all
```
3) Cron 9:00 sẽ tự chạy scrape nếu `SCRAPE_ENABLED=true`. Không có dữ liệu demo fallback.

Lưu ý pháp lý: chỉ crawl nếu điều khoản trang cho phép, tôn trọng robots.txt, và đặt User-Agent hợp lệ.

### Tự động crawl mỗi ngày (khi app không chạy)

**Lưu ý:** Cron job trong app chỉ chạy khi server đang chạy. Để crawl tự động mỗi ngày ngay cả khi app không chạy, bạn có 2 lựa chọn:

#### Cách 1: Dùng System Cron (Linux/Mac)

1. **Setup cron job:**
   ```bash
   cd /Users/mvp/Desktop/TradeApp
   ./backend/scripts/setup-cron.sh
   ```

2. **Hoặc thủ công:**
   ```bash
   crontab -e
   # Thêm dòng này (chạy mỗi ngày lúc 9:00 AM):
   0 9 * * * cd /Users/mvp/Desktop/TradeApp && node backend/scripts/daily-crawl.js >> backend/logs/cron.log 2>&1
   ```

3. **Xem logs:**
   ```bash
   tail -f backend/logs/cron.log
   ```

#### Cách 2: Deploy lên server (VPS/Cloud)

- Deploy app lên VPS (DigitalOcean, AWS, etc.)
- Chạy app 24/7 với PM2 hoặc systemd
- Cron job trong app sẽ tự động chạy mỗi ngày

**Ví dụ với PM2:**
```bash
npm install -g pm2
cd backend
pm2 start server.js --name "nav-crawler"
pm2 save
pm2 startup  # Setup auto-start on boot
```

#### Cách 3: GitHub Actions (Khuyến nghị - Miễn phí)

**Tự động crawl mỗi ngày bằng GitHub Actions, không cần server chạy 24/7:**

1. **Đã có sẵn workflow:** `.github/workflows/daily-crawl.yml`
   - Tự động chạy mỗi ngày lúc 9:00 AM UTC (4:00 PM VN time)
   - Crawl tất cả quỹ và commit dữ liệu vào repo
   - Hoàn toàn miễn phí với GitHub Actions

2. **Kích hoạt:**
   - Push code lên GitHub (đã có sẵn)
   - Workflow sẽ tự động chạy theo schedule
   - Hoặc chạy thủ công từ tab "Actions" trên GitHub

3. **Xem kết quả:**
   - Vào tab "Actions" trên GitHub repo
   - Xem logs của workflow "Daily NAV Crawl"
   - Dữ liệu được tự động commit vào `backend/storage/nav-history.json`

**Lưu ý:**
- GitHub Actions miễn phí: 2000 phút/tháng cho private repo, unlimited cho public repo
- Mỗi lần crawl tốn ~2-5 phút → có thể crawl ~400-1000 lần/tháng
- Dữ liệu được lưu trực tiếp trong repo, không cần database

#### Cách 4: Cloud Scheduler (AWS/Google Cloud)

- Dùng AWS EventBridge hoặc Google Cloud Scheduler
- Schedule HTTP request đến endpoint `/api/crawl-all` mỗi ngày
- Cần server đang chạy để nhận request

### Development Commands

- `npm run dev` - Start both frontend and backend
- `npm run dev:frontend` - Start only frontend
- `npm run dev:backend` - Start only backend

## API Endpoints

- `GET /api/funds` - Get list of all available funds
- `GET /api/nav/:fundCode` - Get NAV history for a specific fund
- `GET /api/analytics/:fundCode` - Get analytics (RSI, moving averages, buy signals)

## Buy Signal Logic

A "Good Buy" signal is triggered when:
- NAV is below its 30-day moving average, AND
- RSI (14-day) is below 40 (oversold condition)

## Data Source

Currently uses dummy/generated data for demonstration. In production, the backend can be configured to fetch real data from:
- cafef.vn
- vietstock.vn

The cron job runs daily at 9 AM to update NAV data.

## Design

- Clean, professional fintech dashboard
- White background with green/blue highlights
- Rounded cards with subtle shadows
- Responsive design for mobile and desktop

## License

MIT

---

Designed by Maxim — for smart investors in Vietnam

