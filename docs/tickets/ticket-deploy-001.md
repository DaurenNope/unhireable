# TICKET DEPLOY-001: Production Build & Deployment Setup

**Priority:** CRITICAL  
**Estimate:** 2-3 days  
**Status:** TODO  
**Agent:** Infrastructure Agent / DevOps Agent  
**Dependencies:** None  
**Blocks:** Production release

---

## Executive Summary

Set up production build configuration, code signing, installer generation, and release pipeline. This is critical for shipping the application to users.

---

## Problem Statement

Current state:
- ✅ Development builds work
- ❌ Production builds not configured
- ❌ Code signing not set up
- ❌ Installers not generated
- ❌ Auto-update not configured
- ❌ Release pipeline not set up

**Impact:** Cannot ship production-ready application to users.

---

## Technical Context

### Tauri Build System

- **Build Command:** `tauri build`
- **Configuration:** `src-tauri/tauri.conf.json`
- **Platforms:** macOS, Windows, Linux
- **Code Signing:** Required for distribution

### Current Configuration

Check `src-tauri/tauri.conf.json` for:
- Bundle configuration
- Code signing settings
- Updater configuration

---

## Implementation Instructions

### Step 1: Configure Production Build

**File:** `src-tauri/tauri.conf.json`

**Tasks:**

1. **Set Production Mode:**
   ```json
   {
     "build": {
       "devUrl": "http://localhost:1420",
       "beforeDevCommand": "npm run dev",
       "beforeBuildCommand": "npm run build",
       "distDir": "../frontend/dist"
     }
   }
   ```

2. **Configure Bundle:**
   ```json
   {
     "bundle": {
       "active": true,
       "targets": ["app", "dmg", "msi", "appimage"],
       "identifier": "com.unhireable.jobez",
       "icon": [
         "icons/32x32.png",
         "icons/128x128.png",
         "icons/128x128@2x.png",
         "icons/icon.icns",
         "icons/icon.ico"
       ]
     }
   }
   ```

3. **Set App Metadata:**
   ```json
   {
     "package": {
       "productName": "Unhireable",
       "version": "0.1.0"
     }
   }
   ```

---

### Step 2: Set Up Code Signing (macOS)

**Requirements:**
- Apple Developer Account
- Code signing certificate
- Notarization credentials

**Tasks:**

1. **Get Code Signing Certificate:**
   - Log into Apple Developer Portal
   - Create "Developer ID Application" certificate
   - Download and install in Keychain

2. **Configure in Tauri:**
   ```json
   {
     "bundle": {
       "macOS": {
         "frameworks": [],
         "minimumSystemVersion": "10.13",
         "exceptionDomain": "",
         "signingIdentity": "Developer ID Application: Your Name"
       }
     }
   }
   ```

3. **Set Environment Variables:**
   ```bash
   export APPLE_CERTIFICATE="Developer ID Application: Your Name"
   export APPLE_CERTIFICATE_PASSWORD="your-password"
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
   ```

4. **Add Notarization:**
   ```json
   {
     "bundle": {
       "macOS": {
         "notarize": {
           "teamId": "YOUR_TEAM_ID"
         }
       }
     }
   }
   ```

---

### Step 3: Set Up Code Signing (Windows)

**Requirements:**
- Code signing certificate (from certificate authority)
- Or use self-signed for testing

**Tasks:**

1. **Get Code Signing Certificate:**
   - Purchase from certificate authority (DigiCert, Sectigo, etc.)
   - Or create self-signed for testing

2. **Configure in Tauri:**
   ```json
   {
     "bundle": {
       "windows": {
         "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
         "digestAlgorithm": "sha256",
         "timestampUrl": "http://timestamp.digicert.com"
       }
     }
   }
   ```

3. **Set Environment Variables:**
   ```bash
   export WINDOWS_CERTIFICATE_PATH="path/to/certificate.pfx"
   export WINDOWS_CERTIFICATE_PASSWORD="your-password"
   ```

---

### Step 4: Configure Auto-Updater

**File:** `src-tauri/tauri.conf.json`

**Tasks:**

1. **Enable Updater:**
   ```json
   {
     "updater": {
       "active": true,
       "endpoints": [
         "https://releases.unhireable.com/{{target}}/{{current_version}}"
       ],
       "dialog": true,
       "pubkey": "YOUR_PUBLIC_KEY"
     }
   }
   ```

2. **Generate Key Pair:**
   ```bash
   cd src-tauri
   cargo install tauri-signer
   tauri-signer generate -w ~/.tauri/myapp.key
   ```

