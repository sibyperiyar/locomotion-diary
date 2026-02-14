# Deployment Guide 🚀

This guide explains how to distribute your Locomotion Diary on your own server (`zetozone.com`) and GitHub.

## Option A: Hosting on Zetozone (Recommended)

This gives you full control and allows the "Check for Updates" button to work perfectly.

### 1. Prepare your Server

You need to create a folder on your website for the diary.

1. Log in to your server (Control Panel / FTP).
2. Navigate to `public_html` (or your main web folder).
3. Create a new folder named `locomotion-diary`.
    - Final URL will be: `https://www.zetozone.com/locomotion-diary/`

### 2. Upload Files (Selective)

Copy **ONLY** the necessary application files.

**✅ UPLOAD THESE:**

- `index.html`
- `js/` (Entire Folder)
- `css/` (Entire Folder - if you have one)
- `version.json`
- `binder_template.js` (If you customized it)

**❌ DO NOT UPLOAD (Security Risk):**

- `backups/` (Contains your private data!)
- `*.md` files (This guide, Readme, etc.)
- `.git/` folder
- `USER_MANUAL.html` (Optional: Upload if you want users to read it, otherwise keep local)

### 3. Verify

Open `https://www.zetozone.com/locomotion-diary/` in your browser.

- Try enrolling Biometrics (it should work now because of HTTPS!).

---

## Option B: Hosting on GitHub

### 1. Create Repository

1. Go to [GitHub.com](https://github.com) and create a new repository called `locomotion-diary`.
2. Make sure it is **Public** (or Private if you have Pro, but Pages is easier with Public).

### 2. Push Code

(If you are using the Desktop App or Command Line)

```bash
git init
git add .
git commit -m "Initial Release v1.1.0"
git remote add origin https://github.com/YOUR_USERNAME/locomotion-diary.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to Repository **Settings** > **Pages**.
2. Under "Branch", select `main` and `/root`.
3. Click **Save**.
4. Your site will be live at `https://YOUR_USERNAME.github.io/locomotion-diary/`.

---

## How to Release Updates 🔄

When you make changes and want to send an update to your users:

1. **Update Version Number**:
    - Open `js/version.js` and increase the number (e.g., `1.1.0` -> `1.2.0`).

2. **Create ZIP**:
    - Zip your entire project folder.
    - Name it `locomotion-diary-v1.2.0.zip`.
    - Upload this ZIP to your server folder.

3. **Update Manifest**:
    - Open `version.json`.
    - Update `"version": "1.2.0"`.
    - Update `"notes": "Fixed bugs..."`.
    - Update `"downloadUrl": "https://www.zetozone.com/locomotion-diary/locomotion-diary-v1.2.0.zip"`.
    - Upload `version.json` to your server.

4. **Done!**
    - Users clicking "Check for Updates" will now see the new version popup!
