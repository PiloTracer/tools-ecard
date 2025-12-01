/**
 * Google Fonts Auto-Loader
 * Automatically loads curated Google Fonts on server startup
 */

import { fontService } from '../services/fontService';
import type { GoogleFont } from '../types';

/**
 * Curated list of 30 high-quality Google Fonts
 * All fonts are open-source and safe for commercial use
 */
const CURATED_GOOGLE_FONTS: GoogleFont[] = [
  // Serif (5)
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Merriweather', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },

  // Sans-Serif (10)
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Source Sans Pro', category: 'sans-serif' },

  // Display (7)
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Lobster', category: 'display' },
  { family: 'Pacifico', category: 'display' },
  { family: 'Oswald', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },

  // Handwriting (5)
  { family: 'Parisienne', category: 'handwriting' },
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Allura', category: 'handwriting' },

  // Monospace (3)
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
];

/**
 * Load curated Google Fonts on server startup
 * Checks if fonts exist before downloading to avoid duplicates
 */
export async function loadGoogleFonts(): Promise<void> {
  console.log('='.repeat(80));
  console.log('[Google Fonts] Starting auto-load of curated fonts...');
  console.log('[Google Fonts] Total fonts to load: ' + CURATED_GOOGLE_FONTS.length);
  console.log('='.repeat(80));

  let loadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const { family, category } of CURATED_GOOGLE_FONTS) {
    try {
      // Check if font already exists
      const exists = await fontService.globalFontExists(family);

      if (exists) {
        console.log(`[Google Fonts] ✓ "${family}" (already exists)`);
        skippedCount++;
        continue;
      }

      // Download and upload font
      console.log(`[Google Fonts] ⬇ Loading "${family}"...`);
      const fonts = await fontService.loadGoogleFont(family, category);
      console.log(`[Google Fonts] ✓ "${family}" (${fonts.length} variants loaded)`);
      loadedCount++;
    } catch (error: any) {
      console.error(`[Google Fonts] ✗ "${family}" (${error.message})`);
      failedCount++;
      // Continue with next font
    }
  }

  console.log('='.repeat(80));
  console.log('[Google Fonts] Auto-load complete:');
  console.log(`  - Loaded: ${loadedCount} fonts`);
  console.log(`  - Skipped: ${skippedCount} fonts (already exist)`);
  console.log(`  - Failed: ${failedCount} fonts`);
  console.log('='.repeat(80));
}
