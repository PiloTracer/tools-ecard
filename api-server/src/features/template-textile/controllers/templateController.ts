/**
 * Template Controller
 * Handles HTTP requests for template management
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { unifiedTemplateStorageService } from '../services/unifiedTemplateStorageService';
import { modeDetectionService } from '../services/modeDetectionService';
import { resourceDeduplicationService } from '../services/resourceDeduplicationService';
import type { SaveTemplateRequest } from '../types';

export class TemplateController {
  /**
   * Save or update a template
   */
  async saveTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Get user ID from auth middleware
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const saveRequest = request.body as any;

      // Validate required fields
      if (!saveRequest.name || !saveRequest.templateData) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: name or templateData'
        });
      }

      // Save template using unified service
      const metadata = await unifiedTemplateStorageService.saveTemplate(
        {
          name: saveRequest.name,
          templateData: saveRequest.templateData,
          resources: saveRequest.resources
        },
        request as any
      );

      return reply.status(200).send({
        success: true,
        data: metadata,
        message: 'Template saved successfully'
      });
    } catch (error) {
      console.error('Error saving template:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save template'
      });
    }
  }

  /**
   * Load a template
   */
  async loadTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { id } = request.params as any;

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameter: id'
        });
      }

      const template = await unifiedTemplateStorageService.loadTemplate(id, request as any);

      return reply.status(200).send({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error loading template:', error);
      const statusCode = error instanceof Error && error.message === 'Unauthorized' ? 403 : 404;
      return reply.status(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Template not found'
      });
    }
  }

  /**
   * List all templates for a user
   */
  async listTemplates(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const templates = await unifiedTemplateStorageService.listTemplates(request as any);

      return reply.status(200).send({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error listing templates:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list templates'
      });
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { id } = request.params as any;

      if (!id) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameter: id'
        });
      }

      await unifiedTemplateStorageService.deleteTemplate(id, request as any);

      return reply.status(200).send({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      const statusCode = error instanceof Error && error.message === 'Unauthorized' ? 403 : 500;
      return reply.status(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template'
      });
    }
  }

  /**
   * Get storage mode
   */
  async getStorageMode(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const mode = await modeDetectionService.detectMode();

      return reply.status(200).send({
        success: true,
        data: { mode }
      });
    } catch (error) {
      console.error('Error getting storage mode:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage mode'
      });
    }
  }

  /**
   * Upload resources for deduplication
   */
  async uploadResources(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      const { resources } = request.body as any;

      if (!resources || !Array.isArray(resources)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request: resources must be an array'
        });
      }

      const processedResources = [];

      for (const resource of resources) {
        if (!resource.data || !resource.type) {
          continue;
        }

        const url = await resourceDeduplicationService.storeResource({
          data: resource.data,
          type: resource.type,
          hash: resource.hash
        });

        processedResources.push({
          originalHash: resource.hash,
          url,
          type: resource.type
        });
      }

      return reply.status(200).send({
        success: true,
        data: { resources: processedResources }
      });
    } catch (error) {
      console.error('Error uploading resources:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload resources'
      });
    }
  }
}

export const templateController = new TemplateController();