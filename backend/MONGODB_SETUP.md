# MongoDB Atlas Setup Guide

## Current Issue
❌ **Error:** `Could not connect to any servers in your MongoDB Atlas cluster`

Your IP address is not whitelisted in the MongoDB Atlas cluster.

---

## Quick Fix (5 minutes)

### 1. Identify Your IP Address
Run this command to auto-detect and verify your IP:
```bash
npm run diagnose
```

Or visit: https://whatismyipaddress.com/

### 2. Whitelist Your IP in Atlas

1. Go to: https://cloud.mongodb.com/
2. Log in with your MongoDB account
3. Select **Cluster0** 
4. Click **Network Access** in the left sidebar
5. Click **Add IP Address**
6. Either:
   - **Paste your detected IP** with `/32` suffix
   - Or click **Add Current IP Address** (if available)
7. Click **Confirm**

### 3. Wait & Restart
- Wait **1-2 minutes** for the whitelist to update
- Restart your backend server:
```bash
npm run dev
```

You should now see:
```
✅ MongoDB Connected Successfully (Atlas)
```

---

## What You Should See After Fix

```
🔗 Connecting to MongoDB Atlas (Attempt 1/4)...
✅ MongoDB Connected Successfully (Atlas)
🚀 Server running on port 3001
```

---

## Troubleshooting

### Connection still fails after whitelisting?

1. **Check your .env file** has correct MONGO_URI:
   ```
   MONGO_URI=mongodb://binukaboss_db_user:h56qGdtkWfRJOqv1@...
   ```

2. **Verify cluster status**:
   - Go to https://cloud.mongodb.com/
   - Cluster0 should show "ACTIVE" status
   - If paused, click "Resume"

3. **Run diagnostic**:
   ```bash
   npm run diagnose
   ```

4. **Check IP whitelist** was saved:
   - Network Access → IP Whitelist
   - Your IP should be there with status "Active"

### For Development/Testing Only

If you need immediate access (⚠️ **NOT for production**):
- In MongoDB Atlas Network Access
- Click **Edit** on your IP entry
- Change it to `0.0.0.0/0` (allows ALL IPs)
- This is less secure but useful for local development

---

## Environment Variables

Make sure `backend/.env` exists and contains:

```env
PORT=3001
MONGO_URI=mongodb://binukaboss_db_user:h56qGdtkWfRJOqv1@ac-qkcawtf-shard-00-00.vzdlrkq.mongodb.net:27017,ac-qkcawtf-shard-00-01.vzdlrkq.mongodb.net:27017,ac-qkcawtf-shard-00-02.vzdlrkq.mongodb.net:27017/?ssl=true&replicaSet=atlas-vs3aug-shard-0&authSource=admin&appName=Cluster0
JWT_SECRET=supersecretkey
ML_SERVICE_URL=http://localhost:5000
```

---

## Still having issues?

Visit MongoDB's official guide:
https://www.mongodb.com/docs/atlas/security-whitelist/
