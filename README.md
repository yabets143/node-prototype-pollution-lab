# Prototype Pollution -> EJS SSTI -> RCE (Demo)

This demo shows a vulnerable chain in Node.js using Express, lodash, and EJS.

- Vulnerable endpoint: `/update-profile` merges arbitrary JSON into an in-memory user and also pollutes `Object.prototype`.
- Admin route: `/admin` renders `views/admin.ejs` which executes `user.bio` as an EJS template string, enabling command execution.
- Patch: `app.patched.js` sanitizes input, requires own `user.isAdmin`, and renders a safe template `admin_patched.ejs`.

## Run (vulnerable)
```powershell
npm install
npm start
```

## Exploit
```powershell
node .\exploit.js http://localhost:3000
```

## Run (patched)
```powershell
node .\app.patched.js
```

Re-run the exploit; it should fail to gain admin and will not execute the template payload.
