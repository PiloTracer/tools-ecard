/**
 * Template Controller
 * Handles HTTP requests for template management
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { templateStorageService } from '../services/templateStorageService';
import type { SaveTemplateRequest } from '../types';

export class TemplateController {
  /**
   * Save or update a template
   */
  async saveTemplate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Get user ID from auth middleware (assumes user is attached to request)
      const userId = (request as any).user?.id || 'test-user'; // TODO: Get from actual auth

      const saveRequest = request.body as SaveTemplateRequest;

      // Validate required fields
      if (!saveRequest.templateName || !saveRequest.projectName || !saveRequest.template) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: templateName, projectName, or template'
        });
      }

      // Save template
      const metadata = await templateStorageService.saveTemplate(userId, saveRequest);

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
      const userId = (request as any).user?.id || 'test-user';
      const { projectName, templateName } = request.params as any;
      const { version } = request.query as any;

      if (!projectName || !templateName) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameters: projectName or templateName'
        });
      }

      const versionNumber = version ? parseInt(version as string) : undefined;
      const template = await templateStorageService.loadTemplate(
        userId,
        projectName,
        templateName,
        versionNumber
      );

      return reply.status(200).send({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error loading template:', error);
      return reply.status(404).send({
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
      const userId = (request as any).user?.id || 'test-user';
      const { page, pageSize } = request.query as any;
      const pageNum = parseInt(page) || 1;
      const size = parseInt(pageSize) || 20;

      const result = await templateStorageService.listTemplates(userId, pageNum, size);

      return reply.status(200).send({
        success: true,
        data: result
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
      const userId = (request as any).user?.id || 'test-user';
      const { projectName, templateName } = request.params as any;

      if (!projectName || !templateName) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameters: projectName or templateName'
        });
      }

      await templateStorageService.deleteTemplate(userId, projectName, templateName);

      return reply.status(200).send({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template'
      });
    }
  }

  /**
   * Get template versions
   */
  async getVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const userId = (request as any).user?.id || 'test-user';
      const { projectName, templateName } = request.params as any;

      if (!projectName || !templateName) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required parameters: projectName or templateName'
        });
      }

      const versions = await templateStorageService.getVersions(userId, projectName, templateName);

      return reply.status(200).send({
        success: true,
        data: versions
      });
    } catch (error) {
      console.error('Error getting versions:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get template versions'
      });
    }
  }
}

export const templateController = new TemplateController();