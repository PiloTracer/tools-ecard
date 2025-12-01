/**
 * Font Management Service
 * Handles Google Fonts integration, user font uploads, and SeaweedFS storage
 */

import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { cassandraClient } from '../../../core/cassandra/client';
import { S3Service } from '../../s3-bucket/services/s3Service';
import { createLogger } from '../../../core/utils/logger';
import type {
  Font,
  FontUploadRequest,
  FontListFilters,
  GoogleFont,
  GoogleFontVariant,
  SeaweedFSUploadResult,
} from '../types';

const log = createLogger('FontService');
const FONTS_BUCKET = process.env.SEAWEEDFS_FONTS_BUCKET || 'fonts';
const GOOGLE_FONTS_API_URL = 'https://fonts.googleapis.com';
const GLOBAL_USER_ID = 'GLOBAL'; // Sentinel value for system/global fonts (Cassandra partition key can't be null)

// Configure axios to suppress verbose logging from follow-redirects
axios.defaults.httpAgent = new (require('http').Agent)({ keepAlive: true });
axios.defaults.httpsAgent = new (require('https').Agent)({ keepAlive: true });

/**
 * Font Service - manages global and user-specific fonts
 */
export class FontService {
  private s3Service: S3Service;

  constructor() {
    this.s3Service = new S3Service();
    this.ensureBucketExists().catch(err => {
      log.error({ error: err }, 'Failed to create fonts bucket');
    });
  }

