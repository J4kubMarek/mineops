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

// CoinGecko API proxy - crypto prices
router.get('/crypto/prices', async (req, res) => {
  try {
    const coins = ['bitcoin', 'ethereum', 'monero'];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd&include_24hr_change=true`;

    // Use native fetch (Node.js 18+) or fallback to https module
    let data;
    if (typeof fetch !== 'undefined') {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      data = await response.json();
    } else {
      // Fallback for older Node.js versions
      const https = require('https');
      data = await new Promise((resolve, reject) => {
        https.get(url, (response) => {
          let body = '';
          response.on('data', chunk => body += chunk);
          response.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    res.status(500).json({
      error: 'Failed to fetch crypto prices',
      message: error.message
    });
  }
});

// TODO: Přidat další API endpointy
// - /api/users - správa uživatelů
// - /api/mining - těžební operace
// - /api/hardware - správa HW
// - /api/pool - správa poolů
// - /api/research - výzkum technologií

module.exports = router;
