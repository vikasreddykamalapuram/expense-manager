import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputSvg = join(__dirname, 'public', 'logo.svg');
const outputDir = join(__dirname, 'public', 'icons');

mkdirSync(outputDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  // Generate standard icons
  for (const size of sizes) {
    await sharp(inputSvg)
      .resize(size, size)
      .png()
      .toFile(join(outputDir, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Generate maskable icon (512x512 with 20% padding on #2563eb background)
  const maskableSize = 512;
  const padding = Math.round(maskableSize * 0.2);
  const iconSize = maskableSize - padding * 2;

  const iconBuffer = await sharp(inputSvg)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 37, g: 99, b: 235, alpha: 1 }, // #2563eb
    },
  })
    .composite([{ input: iconBuffer, left: padding, top: padding }])
    .png()
    .toFile(join(outputDir, `maskable-icon-${maskableSize}x${maskableSize}.png`));

  console.log(`✓ maskable-icon-${maskableSize}x${maskableSize}.png`);
  console.log('\nAll icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
