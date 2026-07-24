const db = require('../src/db');
const galleryService = require('../src/services/galleryService');
const path = require('path');
const fs = require('fs');

describe('Gallery Service', () => {
  beforeEach(async () => {
    process.env.DB_MOCK = 'true';
    await db.init();
  });

  afterEach(() => {
    const mockPath = path.join(__dirname, '../data/db.json');
    if (fs.existsSync(mockPath)) {
      fs.unlinkSync(mockPath);
    }
    // Clean up any uploaded test images
    const uploadDir = path.join(__dirname, '../public/images/gallery');
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        if (file.startsWith('gallery_image_') && file.endsWith('.png')) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
          } catch (e) {
            // Ignore
          }
        }
      }
    }
  });

  test('should create and retrieve external URL gallery images', async () => {
    const img = await galleryService.createImage(
      'https://example.com/catan.jpg',
      '2026-07-20',
      'Great Catan game!'
    );

    expect(img.imageUrl).toBe('https://example.com/catan.jpg');
    expect(img.date).toBe('2026-07-20');
    expect(img.description).toBe('Great Catan game!');
    expect(img.partitionKey).toBe('GALLERY');

    const images = await galleryService.getImages();
    expect(images.length).toBe(1);
    expect(images[0].id).toBe(img.id);
  });

  test('should sort gallery images chronologically', async () => {
    await galleryService.createImage('https://example.com/2.jpg', '2026-07-20', 'Second');
    await galleryService.createImage('https://example.com/1.jpg', '2026-07-19', 'First');
    await galleryService.createImage('https://example.com/3.jpg', '2026-07-21', 'Third');

    const images = await galleryService.getImages();
    expect(images.length).toBe(3);
    expect(images[0].description).toBe('First');
    expect(images[1].description).toBe('Second');
    expect(images[2].description).toBe('Third');
  });

  test('should handle base64 image uploads', async () => {
    const base64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const img = await galleryService.createImage(base64Png, '2026-07-20', 'Base64 Upload');

    expect(img.imageUrl).toMatch(/^\/images\/gallery\/gallery_image_.*\.png$/);
    expect(img.description).toBe('Base64 Upload');

    // Verify file exists on disk
    const diskPath = path.join(__dirname, '../public', img.imageUrl);
    expect(fs.existsSync(diskPath)).toBe(true);
  });

  test('should create gallery image linked to a specific matchId', async () => {
    const matchId = 'match_12345';
    const img = await galleryService.createImage(
      'https://example.com/winner.jpg',
      '2026-07-23',
      'Winner photo',
      matchId
    );

    expect(img.matchId).toBe('match_12345');

    const images = await galleryService.getImages();
    expect(images.length).toBe(1);
    expect(images[0].matchId).toBe('match_12345');
  });
});
