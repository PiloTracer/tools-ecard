import { prisma } from '@/core/database/prisma';
import { Batch, BatchStatus, Prisma } from '@prisma/client';
import { BatchCreateData, BatchUpdateData, ListBatchesQuery } from '../types';

export class BatchRepository {
  async create(data: BatchCreateData): Promise<Batch> {
    return await prisma.batch.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        projectId: data.projectId,
        projectName: data.projectName,
        fileName: data.fileName,
        fileSize: data.fileSize,
        filePath: data.filePath,
        status: data.status || BatchStatus.UPLOADED,
      },
    });
  }

  async findById(id: string): Promise<Batch | null> {
    return await prisma.batch.findUnique({
      where: { id },
    });
  }

  async findByUserId(
    userId: string,
    query: ListBatchesQuery
  ): Promise<{ batches: Batch[]; total: number }> {
    const { status, page = 1, limit = 20 } = query;

    const where: Prisma.BatchWhereInput = {
      userId,
      ...(status && { status }),
    };

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.batch.count({ where }),
    ]);

    return { batches, total };
  }

  async update(id: string, data: BatchUpdateData): Promise<Batch> {
    return await prisma.batch.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
        ...(data.processedAt !== undefined && { processedAt: data.processedAt }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.batch.delete({
      where: { id },
    });
  }

  async findByUserIdAndId(userId: string, id: string): Promise<Batch | null> {
    return await prisma.batch.findFirst({
      where: {
        id,
        userId,
      },
    });
  }

  async updateStatus(
    id: string,
    status: BatchStatus,
    errorMessage?: string
  ): Promise<Batch> {
    const data: BatchUpdateData = {
      status,
      ...(errorMessage && { errorMessage }),
      ...(status === BatchStatus.PARSED || status === BatchStatus.LOADED
        ? { processedAt: new Date() }
        : {}),
    };

    return await this.update(id, data);
  }

  async getRecentBatches(
    userId: string,
    limit: number = 5
  ): Promise<Batch[]> {
    return await prisma.batch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBatchStats(userId: string): Promise<{
    total: number;
    uploaded: number;
    parsing: number;
    parsed: number;
    loaded: number;
    error: number;
  }> {
    const stats = await prisma.batch.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const result = {
      total: 0,
      uploaded: 0,
      parsing: 0,
      parsed: 0,
      loaded: 0,
      error: 0,
    };

    stats.forEach((stat) => {
      const count = stat._count;
      result.total += count;

      switch (stat.status) {
        case BatchStatus.UPLOADED:
          result.uploaded = count;
          break;
        case BatchStatus.PARSING:
          result.parsing = count;
          break;
        case BatchStatus.PARSED:
          result.parsed = count;
          break;
        case BatchStatus.LOADED:
          result.loaded = count;
          break;
        case BatchStatus.ERROR:
          result.error = count;
          break;
      }
    });

    return result;
  }
}

// Export singleton instance
export const batchRepository = new BatchRepository();