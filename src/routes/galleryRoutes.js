const express = require('express');
const router = express.Router();
const galleryService = require('../services/galleryService');

router.get('/', async (req, res) => {
  try {
    const images = await galleryService.getImages();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { image, date, description, matchId } = req.body;
    const newImage = await galleryService.createImage(image, date, description, matchId);
    res.status(201).json(newImage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