3. **Add Updater Plugin:**
   ```toml
   # Cargo.toml
   [dependencies]
   tauri-plugin-updater = "2.0"
   ```

4. **Initialize in Code:**
   ```rust
   // src-tauri/src/main.rs
   .plugin(tauri_plugin_updater::Builder::new().build())
   ```

---

### Step 5: Create Release Pipeline

**File:** `.github/workflows/release.yml` (or similar)

**Tasks:**

1. **Create GitHub Actions Workflow:**
   ```yaml
   name: Release
   
   on:
     push:
       tags:
         - 'v*'
   
   jobs:
     build:
       runs-on: ${{ matrix.os }}
       strategy:
         matrix:
           os: [macos-latest, windows-latest, ubuntu-latest]
       
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - uses: tauri-apps/tauri-action@v0
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
             APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
             APPLE_ID: ${{ secrets.APPLE_ID }}
             APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
           with:
             projectPath: .
             tagName: ${{ github.ref_name }}
             releaseName: 'Unhireable v__VERSION__'
             releaseBody: 'See the assets to download this version and install.'
             releaseDraft: true
             prerelease: false
   ```

2. **Set Up Secrets:**
   - Go to GitHub repository settings
   - Add secrets for code signing credentials
   - Add secrets for release tokens

---

### Step 6: Version Management

**File:** `src-tauri/Cargo.toml` and `frontend/package.json`

**Tasks:**

1. **Sync Versions:**
   - Keep versions in sync across:
     - `src-tauri/Cargo.toml` (version field)
     - `frontend/package.json` (version field)
     - `src-tauri/tauri.conf.json` (package.version)

2. **Create Version Script:**
   ```bash
   # scripts/version.sh
   VERSION=$1
   sed -i '' "s/version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
   sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json
   sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
   ```

3. **Use Semantic Versioning:**
   - MAJOR.MINOR.PATCH (e.g., 1.0.0)
   - Increment based on changes

---

### Step 7: Test Production Builds

**Tasks:**

1. **Test macOS Build:**
   ```bash
   npm run tauri build -- --target universal-apple-darwin
   ```

2. **Test Windows Build:**
   ```bash
   npm run tauri build -- --target x86_64-pc-windows-msvc
   ```

3. **Test Linux Build:**
   ```bash
   npm run tauri build -- --target x86_64-unknown-linux-gnu
   ```

4. **Verify Installers:**
   - Test DMG on macOS
   - Test MSI on Windows
   - Test AppImage on Linux
   - Verify code signing
   - Test installation process

---

## Testing Instructions

### Manual Testing

1. **Build Test:**
   - Run production build
   - Verify no errors
   - Check bundle size
   - Verify all assets included

2. **Installation Test:**
   - Install on clean system
   - Verify app launches
   - Check permissions
   - Test auto-update

3. **Code Signing Test:**
   - Verify signature on macOS (Gatekeeper)
   - Verify signature on Windows (Properties)
   - Test notarization (macOS)

### Automated Testing

Add to CI/CD:
- Build on all platforms
- Verify signatures
- Test installers
- Check bundle contents

---

## Acceptance Criteria

- [ ] Production builds work on all platforms
- [ ] Code signing configured and working
- [ ] Installers generated (DMG, MSI, AppImage)
- [ ] Auto-updater configured
- [ ] Release pipeline set up
- [ ] Version management working
- [ ] Builds pass on CI/CD
- [ ] Installers tested and working
- [ ] Code signing verified
- [ ] Auto-update tested

---

## Code Quality Checklist

- [ ] Build configuration is correct
- [ ] Code signing credentials secured
- [ ] Version numbers synced
- [ ] Release notes template created
- [ ] CI/CD pipeline tested
- [ ] Build artifacts verified
- [ ] Installer sizes reasonable
- [ ] No hardcoded secrets

---

## Security Considerations

- **Never commit signing certificates**
- Use GitHub Secrets for credentials
- Rotate certificates regularly
- Secure certificate storage
- Use app-specific passwords (Apple)

---

## Related Files

- `src-tauri/tauri.conf.json` - Tauri configuration
- `src-tauri/Cargo.toml` - Rust package version
- `frontend/package.json` - Frontend package version
- `.github/workflows/release.yml` - Release pipeline

---

## Notes

- Code signing is required for distribution
- Notarization required for macOS (Gatekeeper)
- Auto-updater requires server infrastructure
- Test builds on clean systems
- Keep versions in sync
- Document release process






