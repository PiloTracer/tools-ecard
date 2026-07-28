'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { isDemoMode } from '@/features/demo/isDemoMode';
import { apiClient } from '@/shared/lib/api-client';
import { getClientBatchRecordLimit } from '@/shared/lib/batchRecordLimit';

type LimitsApiResponse = {
  success: boolean;
  data: {
    limit: number;
    unlimited: boolean;
  };
};

export function useBatchRecordLimit() {
  const { user, isAuthenticated } = useAuth();
  const clientResolved = useMemo(() => getClientBatchRecordLimit(user), [user]);

  const { data: serverLimit } = useQuery({
    queryKey: ['batch-record-limit'],
    queryFn: async () => {
      const response = await apiClient.get<LimitsApiResponse>('/api/limits/batch-records');
      return response.data;
    },
    enabled: isAuthenticated && !isDemoMode(),
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (serverLimit) {
      return {
        limit: serverLimit.limit,
        unlimited: serverLimit.unlimited,
        source: 'server' as const,
      };
    }
    return clientResolved;
  }, [serverLimit, clientResolved]);
}
