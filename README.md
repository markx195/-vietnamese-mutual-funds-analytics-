# Vietnamese Mutual Funds Analytics

A clean and modern financial analytics website for Vietnamese mutual funds (chứng chỉ quỹ) that helps investors identify good buying opportunities.

## Features

- 📊 Display daily NAV (Net Asset Value) for major Vietnamese mutual funds
- 📈 Interactive charts with 7-day and 30-day moving averages
- 🎯 Automatic buy signal detection (NAV below 30-day MA + RSI < 40)
- 📱 Responsive dashboard with fund selector
- 🔄 Daily auto-update system (simulated with cron job)

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

