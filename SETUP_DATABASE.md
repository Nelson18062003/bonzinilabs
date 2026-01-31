# 🗄️ Database Setup Guide

## Option 1: Automatic Setup (Recommended)

### Using Supabase CLI

```bash
# 1. Install Supabase CLI globally
npm install -g supabase

# 2. Login to Supabase
npx supabase login

# 3. Link to your project (get project ID from dashboard)
npx supabase link --project-ref YOUR_PROJECT_ID

# 4. Push all migrations at once
npx supabase db push
```

This will run all 35+ migration files in the correct order automatically.

---

## Option 2: Manual Setup (If CLI doesn't work)

### Step 1: Go to SQL Editor

https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new

### Step 2: Run Migrations in Order

Copy and paste the content of each file below into the SQL editor and click "Run".

**IMPORTANT**: Run them in THIS EXACT ORDER:

1. `20251212074146_3a54d3a0-809b-41a1-898d-651cb84d6f77.sql` - Initial schema
2. `20251212074157_7119cd39-d43c-4026-b9f4-10cc852873cb.sql`
3. `20251212074205_163cc227-dda8-4e47-82c8-d7d370e0c978.sql`
4. `20251217203856_5605bc45-3b36-428d-a64c-655eb0a8ad00.sql`
5. `20251220135027_f40cce97-9b4d-4cfd-b80d-5cb6c5535024.sql`
6. `20251220152311_239aa033-9f1b-4291-976a-eddcfc40f3df.sql`
7. `20251220152906_ebc339ec-7d5b-4af8-9adb-a5b6c558bd6d.sql`
8. `20251220175131_1895eee2-c6f3-41f8-8ae2-104b45c9eb22.sql`
9. `20251220211736_81e0d5c3-a3b0-457a-a90a-4da109c20656.sql`
10. `20251220213817_89594a1e-04dd-485d-8474-db171e413f9e.sql`
11. Continue with all files in chronological order...

### Step 3: Verify Setup

After running all migrations, verify tables were created:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- admin_audit_logs
- deposit_proofs
- deposit_timeline_events
- deposits
- exchange_rates
- payment_proofs
- payment_timeline_events
- payments
- profiles
- user_roles
- wallet_operations
- wallets

---

## Option 3: One-File Setup (Easiest Manual Method)

I'll create a single SQL file with everything combined.

### Step 1: Go to SQL Editor

https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new

### Step 2: Run Complete Setup

Copy the entire content of `database_complete_setup.sql` (I'll create this next) and run it once.

---

## After Setup

### 1. Create Your First Admin User

Go to Authentication → Users → Add User

- Email: your@email.com
- Password: (your password)

Then add admin role in SQL Editor:

```sql
-- Get your user ID first
SELECT id, email FROM auth.users;

-- Add super_admin role (replace USER_ID)
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'super_admin');
```

### 2. Set Default Exchange Rate (if not set)

```sql
INSERT INTO exchange_rates (rate_xaf_to_rmb, effective_date)
VALUES (0.01167, CURRENT_DATE)
ON CONFLICT (effective_date) DO NOTHING;
```

### 3. Test Your Setup

```sql
-- Should return data
SELECT * FROM profiles;
SELECT * FROM wallets;
SELECT * FROM exchange_rates;
```

---

## Troubleshooting

### "Permission denied" errors

Make sure you're logged into your Supabase account that owns this project.

### "Already exists" errors

Some migrations might have already run. Skip to the next migration.

### "Cannot find table" errors

You skipped a migration. Go back and run all previous ones in order.

---

## Need Help?

If migrations fail, you can:

1. **Reset database** (⚠️ deletes all data):
   - Dashboard → Settings → Database → Reset Database

2. **Contact me** with the error message
