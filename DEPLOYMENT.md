# 🚀 Deployment Guide: AI Study Companion

This project is configured for one-click deployment to **Render**, **Railway**, or any **Docker** host with automated database syncing and persistent storage.

---

## 🌟 Option 1: Deploy to Render (Recommended - Free Tier Available)

### Step 1: Push your code to GitHub
If you haven't pushed this folder to a GitHub repository yet:
```bash
git init
git add .
git commit -m "Deploy AI Study Companion with Flashcards"
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git branch -M main
git push -u origin main
```

### Step 2: Create Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** → **Web Service**.
3. Select your GitHub repository.
4. Configure the service settings:
   - **Name:** `ai-study-companion`
   - **Region:** Choose the region closest to you (e.g., Oregon, Frankfurt).
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm run start:prod`
5. **Environment Variables**:
   Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API key (if blank, uses the offline intelligent tutor provider).
6. Click **Create Web Service**. Render will automatically build the app and deploy your live URL!

*(Alternative)*: Render Blueprints:
You can also click **New +** → **Blueprint** and Render will automatically parse [`render.yaml`](./render.yaml).

---

## 🚂 Option 2: Deploy to Railway

### Step 1: Push code to GitHub (as above)

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app/) and log in.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `ai-study-companion` repository.
4. Railway will automatically detect [`railway.json`](./railway.json) and start the build:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
5. *(Optional)* Add a Persistent Volume:
   - In your Railway service canvas, click **Add Volume**.
   - Mount path: `/app/prisma` (keeps your SQLite database permanently across deployments).
6. In **Settings** → **Networking**, click **Generate Domain** to receive your public HTTPS URL.

---

## 🐳 Option 3: Deploy with Docker / Docker Compose

A production multi-stage [`Dockerfile`](./Dockerfile) and [`docker-compose.yml`](./docker-compose.yml) are pre-configured.

### Run locally or on any VPS:
```bash
# Build and launch the container in the background
docker compose up --build -d

# Check running container logs
docker compose logs -f
```
Your app will be live at `http://localhost:3000` (or `http://YOUR_SERVER_IP:3000`).

---

## 💻 Option 4: Run Production Server Locally

To test the production build on your machine right now:
```bash
# 1. Generate Prisma Client and build optimized production bundle
npm run build

# 2. Push database schema & start production server
npm run start:prod
```
The production server will listen on `http://localhost:3000`.
