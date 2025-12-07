<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Story Maker v2

AI-powered story and image creation tool using Google Gemini API.

View your app in AI Studio: https://ai.studio/apps/drive/1mCLVuTdLOOzzyVQ6n1lurIIhlicfFCPE

## 🚀 Quick Start

### Option 1: GitHub Codespaces (Recommended for GitHub)

1. **Open in Codespaces:**
   - Go to your repository: https://github.com/im-ai-mento/story-maker-v2
   - Click the green **"Code"** button
   - Select **"Codespaces"** tab
   - Click **"Create codespace on main"**
   - Wait for the environment to set up (about 1-2 minutes)

2. **In the Codespace terminal, run:**
   ```bash
   npm install
   npm run dev
   ```

3. **Access the app:**
   - Codespaces will automatically show a popup with the URL
   - Or click the "Ports" tab and open the forwarded port (usually 3000)
   - The app will be available at `https://[your-codespace].github.dev`

### Option 2: Run Locally

**Prerequisites:** Node.js 18+ installed

1. **Clone the repository:**
   ```bash
   git clone https://github.com/im-ai-mento/story-maker-v2.git
   cd story-maker-v2
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up API Key (Optional):**
   - Create a `.env.local` file in the root directory
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```
   - Or enter it directly in the app (click the key icon in the top right)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   - Navigate to `http://localhost:3000`

## 📝 Getting Your API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key and paste it in the app or `.env.local` file

## 🌐 Web Deployment

### GitHub Pages (자동 배포)

이 저장소는 GitHub Actions를 통해 자동으로 GitHub Pages에 배포됩니다.

1. **자동 배포:**
   - `main` 브랜치에 푸시하면 자동으로 빌드 및 배포됩니다
   - Actions 탭에서 배포 상태를 확인할 수 있습니다

2. **배포 활성화:**
   - 저장소 Settings → Pages로 이동
   - Source를 "GitHub Actions"로 설정
   - 배포가 완료되면 다음 URL에서 접속 가능:
     ```
     https://im-ai-mento.github.io/story-maker-v2/
     ```

3. **수동 배포:**
   - Actions 탭 → "Deploy to GitHub Pages" 워크플로우 선택
   - "Run workflow" 버튼 클릭

### 다른 호스팅 서비스

**Vercel:**
```bash
npm install -g vercel
vercel
```

**Netlify:**
- Netlify에 저장소 연결
- Build command: `npm run build`
- Publish directory: `dist`

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📦 Features

- ✨ AI Image Generation & Editing
- 🎨 Infinite Canvas with Layers
- 🖼️ Image Inpainting & Outpainting
- 📝 Text Objects
- 🎬 Video Generation (Veo)
- 👤 Character Management
- 💾 Project Save/Load (.story files)

## 🔧 Tech Stack

- React 18 + TypeScript
- Vite
- Google Gemini API
- Tailwind CSS

## 📄 License

This project is private.
