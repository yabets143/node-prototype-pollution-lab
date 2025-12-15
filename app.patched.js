// app.patched.js
// Patched demo app: mitigations for prototype pollution and template injection

const express = require('express');
const bodyParser = require('body-parser');
const _ = require('lodash');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// User has own isAdmin flag; start false
let user = { username: 'guest', isAdmin: false, bio: '' };

// Strip dangerous keys recursively
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
    out[k] = sanitize(v);
  }
  return out;
}

app.post('/update-profile', (req, res) => {
  const clean = sanitize(req.body);
  _.merge(user, clean);
  res.json({ status: 'profile updated (sanitized)', user });
});

app.get('/admin', (req, res) => {
  if (Object.prototype.hasOwnProperty.call(user, 'isAdmin') && user.isAdmin === true) {
    res.render('admin_patched', { user });
  } else {
    res.status(403).send('Access denied');
  }
});

app.get('/', (req, res) => {
  res.send('Home page (patched)');
});

app.listen(3000, () => {
  console.log('Patched app running on http://localhost:3000');
});
