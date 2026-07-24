const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const galleryService = {
  // Ensure the upload directory exists
  ensureUploadDir() {
    const uploadDir = path.join(__dirname, '../../public/images/gallery');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
  },

  async getImages() {
    const items = await db.queryItems({
      query: "SELECT * FROM c WHERE c.partitionKey = 'GALLERY' AND c.type = 'gallery_image'"
    });
    // Sort chronologically by date, and fallback to createdAt time
    return items.sort((a, b) => {
      const dateDiff = new Date(a.date) - new Date(b.date);
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  },

  async createImage(imageInput, date, description = '', matchId = null) {
    if (!imageInput) {
      throw new Error('Image source (file or URL) is required.');
    }
    if (!date) {
      throw new Error('Date is required.');
    }

    const imageId = `gallery_image_${uuidv4()}`;
    let imageUrl = '';

    // Check if the input is a base64 encoded image
    if (imageInput.startsWith('data:image/')) {
      const uploadDir = this.ensureUploadDir();
      
      // Match base64 pattern to extract mime type and content
      const matches = imageInput.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 image format.');
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      
      // Map MIME type to file extension
      let ext = 'jpg';
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('gif')) ext = 'gif';
      else if (mimeType.includes('webp')) ext = 'webp';
      else if (mimeType.includes('svg')) ext = 'svg';

      const fileName = `${imageId}.${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Write file content
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      imageUrl = `/images/gallery/${fileName}`;
    } else {
      // It is an external image URL
      imageUrl = imageInput.trim();
    }

    const galleryImage = {
      id: imageId,
      partitionKey: 'GALLERY',
      type: 'gallery_image',
      imageUrl,
      description: description.trim(),
      date,
      matchId: matchId || null,
      createdAt: new Date().toISOString()
    };

    await db.createItem(galleryImage);
    return galleryImage;
  }
};

module.exports = galleryService;
