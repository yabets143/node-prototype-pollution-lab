// app.js
// Node + Express + lodash.merge + EJS demo app for parameter pollution labs
// Includes: auth/session handling, profile update, messaging, file upload

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const _ = require('lodash');
const path = require('path');
const ejs = require('ejs');

const app = express();

// Parsers for JSON and form bodies
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Static files (serve uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sessions (in-memory for demo purposes only)
app.use(
  session({
    secret: 'lab-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// In-memory stores (DO NOT use in production)
const users = new Map(); // username -> { username, password, bio }
const messages = []; // { from, text, at }

// Global user object to support the original lab chain (admin bypass via pollution)
let user = { username: 'guest', bio: '' };

// Multer upload destination
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Expose current user to templates
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// Home page
app.get('/', (req, res) => {
  res.render('home');
});

// Auth: Register
app.get('/auth/register', (req, res) => {
  res.render('register');
});

app.post('/auth/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).render('register', { error: 'Username and password required' });
  }
  if (users.has(username)) {
    return res.status(400).render('register', { error: 'Username already exists' });
  }
  users.set(username, { username, password, bio: '' });
  res.redirect('/auth/login');
});

// Auth: Login
app.get('/auth/login', (req, res) => {
  res.render('login');
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = users.get(username);
  if (!u || u.password !== password) {
    return res.status(401).render('login', { error: 'Invalid credentials' });
  }
  req.session.user = { username: u.username };
  res.redirect('/dashboard');
});

// Auth: Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Require login middleware
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

// Dashboard (profile page)
app.get('/dashboard', requireLogin, (req, res) => {
  const u = users.get(req.session.user.username);
  res.render('dashboard', { profile: u, labUser: user });
});

// Vulnerable endpoint (kept for lab): prototype pollution via lodash.merge into a fresh object
// Accepts JSON body. The dashboard form can also target this route (urlencoded) for demo purposes.
app.post('/update-profile', (req, res) => {
  const data = req.body;
  // VULNERABILITY: Using lodash.merge with attacker-controlled input on a fresh object
  // allows __proto__ / constructor.prototype pollution.
  _.merge({}, data);

  // Ensure lab reliability: explicitly apply supplied prototype keys to Object.prototype
  // so the chain works even if lodash version mitigates it.
  try {
    if (data && typeof data === 'object') {
      if (Object.prototype.hasOwnProperty.call(data, '__proto__')) {
        const val = data['__proto__'];
        if (val && typeof val === 'object') Object.assign(Object.prototype, val);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'constructor')) {
        const ctor = data['constructor'];
        if (ctor && typeof ctor === 'object' && typeof ctor.prototype === 'object') {
          Object.assign(Object.prototype, ctor.prototype);
        }
      }
    }
  } catch (e) {
    // ignore for lab
  }

  // For the lab UX: update the global user demo object with safe, owned fields
  if (typeof data === 'object' && data !== null) {
    if (Object.prototype.hasOwnProperty.call(data, 'bio')) {
      user.bio = data.bio;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'username')) {
      user.username = data.username;
    }
  }

  // Also update the logged-in user's profile, if any (no pollution here; simple assignment)
  if (req.session.user && typeof data === 'object' && data !== null) {
    const u = users.get(req.session.user.username);
    if (u) {
      if (Object.prototype.hasOwnProperty.call(data, 'bio')) u.bio = data.bio;
      if (Object.prototype.hasOwnProperty.call(data, 'username')) {
        // allow rename for demo; update key in map
        const newUsername = String(data.username || '').trim() || u.username;
        if (newUsername !== u.username && !users.has(newUsername)) {
          users.delete(u.username);
          u.username = newUsername;
          users.set(newUsername, u);
          req.session.user.username = newUsername;
        }
      }
    }
  }

  // Respond JSON for APIs and redirect for form posts
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    return res.json({ status: 'profile updated', user, sessionUser: req.session.user || null });
  }
  return res.redirect('/dashboard');
});

// Admin page (kept vulnerable): if polluted, user.isAdmin resolves via Object.prototype
app.get('/admin', (req, res) => {
  if (user.isAdmin) {
    res.render('admin', { user, ejs });
  } else {
    res.status(403).send('Access denied');
  }
});

// Messages (simple in-memory guestbook)
app.get('/messages', requireLogin, (req, res) => {
  const list = messages.slice(-50);
  res.render('messages', { messages: list });
});

app.post('/messages', requireLogin, (req, res) => {
  const text = (req.body && req.body.text) || '';
  if (text.trim()) {
    messages.push({ from: req.session.user.username, text: text.trim(), at: new Date() });
  }
  res.redirect('/messages');
});

// File upload
app.get('/upload', requireLogin, (req, res) => {
  res.render('upload');
});

app.post('/upload', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).render('upload', { error: 'No file uploaded' });
  res.render('upload', { success: `Uploaded ${req.file.originalname}`, filePath: `/uploads/${req.file.filename}` });
});

// Simple defaults merge route (for illustrating parameter pollution via query merge)
// Not privileged, but demonstrates how merging untrusted query can alter nested defaults.
app.get('/search', (req, res) => {
  const defaults = { page: 1, pageSize: 10, filters: { q: '', tags: [] } };
  // Using lodash.merge on query parameters can lead to unexpected structure changes
  const effective = _.merge({}, defaults, req.query);
  res.json({ effective });
});

// Start server
app.listen(3000, () => {
  console.log('Lab app running on http://localhost:3000');
});
