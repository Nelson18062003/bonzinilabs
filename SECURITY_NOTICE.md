# 🚨 SECURITY NOTICE - ACTION REQUIRED

## Critical Security Fix Applied

**Date**: 2026-01-30
**Issue**: Production Supabase credentials were previously committed to git

### What Happened

The `.env` file containing production API keys was committed to the repository. This has been fixed by:

1. ✅ Added `.env` to `.gitignore`
2. ✅ Created `.env.example` with placeholder values

### What You MUST Do Now

#### 1. Rotate Your Supabase Keys (URGENT)

Go to your Supabase dashboard and rotate the following:

1. Navigate to: https://app.supabase.com/project/gmglcovrppgurygaxdsb/settings/api
2. Click "Generate new anon key"
3. Update your production deployment environment variables
4. Update your local `.env` file with the new key

#### 2. Remove Credentials from Git History

The old credentials are still in git history. Remove them:

```bash
# Option 1: Using BFG Repo-Cleaner (recommended)
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Option 2: Using git filter-branch
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
git push origin --force --tags
```

#### 3. Update Team Members

Notify all developers to:
1. Pull the latest changes
2. Copy `.env.example` to `.env`
3. Add their own credentials (development or production)
4. Never commit `.env` again

#### 4. Update CI/CD

If you have automated deployments, ensure environment variables are set in:
- Vercel/Netlify dashboard (not in code)
- GitHub Actions secrets
- Docker secrets
- Or wherever your app is deployed

### Prevention

- `.env` is now in `.gitignore` and won't be committed
- Always use `.env.example` for templates
- Consider using tools like `git-secrets` to prevent credential commits

### Questions?

If you need help with any of these steps, contact your security team or Claude Code for assistance.
