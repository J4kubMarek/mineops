const express = require('express');
const path = require('path');
require('dotenv').config();

// Import game engine for tick mechanism
const gameEngine = require('./backend/engine/gameEngine');

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

app.get('/pool', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'pool.html'));
});

app.get('/market', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'market.html'));
});

app.get('/network', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'network.html'));
});

app.get('/research', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'research.html'));
});

app.get('/exploits', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'exploits.html'));
});

app.get('/system', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'system.html'));
});

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Logout route
app.get('/logout', (req, res) => {
  // TODO: Implement proper session logout
  res.redirect('/');
});

// Component routes
app.get('/components/:component', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'components', req.params.component));
});

// API Routes (pro budoucí použití)
app.use('/api', require('./backend/routes/api'));

// Hardware API Routes - nakup a sprava hardwaru
app.use('/api', require('./backend/routes/hardware'));

// Admin API Routes
app.use('/api/admin', require('./backend/routes/admin'));

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
║  Admin: http://localhost:${PORT}/admin                      ║
║  Environment: ${process.env.NODE_ENV}                                ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start game engine with tick mechanism (10s ticks)
  // This initializes the mining calculation loop and price updates
  gameEngine.startEngine();
});
