---
description: How to deploy updates to the Kids Tasks Tracker app
---

# Deploy Kids Tasks Tracker

// turbo-all

## Steps

1. Make sure all code changes are complete and tested

2. **IMPORTANT: Increment the version number** in `index.html` line 33:
   - Find: `<span class="app-version">vX.XX</span>`
   - Increment by 0.01 (e.g., v0.33 → v0.34)

3. Stage all changes:
   ```
   git add -A
   ```

4. Commit with descriptive message:
   ```
   git commit -m "Your descriptive message here"
   ```

5. Push to GitHub:
   ```
   git push origin main
   ```

## Version History
- Current: v0.65
- Always increment by 0.01 for each push

## Important Notes
- **NEVER forget to increment version** before pushing
- Version is displayed in the app header
- Version helps with cache busting and tracking releases
