const express = require('express');
const { getMarketIndexes, streamMarketIndexes } = require('../controllers/marketController');

const router = express.Router();

router.get('/indexes', getMarketIndexes);
router.get('/indexes/stream', streamMarketIndexes);

module.exports = router;
