const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// TODO: Přidat další API endpointy
// - /api/users - správa uživatelů
// - /api/mining - těžební operace
// - /api/hardware - správa HW
// - /api/pool - správa poolů
// - /api/research - výzkum technologií

module.exports = router;
