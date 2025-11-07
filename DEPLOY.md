# Hướng dẫn Deploy

## Frontend (Vercel) + Backend (Railway/Render)

### 1. Deploy Frontend lên Vercel

**Cách 1: Deploy qua GitHub (Khuyến nghị)**

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com), đăng nhập với GitHub
3. Click "Add New Project"
4. Import repo của bạn
5. Cấu hình:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` (hoặc để trống nếu deploy từ root)
   - **Build Command:** `npm run build` (hoặc `cd frontend && npm run build`)
   - **Output Directory:** `dist` (hoặc `frontend/dist`)
   - **Install Command:** `npm install` (hoặc `cd frontend && npm install`)
6. **Quan trọng:** Thêm Environment Variable:
   - `VITE_API_URL` = URL backend của bạn (sẽ có sau khi deploy backend)
   - Ví dụ: `https://your-backend.railway.app` hoặc `https://your-backend.onrender.com`

**Cách 2: Deploy qua Vercel CLI**

```bash
npm install -g vercel
cd frontend
vercel
```

### 2. Deploy Backend lên Railway (Miễn phí)

Railway cho phép deploy Node.js app miễn phí với 500 giờ/tháng.

1. Vào [railway.app](https://railway.app), đăng nhập với GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Chọn repo và branch
4. Railway tự động detect Node.js
5. Cấu hình:
   - **Root Directory:** `backend`
   - **Start Command:** `node server.js`
   - **Port:** Railway tự động set PORT env variable
6. Thêm Environment Variables (nếu cần):
   - `CRAWL_CONCURRENCY=3`
   - `SCRAPE_ENABLED=true`
7. Railway sẽ cung cấp URL: `https://your-app.railway.app`
8. Copy URL này và thêm vào Vercel env variable `VITE_API_URL`

### 3. Deploy Backend lên Render (Alternative)

1. Vào [render.com](https://render.com), đăng nhập
2. Click "New" → "Web Service"
3. Connect GitHub repo
4. Cấu hình:
   - **Name:** nav-crawler-backend
   - **Environment:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && node server.js`
   - **Root Directory:** `backend`
5. Render sẽ cung cấp URL: `https://your-app.onrender.com`

### 4. Cập nhật Frontend API URL

Sau khi có backend URL, cập nhật trong Vercel:

1. Vào Vercel Dashboard → Project → Settings → Environment Variables
2. Thêm/Update:
   - `VITE_API_URL` = `https://your-backend.railway.app`
3. Redeploy frontend

### 5. CORS Configuration

Backend đã có CORS enabled, nhưng nếu gặp lỗi, thêm vào `backend/server.js`:

```javascript
app.use(cors({
  origin: ['https://your-frontend.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

## Alternative: Deploy Full-stack lên một nơi

### Option 1: VPS (DigitalOcean, Linode, etc.)

1. Deploy cả frontend và backend lên cùng VPS
2. Dùng Nginx làm reverse proxy
3. Frontend serve static files từ Nginx
4. Backend chạy với PM2

### Option 2: Fly.io

Fly.io hỗ trợ deploy cả frontend và backend:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy backend
cd backend
fly launch
fly deploy

# Deploy frontend
cd ../frontend
fly launch
fly deploy
```

## Troubleshooting

### Lỗi 404 trên Vercel

- Kiểm tra `vercel.json` có đúng không
- Đảm bảo `outputDirectory` trỏ đến `frontend/dist`
- Kiểm tra build command có chạy thành công không

### CORS Error

- Thêm frontend URL vào CORS whitelist trong backend
- Kiểm tra `VITE_API_URL` có đúng không

### Backend không chạy

- Kiểm tra logs trên Railway/Render
- Đảm bảo PORT được set đúng
- Kiểm tra dependencies đã install chưa

