const express = require('express');
const router = express.Router();

// Placeholder implementation – in a real system this would aggregate wishlists from the DB.
router.get('/api/admin/favorites/interest', async (req, res) => {
  // Example static response
  res.json([
    { productId: '1', name: 'Rosa Roja', count: 12, outOfStock: false },
    { productId: '2', name: 'Orquídea Blanca', count: 8, outOfStock: true },
  ]);
});

module.exports = router;
