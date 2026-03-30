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
      imgWidth = 700,
      imgHeight = 760,
      sepia = 'true',
      grayscale = 'false',
      overlay = 1,
      outputWidth = 1024,
      outputHeight = 1448,
      anchorX = 'left',
      anchorY = 'top',
    } = req.body;

    if (!templateUrl) {
      return res.status(400).json({ error: 'templateUrl is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'photo file is required' });
    }

    const safeX = Number(x);
    const safeY = Number(y);
    const safeImgWidth = Number(imgWidth);
    const safeImgHeight = Number(imgHeight);
    const safeOutputWidth = Number(outputWidth);
    const safeOutputHeight = Number(outputHeight);
    const safeOverlay = Math.max(0, Math.min(1, Number(overlay)));

    const useSepia = String(sepia) === 'true';
    const useGrayscale = String(grayscale) === 'true';

    if (
      Number.isNaN(safeX) ||
      Number.isNaN(safeY) ||
      Number.isNaN(safeImgWidth) ||
      Number.isNaN(safeImgHeight) ||
      Number.isNaN(safeOutputWidth) ||
      Number.isNaN(safeOutputHeight) ||
      Number.isNaN(safeOverlay)
    ) {
      return res.status(400).json({ error: 'Invalid numeric parameters' });
    }

    const anchorMapX = {
      left: '0%',
      center: '50%',
      right: '100%',
    };

    const anchorMapY = {
      top: '0%',
      center: '50%',
      bottom: '100%',
    };

    const safeAnchorX = anchorMapX[String(anchorX)] ? String(anchorX) : 'left';
    const safeAnchorY = anchorMapY[String(anchorY)] ? String(anchorY) : 'top';

    const translateX = anchorMapX[safeAnchorX];
    const translateY = anchorMapY[safeAnchorY];

    const mimeType = req.file.mimetype || 'image/jpeg';
    const photoDataUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: safeOutputWidth,
      height: safeOutputHeight,
      deviceScaleFactor: 1,
    });

    const filterParts = [];
    if (useSepia) filterParts.push('sepia(100%)');
    if (useGrayscale) filterParts.push('grayscale(100%)');
    const filter = filterParts.length ? filterParts.join(' ') : 'none';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: ${safeOutputWidth}px;
              height: ${safeOutputHeight}px;
              overflow: hidden;
              background: white;
            }

            .stage {
              position: relative;
              width: ${safeOutputWidth}px;
              height: ${safeOutputHeight}px;
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
              left: ${safeX}px;
              top: ${safeY}px;
              width: ${safeImgWidth}px;
              height: ${safeImgHeight}px;
              transform: translate(-${translateX}, -${translateY});
              transform-origin: ${safeAnchorX} ${safeAnchorY};
              filter: ${filter};
              opacity: ${safeOverlay};
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
    if (browser) {
      await browser.close();
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
