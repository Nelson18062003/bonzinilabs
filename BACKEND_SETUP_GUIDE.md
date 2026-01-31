# 🎯 Complete Backend Setup Guide

## 🚨 Current Situation

Your app has **NO BACKEND** right now. You need to choose one of these options:

---

## 📊 Backend Options Comparison

| Option | Cost | Setup Time | Difficulty | Recommendation |
|--------|------|------------|------------|----------------|
| **Supabase Free** | $0/month | 30 min | ⭐ Easy | ✅ **BEST** for you |
| **Supabase Pro** | $25/month | 30 min | ⭐ Easy | Only if you need >500MB |
| **PocketBase** | $5-10/month (hosting) | 2-3 hours | ⭐⭐ Medium | Good alternative |
| **Firebase** | $0/month (free tier) | 1-2 days | ⭐⭐⭐ Hard | Requires code rewrite |
| **Custom Backend** | $5-20/month | 1-2 weeks | ⭐⭐⭐⭐ Very Hard | Not recommended |

---

## ✅ RECOMMENDED: Supabase Free Tier

### Why Supabase Free is Perfect for You

**Your code is already built for Supabase!** You just need to create your own project.

**Supabase Free Tier Limits:**
- ✅ 500 MB database (enough for 10,000+ users)
- ✅ 1 GB file storage (enough for 1,000+ proof images)
- ✅ 50,000 monthly active users
- ✅ Unlimited API requests
- ✅ 2 GB bandwidth/month
- ✅ Social OAuth
- ✅ Row Level Security
- ✅ Real-time subscriptions

**Cost**: **$0/month FOREVER**

**When to upgrade to Pro ($25/month)**:
- When you have >10,000 users
- When you have >1GB of proof images
- When you need >500MB database

**For a startup**: Free tier is MORE than enough! 🎉

---

## 🚀 STEP-BY-STEP: Set Up FREE Supabase

### Step 1: Create Account (2 minutes)

1. Go to: https://supabase.com/dashboard/sign-up
2. Sign up with **Email** or **GitHub**
3. Verify your email
4. You're in!

### Step 2: Create Project (3 minutes)

1. Click **"New Project"**
2. Fill in:
   - **Organization**: Create new → "Bonzini Labs"
   - **Project Name**: `bonzinilabs`
   - **Database Password**: Create STRONG password
     ```
     Example: BnZ!2026$SecurePass#789
     ```
     ⚠️ **SAVE THIS PASSWORD** - you'll need it!
   - **Region**: Choose closest to users
     - 🇪🇺 Europe → **Frankfurt** or **Paris**
     - 🌍 Africa → **Frankfurt** (closest)
     - 🇨🇳 China users → **Singapore**

3. Click **"Create new project"**
4. ⏳ Wait 2-3 minutes (grab coffee ☕)

### Step 3: Get Your Credentials (1 minute)

Once project is ready (green checkmark):

1. Click **Settings** (gear icon) → **API**
2. You'll see:
   ```
   Project URL: https://abcd1234.supabase.co
   anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
   ```

3. **Copy these values** - you need them next!

### Step 4: Update Your .env File (1 minute)

Open `.env` in your project and update:

```env
# OLD (doesn't work)
VITE_SUPABASE_PROJECT_ID="gmglcovrppgurygaxdsb"
VITE_SUPABASE_URL="https://gmglcovrppgurygaxdsb.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGc..."

# NEW (your actual credentials)
VITE_SUPABASE_PROJECT_ID="abcd1234"  # ← Your project ID
VITE_SUPABASE_URL="https://abcd1234.supabase.co"  # ← Your URL
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # ← Your key
```

### Step 5: Install Dependencies (2 minutes)

```bash
npm install
```

### Step 6: Set Up Database Tables (20 minutes)

You need to create all the database tables. **Two methods**:

#### **Method A: Automatic (Easiest)** ✅

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
npx supabase login
# Browser opens → Login with same account

# 3. Link your project
npx supabase link --project-ref abcd1234  # ← Use YOUR project ID

