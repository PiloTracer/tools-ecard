  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, request: Request): Promise<void> {
    const userId = (request as any).user?.id;
    const userEmail = (request as any).user?.email;
    if (!userId || !userEmail) {
      throw new Error('User not authenticated');
    }

    // Load metadata first to verify ownership. We use the template's own
    // storageUrl to determine how to delete, NOT modeDetectionService,
    // because the template might have been saved in a different mode than
    // the current one (e.g., deleted from a FALLBACK client after FULL save).
    let metadata: TemplateMetadata | null = null;
    let storageMode: 'full' | 'fallback' = 'fallback';

    try {
      const dbTemplate = await templateOperations.getTemplate(templateId, userId);
      if (!dbTemplate) {
        console.error(`[DELETE SERVICE] getTemplate returned null — templateId="${templateId}", userId="${userId}"`);
        throw new Error('Template not found');
      }

      console.log(`[DELETE SERVICE] Found template: id="${dbTemplate.id}", name="${dbTemplate.name}", dbUserId="${dbTemplate.userId}", requestUserId="${userId}"`);
      metadata = {
        id: dbTemplate.id,
        userId: dbTemplate.userId,
        name: dbTemplate.name,
        storageUrl: dbTemplate.storageUrl,
        storageMode: dbTemplate.storageMode,
        resourceUrls: dbTemplate.resources?.map((r: any) => r.storageUrl).filter(Boolean) || [],
        version: dbTemplate.version || 1,
        createdAt: dbTemplate.createdAt,
        updatedAt: dbTemplate.updatedAt
      };

      // Determine effective storage mode from the template's own record
      storageMode = metadata.storageMode === 'seaweedfs' ? 'full' : 'fallback';

      if (metadata.userId !== userId) {
        console.error(`[DELETE SERVICE] Ownership mismatch: metadata.userId="${metadata.userId}" !== requestUserId="${userId}"`);
        throw new Error('Unauthorized');
      }
    } catch (error) {
      log.error({ error, templateId }, 'Failed to load metadata for deletion');
      throw error;
    }

    // Delete from storage
    if (metadata) {
      try {
        if (storageMode === 'full') {
          const s3Service = getS3Service();

          // Delete the template's main JSON from S3
          if (metadata.storageUrl.startsWith('s3://')) {
            const match = metadata.storageUrl.match(/^s3:\/\/([^\/]+)\/(.+)$/);
            if (match) {
              const [, bucket, key] = match;
              await s3Service.deleteObject(bucket, key);
              log.debug({ bucket, key, templateId }, 'Deleted template JSON from S3');
            }
          }

          // Delete any resource files (images, etc.) associated with this template
          if (metadata.resourceUrls && metadata.resourceUrls.length > 0) {
            for (const resourceUrl of metadata.resourceUrls) {
              try {
                const rMatch = resourceUrl.match(/^s3:\/\/([^\/]+)\/(.+)$/);
                if (rMatch) {
                  await s3Service.deleteObject(rMatch[1], rMatch[2]);
                  log.debug({ resourceUrl, templateId }, 'Deleted template resource from S3');
                }
              } catch (rErr) {
                log.warn({ resourceUrl, templateId, err: rErr }, 'Failed to delete resource from S3');
              }
            }
          }
        } else if (metadata.storageUrl.startsWith('fallback://')) {
          // Delete from fallback storage
          const filePath = metadata.storageUrl.replace('fallback://', '');
          const pathParts = filePath.split(/[/\\]/).filter(Boolean);
          const templatesIndex = pathParts.findIndex(part => part === 'templates');

          if (templatesIndex !== -1 && pathParts.length >= templatesIndex + 4) {
            const fbUserEmail = pathParts[templatesIndex + 1];
            const projectName = pathParts[templatesIndex + 2];
            const templateName = pathParts[templatesIndex + 3];

            await fallbackStorageService.deleteTemplate(fbUserEmail, projectName, templateName);
            log.debug({ templateId, templateName }, 'Deleted template from fallback storage');
          }
        }
      } catch (error) {
        log.error({ error, templateId }, 'Failed to delete from storage');
        // Continue with metadata deletion
      }
    }

    // Delete metadata from PostgreSQL
    if (storageMode === 'full' || storageMode === 'fallback') {
      try {
        await templateOperations.deleteTemplate(templateId, userId);
        log.info({ templateId }, 'Template metadata deleted from PostgreSQL');
      } catch (error) {
        log.error({ error, templateId }, 'Failed to delete metadata');
        throw new Error('Failed to delete template');
      }
    }

    // Log deletion event to Cassandra (non-critical)
    if (storageMode === 'full' || storageMode === 'fallback') {
