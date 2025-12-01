/**
 * Font Management Controller
 * Handles HTTP requests for font operations
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { fontService } from '../services/fontService';
import type { FontListFilters } from '../types';

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

interface ListFontsQuerystring {
  scope?: 'global' | 'user' | 'all';
  category?: string;
  search?: string;
}

interface GetFontFileQuerystring {
  userId?: string;
}

/**
 * Font Controller - manages HTTP requests for fonts
 */
export class FontController {
  /**
   * GET /api/v1/fonts
   * List fonts available to the user (authentication optional)
   * - Authenticated users: Can see global + their custom fonts
   * - Unauthenticated users: Can only see global fonts
   */
  async listFonts(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as ListFontsQuerystring;
      const scope = query.scope || 'all';

      const filters: FontListFilters = {
        category: query.category,
        search: query.search,
        scope,
      };

      let fonts;

      // If user is not authenticated, only return global fonts
      if (!request.user) {
        console.log('[FontController] Unauthenticated request - returning global fonts only');
        fonts = await fontService.listGlobalFonts(filters);
        return reply.code(200).send({ fonts });
      }

      // User is authenticated - return fonts based on scope
      if (scope === 'global') {
        fonts = await fontService.listGlobalFonts(filters);
      } else if (scope === 'user') {
        fonts = await fontService.listUserFonts(request.user.id, filters);
      } else {
        // 'all' - both global and user fonts
        fonts = await fontService.listAvailableFonts(request.user.id, filters);
      }

      reply.code(200).send({ fonts });
    } catch (error) {
      console.error('[FontController] Error listing fonts:', error);
      reply.code(500).send({ error: 'Failed to list fonts' });
    }
  }

  /**
   * POST /api/v1/fonts
   * Upload a custom font for the authenticated user
   */
  async uploadFont(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Parse multipart form data
      const parts = request.parts();
      let file: Buffer | null = null;
      let fileName: string | null = null;
      let fontName: string | null = null;
      let fontFamily: string | null = null;
      let fontCategory: string = 'sans-serif';
      let fontVariant: string = 'regular';
      let fontWeight: number = 400;
      let fontStyle: string = 'normal';

      for await (const part of parts) {
        if (part.type === 'file') {
          file = await part.toBuffer();
          fileName = part.filename;
        } else {
          const value = part.value as string;
          switch (part.fieldname) {
            case 'fontName':
              fontName = value;
              break;
            case 'fontFamily':
              fontFamily = value;
              break;
            case 'fontCategory':
              fontCategory = value;
              break;
            case 'fontVariant':
              fontVariant = value;
              break;
            case 'fontWeight':
              fontWeight = parseInt(value);
              break;
            case 'fontStyle':
              fontStyle = value;
              break;
          }
        }
      }

      // Validation
      if (!file || !fileName) {
        return reply.code(400).send({ error: 'No file provided' });
      }

      if (!fontName || !fontFamily) {
        return reply.code(400).send({ error: 'Font name and family are required' });
      }

      // Validate file extension
      const validExtensions = ['.woff2', '.woff', '.ttf', '.otf', '.ttc'];
      const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        return reply.code(400).send({
          error: 'Invalid file type. Supported formats: .woff2, .woff, .ttf, .otf, .ttc',
        });
      }

      // Validate file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.length > MAX_FILE_SIZE) {
        return reply.code(400).send({ error: 'File size exceeds 10MB limit' });
      }

      // Upload font
      const font = await fontService.uploadUserFont(request.user.id, {
        fontName,
        fontFamily,
        fontCategory: fontCategory as any,
        fontVariant: fontVariant as any,
        fontWeight,
        fontStyle: fontStyle as any,
        file,
        fileName,
      });

      reply.code(201).send({ font });
    } catch (error) {
      console.error('[FontController] Error uploading font:', error);
      reply.code(500).send({ error: 'Failed to upload font' });
    }
  }

  /**
   * DELETE /api/v1/fonts/:fontId
   * Delete a user's custom font
   */
  async deleteFont(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { fontId } = request.params as { fontId: string };

      if (!fontId) {
        return reply.code(400).send({ error: 'Font ID is required' });
      }

      await fontService.deleteUserFont(request.user.id, fontId);

      reply.code(200).send({ message: 'Font deleted successfully' });
    } catch (error: any) {
      console.error('[FontController] Error deleting font:', error);

      if (error.message === 'Font not found') {
        return reply.code(404).send({ error: 'Font not found' });
      }

      if (error.message.includes('Unauthorized')) {
        return reply.code(403).send({ error: error.message });
      }

      if (error.message.includes('Cannot delete system fonts')) {
        return reply.code(403).send({ error: error.message });
      }

      reply.code(500).send({ error: 'Failed to delete font' });
    }
  }

  /**
   * GET /api/v1/fonts/:fontId/file
   * Get font file (public endpoint for @font-face CSS)
   * Authentication is optional - if authenticated, can access user fonts
   */
  async getFontFile(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    try {
      const { fontId } = request.params as { fontId: string };
      const query = request.query as GetFontFileQuerystring;

      if (!fontId) {
        return reply.code(400).send({ error: 'Font ID is required' });
      }

      // If user is authenticated, use their ID. Otherwise, use query param or undefined
      const userId = request.user?.id || query.userId;

      // Get font file
      const fontBuffer = await fontService.getFontFile(fontId, userId);

      // Determine content type from font metadata (use same userId)
      const font = await fontService.getFontById(fontId, userId);
      if (!font) {
        return reply.code(404).send({ error: 'Font not found' });
      }

      // Set headers for font file
      const contentType = this.getContentType(font.seaweedfsFid);
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

      // CORS: Allow specific origin when credentials are included
      // Cannot use wildcard '*' with credentials
      const origin = request.headers.origin || '*';
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');

      reply.code(200).send(fontBuffer);
    } catch (error) {
      console.error('[FontController] Error getting font file:', error);
      reply.code(500).send({ error: 'Failed to get font file' });
    }
  }

  /**
   * Helper: Get content type from file name
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
}

// Export singleton instance
export const fontController = new FontController();
