const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/hardware', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'hardware.html'));
});

app.get('/farm', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'farm.html'));
});

// Component routes
app.get('/components/:component', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'components', req.params.component));
});

// API Routes (pro budoucí použití)
app.use('/api', require('./backend/routes/api'));

// Error handling
app.use((req, res) => {
  res.status(404).send('404 - Stránka nenalezena');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('500 - Chyba serveru');
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     MINEOPS SERVER                        ║
║                 Crypto Mining Idle Game                   ║
╠═══════════════════════════════════════════════════════════╣
║  Status: ONLINE                                           ║
║  Port: ${PORT}                                              ║
║  URL: http://localhost:${PORT}                              ║
║  Environment: ${process.env.NODE_ENV}                                ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