  /**
   * Ensure the fonts bucket exists in SeaweedFS
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const buckets = await this.s3Service.listBuckets();
      const bucketExists = buckets.buckets.some(b => b.name === FONTS_BUCKET);

      if (!bucketExists) {
        log.info({ bucket: FONTS_BUCKET }, 'Creating fonts bucket');
        await this.s3Service.createBucket(FONTS_BUCKET);
      }
    } catch (error) {
      log.error({ error }, 'Error ensuring bucket exists');
      throw error;
    }
  }

  // ==================== GLOBAL FONTS ====================

  /**
   * List all global (system) fonts
   */
  async listGlobalFonts(filters?: FontListFilters): Promise<Font[]> {
    try {
      await cassandraClient.connect();

      let query = 'SELECT * FROM fonts WHERE is_system_font = ? ALLOW FILTERING';
      const params: any[] = [true];

      if (filters?.category) {
        query = 'SELECT * FROM fonts WHERE is_system_font = ? AND font_category = ? ALLOW FILTERING';
        params.push(filters.category);
      }

      const result = await cassandraClient['client']!.execute(query, params, {
        prepare: true,
      });

      let fonts = result.rows.map(row => this.mapRowToFont(row));

      // Apply search filter if provided
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        fonts = fonts.filter(font =>
          font.fontName.toLowerCase().includes(searchLower) ||
          font.fontFamily.toLowerCase().includes(searchLower)
        );
      }

      return fonts;
    } catch (error) {
      log.error({ error }, 'Error listing global fonts');
      throw error;
    }
  }

  /**
   * Load a single Google Font family (all variants)
   * Downloads from Google Fonts API and uploads to SeaweedFS
   */
  async loadGoogleFont(fontFamily: string, category: string): Promise<Font[]> {
    try {
      log.info({ fontFamily, category }, 'Loading Google Font family');

      // Parse Google Fonts CSS to get variant URLs
      const variants = await this.parseGoogleFontsCss(fontFamily);

      if (variants.length === 0) {
        throw new Error(`No variants found for font: ${fontFamily}`);
      }

      const loadedFonts: Font[] = [];

      for (const variant of variants) {
        try {
          // Download font file
          log.debug({ fontFamily, variant: variant.variant }, 'Downloading font variant');
          const fontBuffer = await this.downloadFontFile(variant.url);

          // Determine file extension from URL
          const fileExt = variant.url.match(/\.(woff2|woff|ttf|otf|ttc)/)?.[1] || 'ttf';

          // Upload to SeaweedFS
          const fileName = `${fontFamily.replace(/\s+/g, '_')}_${variant.variant}.${fileExt}`;
          const uploadResult = await this.uploadToSeaweedFS(fontBuffer, fileName);

          // Store metadata in Cassandra
          const font: Font = {
            fontId: uuidv4(),
            userId: GLOBAL_USER_ID, // Global font
            fontName: `${fontFamily} ${this.capitalizeVariant(variant.variant)}`,
            fontFamily,
            fontCategory: category as any,
            fontVariant: this.normalizeVariant(variant.variant),
            fontWeight: variant.weight,
            fontStyle: variant.style,
            seaweedfsUrl: uploadResult.url,
            seaweedfsFid: uploadResult.fid,
            googleFontFamily: fontFamily,
            isSystemFont: true,
            fileSize: uploadResult.size,
            createdAt: new Date(),
            createdBy: 'system',
          };

          await this.saveFontMetadata(font);
          loadedFonts.push(font);

          log.debug({ fontName: font.fontName }, 'Loaded font variant');
        } catch (error) {
          log.warn({ variant: variant.variant, error }, 'Failed to load font variant');
          // Continue with next variant
        }
      }

      log.info({ fontFamily, variantsLoaded: loadedFonts.length }, 'Google Font family loaded');
      return loadedFonts;
    } catch (error) {
      log.error({ fontFamily, error }, 'Error loading Google Font family');
      throw error;
    }
  }

  /**
   * Check if a global font already exists
   */
  async globalFontExists(fontFamily: string): Promise<boolean> {
    try {
      await cassandraClient.connect();

      const result = await cassandraClient['client']!.execute(
        'SELECT font_id FROM fonts WHERE is_system_font = ? AND font_family = ? LIMIT 1 ALLOW FILTERING',
        [true, fontFamily],
        { prepare: true }
      );

      return result.rows.length > 0;
    } catch (error) {
      log.error({ fontFamily, error }, 'Error checking font existence');
      return false;
    }
  }

  // ==================== USER FONTS ====================

  /**
   * List fonts uploaded by a specific user
   */
  async listUserFonts(userId: string, filters?: FontListFilters): Promise<Font[]> {
    try {
      await cassandraClient.connect();

      let query = 'SELECT * FROM fonts WHERE user_id = ? AND is_system_font = ?';
      const params: any[] = [userId, false];

      if (filters?.category) {
        query += ' AND font_category = ? ALLOW FILTERING';
        params.push(filters.category);
      }

      const result = await cassandraClient['client']!.execute(query, params, {
        prepare: true,
      });

      let fonts = result.rows.map(row => this.mapRowToFont(row));

      // Apply search filter if provided
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        fonts = fonts.filter(font =>
          font.fontName.toLowerCase().includes(searchLower) ||
          font.fontFamily.toLowerCase().includes(searchLower)
        );
      }

      return fonts;
    } catch (error) {
      log.error({ userId, error }, 'Error listing user fonts');
      throw error;
    }
  }

  /**
   * List all available fonts for a user (global + user fonts)
   */
  async listAvailableFonts(userId: string, filters?: FontListFilters): Promise<Font[]> {
    try {
      const globalFonts = await this.listGlobalFonts(filters);
      const userFonts = await this.listUserFonts(userId, filters);

      return [...globalFonts, ...userFonts];
    } catch (error) {
      log.error({ userId, error }, 'Error listing available fonts');
      throw error;
    }
  }

  /**
   * Upload a custom font for a specific user
   */
  async uploadUserFont(userId: string, request: FontUploadRequest): Promise<Font> {
    try {
      log.info({ userId, fontName: request.fontName }, 'Uploading user font');

      // Upload to SeaweedFS
      const uploadResult = await this.uploadToSeaweedFS(request.file, request.fileName);

      // Create font metadata
      const font: Font = {
        fontId: uuidv4(),
        userId,
        fontName: request.fontName,
        fontFamily: request.fontFamily,
        fontCategory: request.fontCategory,
        fontVariant: request.fontVariant,
        fontWeight: request.fontWeight,
        fontStyle: request.fontStyle,
        seaweedfsUrl: uploadResult.url,
        seaweedfsFid: uploadResult.fid,
        isSystemFont: false,
        fileSize: uploadResult.size,
        createdAt: new Date(),
        createdBy: userId,
      };

      // Save metadata in Cassandra
      await this.saveFontMetadata(font);

      log.info({ userId, fontId: font.fontId, fontName: request.fontName }, 'User font uploaded');
      return font;
    } catch (error) {
      log.error({ userId, error }, 'Error uploading user font');
      throw error;
    }
  }

  /**
   * Delete a user font
   */
  async deleteUserFont(userId: string, fontId: string): Promise<void> {
    try {
      // Get font metadata
      const font = await this.getFontById(fontId, userId);

      if (!font) {
        throw new Error('Font not found');
      }

      if (font.userId !== userId) {
        throw new Error('Unauthorized: Cannot delete another user\'s font');
      }

      if (font.isSystemFont) {
        throw new Error('Cannot delete system fonts');
      }

      // Delete from SeaweedFS
      await this.deleteFontFile(font.seaweedfsFid);

      // Delete from Cassandra
      await cassandraClient.connect();
      await cassandraClient['client']!.execute(
        'DELETE FROM fonts WHERE user_id = ? AND font_id = ?',
        [userId, fontId],
        { prepare: true }
      );

      log.info({ userId, fontId }, 'User font deleted');
    } catch (error) {
      log.error({ userId, fontId, error }, 'Error deleting user font');
      throw error;
    }
  }

  // ==================== FONT FILE OPERATIONS ====================

  /**
   * Get a font by ID
   */
  async getFontById(fontId: string, userId?: string): Promise<Font | null> {
    try {
      await cassandraClient.connect();

      // Try user fonts first if userId provided
      if (userId) {
        const userResult = await cassandraClient['client']!.execute(
          'SELECT * FROM fonts WHERE user_id = ? AND font_id = ?',
          [userId, fontId],
          { prepare: true }
        );

        if (userResult.rows.length > 0) {
          return this.mapRowToFont(userResult.rows[0]);
        }
      }

      // Try global fonts
      const globalResult = await cassandraClient['client']!.execute(
        'SELECT * FROM fonts WHERE user_id = ? AND font_id = ?',
        [null, fontId],
        { prepare: true }
      );

      if (globalResult.rows.length > 0) {
        return this.mapRowToFont(globalResult.rows[0]);
      }

      return null;
    } catch (error) {
      log.error({ fontId, userId, error }, 'Error getting font by ID');
      return null;
    }
  }

  /**
   * Download a font file from SeaweedFS
   */
  async getFontFile(fontId: string, userId?: string): Promise<Buffer> {
    try {
      const font = await this.getFontById(fontId, userId);

      if (!font) {
        throw new Error('Font not found');
      }

      // Extract key from SeaweedFS URL
      const key = font.seaweedfsFid;
      const result = await this.s3Service.getObject(FONTS_BUCKET, key);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of result.body) {
        chunks.push(Buffer.from(chunk));
      }

      return Buffer.concat(chunks);
    } catch (error) {
      log.error({ fontId, userId, error }, 'Error getting font file');
      throw error;
    }
  }

  /**
   * Delete a font file from SeaweedFS
   */
  async deleteFontFile(seaweedfsFid: string): Promise<void> {
    try {
      await this.s3Service.deleteObject(FONTS_BUCKET, seaweedfsFid);
    } catch (error) {
      log.error({ seaweedfsFid, error }, 'Error deleting font file');
      throw error;
    }
  }

  // ==================== GOOGLE FONTS INTEGRATION ====================

  /**
   * Download font file from URL
   */
  private async downloadFontFile(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      return Buffer.from(response.data);
    } catch (error) {
      log.error({ url, error }, 'Error downloading font file');
      throw error;
    }
  }

  /**
   * Upload font buffer to SeaweedFS
   */
  private async uploadToSeaweedFS(buffer: Buffer, fileName: string): Promise<SeaweedFSUploadResult> {
    try {
      const key = `${Date.now()}_${fileName}`;
      const result = await this.s3Service.putObject(
        FONTS_BUCKET,
        key,
        buffer,
        {
          contentType: this.getContentType(fileName),
        }
      );

      return {
        url: result.location,
        fid: key,
        size: buffer.length,
      };
    } catch (error) {
      log.error({ fileName, error }, 'Error uploading to SeaweedFS');
      throw error;
    }
  }

  /**
   * Parse Google Fonts CSS to extract .woff2 URLs
   */
  private async parseGoogleFontsCss(fontFamily: string): Promise<GoogleFontVariant[]> {
    try {
      // Request all common weights and styles
      const cssUrl = `${GOOGLE_FONTS_API_URL}/css2?family=${encodeURIComponent(fontFamily)}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;

      // Suppress axios verbose logging
      const response = await axios.get(cssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        maxRedirects: 5, // Limit redirects
      });

      const css = response.data;

      // Parse @font-face rules
      const fontFaceRegex = /@font-face\s*{([^}]*)}/gs;
      const variants: GoogleFontVariant[] = [];

      let match;
      while ((match = fontFaceRegex.exec(css)) !== null) {
        const block = match[1];

        // Extract font-weight
        const weightMatch = block.match(/font-weight:\s*(\d+)/);
        const weight = weightMatch ? parseInt(weightMatch[1]) : 400;

        // Extract font-style
        const styleMatch = block.match(/font-style:\s*(\w+)/);
        const style = styleMatch ? styleMatch[1] as 'normal' | 'italic' : 'normal';

        // Extract URL (woff2, ttf, ttc, or other formats) - flexible regex
        const urlMatch = block.match(/url\s*\(\s*([^)]+?\.(?:woff2|woff|ttf|otf|ttc)[^)]*?)\s*\)/);
        if (!urlMatch) continue;

        // Clean up the URL (remove quotes if present)
        let url = urlMatch[1].trim().replace(/['"]/g, '');

        // Ensure URL is absolute
        if (!url.startsWith('http')) {
          url = `https:${url}`;
        }

        // Determine variant name
        let variant: string;
        if (weight === 400 && style === 'normal') {
          variant = 'regular';
        } else if (weight === 700 && style === 'normal') {
          variant = 'bold';
        } else if (weight === 400 && style === 'italic') {
          variant = 'italic';
        } else if (weight === 700 && style === 'italic') {
          variant = 'bold-italic';
        } else {
          variant = `${weight}${style === 'italic' ? '-italic' : ''}`;
        }

        variants.push({ variant, weight, style, url });
      }

      return variants;
    } catch (error) {
      log.error({ fontFamily, error }, 'Error parsing Google Fonts CSS');
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Save font metadata to Cassandra
   */
  private async saveFontMetadata(font: Font): Promise<void> {
    try {
      await cassandraClient.connect();

      const query = `
        INSERT INTO fonts (
          font_id, user_id, font_name, font_family, font_category,
          font_variant, font_weight, font_style, seaweedfs_url, seaweedfs_fid,
          google_font_family, is_system_font, file_size, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await cassandraClient['client']!.execute(
        query,
        [
          font.fontId,
          font.userId,
          font.fontName,
          font.fontFamily,
          font.fontCategory,
          font.fontVariant,
          font.fontWeight,
          font.fontStyle,
          font.seaweedfsUrl,
          font.seaweedfsFid,
          font.googleFontFamily || null,
          font.isSystemFont,
          font.fileSize,
          font.createdAt,
          font.createdBy,
        ],
        { prepare: true }
      );
    } catch (error) {
      log.error({ fontId: font.fontId, error }, 'Error saving font metadata');
      throw error;
    }
  }

  /**
   * Map Cassandra row to Font object
   */
  private mapRowToFont(row: any): Font {
    return {
      fontId: row.font_id,
      userId: row.user_id,
      fontName: row.font_name,
      fontFamily: row.font_family,
      fontCategory: row.font_category,
      fontVariant: row.font_variant,
      fontWeight: row.font_weight,
      fontStyle: row.font_style,
      seaweedfsUrl: row.seaweedfs_url,
      seaweedfsFid: row.seaweedfs_fid,
      googleFontFamily: row.google_font_family,
      isSystemFont: row.is_system_font,
      fileSize: row.file_size ? parseInt(row.file_size.toString()) : 0,
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }

  /**
   * Get content type for font file
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'woff2':
        return 'font/woff2';
      case 'woff':
        return 'font/woff';
      case 'ttf':
        return 'font/ttf';
      case 'otf':
        return 'font/otf';
      case 'ttc':
        return 'font/collection';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Normalize variant name
   */
  private normalizeVariant(variant: string): 'regular' | 'bold' | 'italic' | 'bold-italic' {
    if (variant === 'regular' || variant === '400') return 'regular';
    if (variant === 'bold' || variant === '700') return 'bold';
    if (variant === 'italic' || variant === '400-italic') return 'italic';
    if (variant === 'bold-italic' || variant === '700-italic') return 'bold-italic';
    return 'regular';
  }

  /**
   * Capitalize variant name for display
   */
  private capitalizeVariant(variant: string): string {
    if (variant === 'regular') return 'Regular';
    if (variant === 'bold') return 'Bold';
    if (variant === 'italic') return 'Italic';
    if (variant === 'bold-italic') return 'Bold Italic';
    return variant.charAt(0).toUpperCase() + variant.slice(1);
  }
}

// Export singleton instance
export const fontService = new FontService();
