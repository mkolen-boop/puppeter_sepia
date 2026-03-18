const express = require('express');
const puppeteer = require('puppeteer');
const multer = require('multer');

const app = express();
const upload = multer();
app.use(express.json({ limit: '50mb' }));

app.get('/', (_req, res) => {
  res.send('OK');
});

app.post('/render-newspaper', upload.single('photo'), async (req, res) => {
  let browser;

  try {
    const {
      templateUrl,
      x = 120,
      y = 210,
      width = 700,
      height = 760,
      sepia = 'true',
      outputWidth = 1024,
      outputHeight = 1448,
    } = req.body;

    if (!templateUrl) {
      return res.status(400).json({ error: 'templateUrl is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'photo file is required' });
    }

    const mimeType = req.file.mimetype || 'image/jpeg';
    const photoDataUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: Number(outputWidth),
      height: Number(outputHeight),
      deviceScaleFactor: 1,
    });

    const filter = sepia === 'true' ? 'sepia(100%)' : 'none';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: ${Number(outputWidth)}px;
              height: ${Number(outputHeight)}px;
              overflow: hidden;
              background: white;
            }
            .stage {
              position: relative;
              width: ${Number(outputWidth)}px;
              height: ${Number(outputHeight)}px;
              overflow: hidden;
            }
            .template {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .photo {
              position: absolute;
              left: ${Number(x)}px;
              top: ${Number(y)}px;
              width: ${Number(width)}px;
              height: ${Number(height)}px;
              object-fit: cover;
              filter: ${filter};
            }
          </style>
        </head>
        <body>
          <div class="stage">
            <img class="template" src="${templateUrl}" />
            <img class="photo" src="${photoDataUrl}" />
          </div>
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: 90,
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Render failed' });
  } finally {
    if (browser) await browser.close();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
