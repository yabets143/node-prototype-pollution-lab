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


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'public')));

// Sessions (in-memory for demo purposes )
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


const users = new Map();
const messages = [];

let user = { username: 'guest', bio: '' };

// Multer upload destination
const upload = multer({ dest: path.join(__dirname, 'uploads') });


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


app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});


function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login');
  next();
}

app.get('/dashboard', requireLogin, (req, res) => {
  const u = users.get(req.session.user.username);
  res.render('dashboard', { profile: u, labUser: user });
});

app.post('/update-profile', (req, res) => {
  const data = req.body;
  _.merge({} , data);

  if (typeof data === 'object' && data !== null) {
    if (Object.prototype.hasOwnProperty.call(data, 'bio')) {
      user.bio = data.bio;
    }
    if (Object.prototype.hasOwnProperty.call(data, 'username')) {
      user.username = data.username;
    }
  }

  // Also update the logged-in user's profile, if any 
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


app.get('/admin', (req, res) => {
  if (user.isAdmin) {
    // Pass require into template so ejs.render(user.bio) payloads can access it
    res.render('admin', { user, ejs, require });
  } else {
    res.status(403);
    res.render('403', { title: 'Access Denied' });
  }
});

// Messages
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


app.get('/upload', requireLogin, (req, res) => {
  res.render('upload');
});

app.post('/upload', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).render('upload', { error: 'No file uploaded' });
  res.render('upload', { success: `Uploaded ${req.file.originalname}`, filePath: `/uploads/${req.file.filename}` });
});



app.get('/search', (req, res) => {
  const defaults = { page: 1, pageSize: 10, filters: { q: '', tags: [] } };
  // Using lodash.merge on query parameters can lead to unexpected structure changes
  const effective = _.merge({}, defaults, req.query);
  res.json({ effective });
});


app.listen(3000, () => {
  console.log('Lab app running on http://localhost:3000');
});
