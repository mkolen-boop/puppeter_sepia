const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => {
  res.send('OK');
});

app.post('/render-newspaper', async (req, res) => {
  let browser;

  try {
    const {
      templateUrl,
      photoUrl,
      x = 150,
      y = 220,
      width = 900,
      height = 1100,
      sepia = true,
      grayscale = false,
      outputWidth = 1200,
      outputHeight = 1600,
      borderRadius = 0,
      rotate = 0,
    } = req.body;

    if (!templateUrl || !photoUrl) {
      return res.status(400).json({
        error: 'templateUrl and photoUrl are required',
      });
    }

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: outputWidth,
      height: outputHeight,
      deviceScaleFactor: 1,
    });

    const filterParts = [];
    if (sepia) filterParts.push('sepia(100%)');
    if (grayscale) filterParts.push('grayscale(100%)');
    const cssFilter = filterParts.length ? filterParts.join(' ') : 'none';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: ${outputWidth}px;
              height: ${outputHeight}px;
              overflow: hidden;
              background: white;
            }

            .stage {
              position: relative;
              width: ${outputWidth}px;
              height: ${outputHeight}px;
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
              left: ${x}px;
              top: ${y}px;
              width: ${width}px;
              height: ${height}px;
              object-fit: cover;
              filter: ${cssFilter};
              border-radius: ${borderRadius}px;
              transform: rotate(${rotate}deg);
              transform-origin: center center;
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
    res.setHeader('Content-Disposition', 'inline; filename="newspaper.jpg"');
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || 'Render failed',
    });
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
