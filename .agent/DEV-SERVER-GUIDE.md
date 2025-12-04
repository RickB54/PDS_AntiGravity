# 🔧 Dev Server Restart Guide

## ✅ Errors Fixed!

All TypeScript compilation errors have been resolved:
1. ✅ Removed duplicate `handlePay` function
2. ✅ Fixed type error in `upsertExpense` call

---

## 🚀 How to Stop the Dev Server

### Option 1: Using PowerShell Command History
```powershell
# Press Ctrl+C in the terminal where npm run dev is running
# Or find the process and kill it:
Get-Process -Name node | Stop-Process -Force
```

### Option 2: Using Task Manager
1. Press `Ctrl + Shift + Esc`
2. Find "Node.js JavaScript Runtime"
3. Right-click → End Task

### Option 3: Kill Specific Port (if on port 5173)

```powershell
# Find process on port 5173
netstat -ano | findstr :5173

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F
```

---

## 🚀 How to Start the Dev Server

```powershell
# Navigate to your project directory
cd c:\Users\rberu\PDSv4_Antigravity\PDS

# Start the dev server
npm run dev
```

**Expected Output:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## 🌐 Accessing Your App

1. **Default Vite Port**: `http://localhost:5173`
2. **Port 6063**: If you have a separate backend on 6063, that's different
   - Frontend (React/Vite): Port 5173
   - Backend API (if any): Port 6063

**Open in Chrome**: `http://localhost:5173`

---

## ❌ If Dev Server Won't Start

### Check for Port Conflicts:
```powershell
# Check what's using port 5173
netstat -ano | findstr :5173
```

### Clear Node Cache:
```powershell
# Remove node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
npm run dev
```

### Check for Errors:
```powershell
# Run with full error output
npm run dev --verbose
```

---

## 📱 Quick Commands Cheat Sheet

| Action | Command |
|--------|---------|
| Start Server | `npm run dev` |
| Stop Server | `Ctrl + C` (in terminal) |
| Kill All Node | `Get-Process -Name node \| Stop-Process -Force` |
| Check Port 5173 | `netstat -ano \| findstr :5173` |
| Clear Cache | `Remove-Item -Recurse -Force node_modules` |
| Fresh Install | `npm install` |

---

## 🔍 Troubleshooting

### "Port already in use" Error:
```powershell
# Kill process on port 5173
$processId = (Get-NetTCPConnection -LocalPort 5173).OwningProcess
Stop-Process -Id $processId -Force
```

### "Module not found" Error:
```powershell
npm install
```

### TypeScript Errors:
- Check the IDE problems panel
- All current errors are fixed!
- If new ones appear, let me know

---

## ✅ Current Status

- ✅ TypeScript compilation errors: **FIXED**
- ✅ Code ready to run
- ⏳ Dev server: **Need to restart**

Once you start the dev server, your app should be available at:
**`http://localhost:5173`**
