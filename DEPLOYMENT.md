# Deployment Configuration

## The Problem
This app uses client-side routing. When deployed, direct links to routes like `/terms` or `/a2p-optin-proof` will return 404 errors because the server looks for those files instead of serving `index.html`.

## The Solution
Configure your hosting provider to always serve `index.html` for all routes. I've created configuration files for common hosting platforms:

---

## 📦 Hosting Platform Configs

### **Vercel**
✅ File: `vercel.json`

Deploy as usual. Vercel will automatically use this config.

```bash
npm run build
# Then deploy via Vercel dashboard or CLI
```

## 🧪 Testing
After deployment, test these URLs directly:
- `https://your-site.com/terms`
- `https://your-site.com/privacy`
- `https://your-site.com/a2p-optin-proof`

They should all load correctly (not 404).

---

## 🔧 Build Command
```bash
npm run build
```

Output directory: `build/`
