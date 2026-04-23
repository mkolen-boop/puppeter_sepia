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
      contrast = 100,
      brightness = 100,
      saturate = 100,
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
    const safeContrast = Number(contrast);
    const safeBrightness = Number(brightness);
    const safeSaturate = Number(saturate);

    const useSepia = String(sepia) === 'true';
    const useGrayscale = String(grayscale) === 'true';

    if (
      Number.isNaN(safeX) ||
      Number.isNaN(safeY) ||
      Number.isNaN(safeImgWidth) ||
      Number.isNaN(safeImgHeight) ||
      Number.isNaN(safeOutputWidth) ||
      Number.isNaN(safeOutputHeight) ||
      Number.isNaN(safeOverlay) ||
      Number.isNaN(safeContrast) ||
      Number.isNaN(safeBrightness) ||
      Number.isNaN(safeSaturate)
    ) {
      return res.status(400).json({ error: 'Invalid numeric parameters' });
    }

    const normalizedContrast = Math.max(0, safeContrast);
    const normalizedBrightness = Math.max(0, safeBrightness);
    const normalizedSaturate = Math.max(0, safeSaturate);

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
    if (normalizedContrast !== 100) filterParts.push(`contrast(${normalizedContrast}%)`);
    if (normalizedBrightness !== 100) filterParts.push(`brightness(${normalizedBrightness}%)`);
    if (normalizedSaturate !== 100) filterParts.push(`saturate(${normalizedSaturate}%)`);
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

app.post('/process-photo', upload.single('photo'), async (req, res) => {
  let browser;

  try {
    const {
      contrast = 120,
      brightness = 100,
      saturate = 100,
      sepia = 'false',
      grayscale = 'false',
      grain = 0.15,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'photo file is required' });
    }

    const photoDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    const dimensions = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}, photoDataUrl);

    await page.setViewport({
  width: dimensions.width,
  height: dimensions.height,
});

    const filter = `
      ${sepia === 'true' ? 'sepia(100%)' : ''}
      ${grayscale === 'true' ? 'grayscale(100%)' : ''}
      contrast(${contrast}%)
      brightness(${brightness}%)
      saturate(${saturate}%)
    `;

    const html = `
      <html>
        <body style="margin:0">
          <div style="position:relative;width:100%;height:100%">
            <img src="${photoDataUrl}" style="width:100%;height:100%;filter:${filter}" />
            <div style="
              position:absolute;
              inset:0;
              opacity:${grain};
              mix-blend-mode:overlay;
              background-image:url('data:image/svg+xml;utf8,
                <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                  <filter id="n">
                    <feTurbulence type="fractalNoise" baseFrequency="0.8"/>
                  </filter>
                  <rect width="100%" height="100%" filter="url(%23n)"/>
                </svg>');
            "></div>
          </div>
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const buffer = await page.screenshot({ type: 'jpeg', quality: 90 });

    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buffer);

  } catch (e) {
    res.status(500).json({ error: 'failed' });
  } finally {
    if (browser) await browser.close();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