# 4. Push ALL migrations at once (creates all tables)
npx supabase db push
```

✅ **Done!** All 35+ migrations will run automatically.

#### **Method B: Manual (If CLI fails)**

1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new

2. Open each migration file in `supabase/migrations/` folder

3. Copy content → Paste in SQL Editor → Click "Run"

4. Repeat for all 35 files **in order** (sorted by date in filename)

**Files to run** (in this order):
```
supabase/migrations/
├── 20251212074146_*.sql  ← Run FIRST (creates initial tables)
├── 20251212074157_*.sql
├── 20251212074205_*.sql
├── ... (run all in order)
├── 20260130000000_*.sql  ← Wallet race condition fix
└── 20260130000001_*.sql  ← Rate limiting (run LAST)
```

See [SETUP_DATABASE.md](SETUP_DATABASE.md) for detailed instructions.

### Step 7: Create Storage Buckets (5 minutes)

1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/storage/buckets

2. Click **"New bucket"**

3. Create these 3 buckets:

**Bucket 1: deposit-proofs**
- Name: `deposit-proofs`
- Public: ❌ **No** (keep private)
- Click "Create bucket"

**Bucket 2: payment-proofs**
- Name: `payment-proofs`
- Public: ❌ **No**
- Click "Create bucket"

**Bucket 3: cash-signatures**
- Name: `cash-signatures`
- Public: ❌ **No**
- Click "Create bucket"

### Step 8: Create Your First Admin User (3 minutes)

1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/auth/users

2. Click **"Add user"** → **"Create new user"**

3. Fill in:
   - Email: `your@email.com`
   - Password: (your admin password)
   - Click "Create user"

4. Go to **SQL Editor** and run:

```sql
-- Get your user ID
SELECT id, email FROM auth.users;

-- Copy the ID, then run (replace YOUR_USER_ID):
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'super_admin');
```

✅ **You now have admin access!**

### Step 9: Test Your App (2 minutes)

```bash
# Start development server
npm run dev
```

Open: http://localhost:8080

1. Go to `/admin/login`
2. Login with your admin email/password
3. ✅ **You should see the admin dashboard!**

---

## 🎉 You're Done!

Your app now has a **FREE Supabase backend** with:
- ✅ PostgreSQL database
- ✅ User authentication
- ✅ File storage
- ✅ Admin panel access
- ✅ Row level security

**Cost**: $0/month (free forever for your traffic level)

---

## 📊 When to Upgrade to Supabase Pro

You'll know when you need Pro if you see:

**Dashboard shows warnings**:
- "Database storage >80% used" (approaching 500MB)
- "File storage >80% used" (approaching 1GB)

**Your usage**:
- \>10,000 active users
- \>500MB database data
- \>1GB proof images

**When that happens**: Upgrade to Pro ($25/month) in one click.

**For now**: FREE tier is perfect! 🎊

---

## 🔄 Alternative: PocketBase (If You Want Full Control)

**Only consider this if**:
- You want to avoid vendor lock-in
- You prefer self-hosting
- You have technical skills

**PocketBase Setup**:

### 1. What is PocketBase?

- Open-source Supabase alternative
- Single executable file
- Built-in admin UI
- SQLite database
- Real-time subscriptions
- File uploads

**Cost**: $0 (software is free) + hosting ($5-10/month for VPS)

### 2. How to Set Up

**Requirements**:
- VPS (DigitalOcean, Hetzner, etc.) - $5-10/month
- Basic Linux knowledge

**Steps**:
1. Download PocketBase: https://pocketbase.io/docs/
2. Upload to your VPS
3. Run: `./pocketbase serve`
4. Access admin UI: http://your-ip:8090/_/

**Migration Required**:
- ⚠️ **2-3 days of work** to migrate from Supabase to PocketBase
- Need to rewrite all API calls
- Need to recreate database schema
- Need to rewrite auth logic

**Verdict**: **Not worth it** for you right now. Stick with Supabase Free.

---

## 🔄 Alternative: Firebase (Google)

**Only if**: You want Google infrastructure

**Cons**:
- NoSQL database (different from current SQL)
- Requires **complete rewrite** of your app
- **1-2 weeks of work**

**Verdict**: **Not recommended** - too much work to migrate.

---

## ✅ Final Recommendation

**Use Supabase Free Tier** because:

1. ✅ **Your code already works** with it (no changes needed)
2. ✅ **Completely free** for your scale
3. ✅ **30 minutes setup** (not weeks)
4. ✅ **Professional infrastructure** (reliable)
5. ✅ **Easy to upgrade** later if needed

**Total cost**: **$0/month**

**Setup time**: **30 minutes** (not 2 weeks)

---

## 🆘 Need Help?

**Issue**: "I can't install Supabase CLI"
**Solution**: Use Method B (manual SQL paste) - works 100%

**Issue**: "Migrations fail"
**Solution**: Send me the error message

**Issue**: "Still confused"
**Solution**: Follow this checklist:

### Quick Checklist

- [ ] Created Supabase account
- [ ] Created new project
- [ ] Copied credentials to `.env`
- [ ] Ran `npm install`
- [ ] Pushed migrations (CLI or manual)
- [ ] Created storage buckets
- [ ] Created admin user
- [ ] Added super_admin role
- [ ] Tested login at `/admin/login`

---

**Bottom line**: You DON'T need to pay for Supabase. The free tier is perfect for your app! Just create your own project and you're good to go. 🚀
