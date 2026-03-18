const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (_req, res) => {
  res.send('OK');
});

app.post('/render-newspaper', async (req, res) => {
  let browser;

  try {
    const {
      templateUrl,
      photoUrl,
      x = 120,
      y = 210,
      imgWidth = 700,
      imgHeight = 760,
      sepia = true,
      overlay = 1,
      outputWidth = 1024,
      outputHeight = 1448,
      anchorX = 'left',
      anchorY = 'top',
      rotate = 0,
    } = req.body;

    if (!templateUrl) {
      return res.status(400).json({ error: 'templateUrl is required' });
    }

    if (!photoUrl) {
      return res.status(400).json({ error: 'photoUrl is required' });
    }

    const safeX = Number(x);
    const safeY = Number(y);
    const safeImgWidth = Number(imgWidth);
    const safeImgHeight = Number(imgHeight);
    const safeOutputWidth = Number(outputWidth);
    const safeOutputHeight = Number(outputHeight);
    const safeOverlay = Math.max(0, Math.min(1, Number(overlay)));
    const safeRotate = Number(rotate);

    if (
      Number.isNaN(safeX) ||
      Number.isNaN(safeY) ||
      Number.isNaN(safeImgWidth) ||
      Number.isNaN(safeImgHeight) ||
      Number.isNaN(safeOutputWidth) ||
      Number.isNaN(safeOutputHeight) ||
      Number.isNaN(safeOverlay) ||
      Number.isNaN(safeRotate)
    ) {
      return res.status(400).json({ error: 'Invalid numeric parameters' });
    }

    const allowedAnchorX = ['left', 'center', 'right'];
    const allowedAnchorY = ['top', 'center', 'bottom'];

    const safeAnchorX = allowedAnchorX.includes(String(anchorX)) ? String(anchorX) : 'left';
    const safeAnchorY = allowedAnchorY.includes(String(anchorY)) ? String(anchorY) : 'top';

    const useSepia = String(sepia) === 'true' || sepia === true;
    const filter = useSepia ? 'sepia(100%)' : 'none';

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
              opacity: ${safeOverlay};
              filter: ${filter};
              transform-origin: ${safeAnchorX} ${safeAnchorY};
              transform: rotate(${safeRotate}deg);
            }
          </style>
        </head>
        <body>
          <div class="stage">
            <img class="template" src="${templateUrl}" />
            <img class="photo" src="${photoUrl}" />
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
