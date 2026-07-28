import {
  BATCH_RECORD_LIMIT_UNLIMITED,
  capBatchRecords,
  extractUserBatchSizeLimit,
  resolveBatchRecordLimit,
} from './batchRecordLimit';

describe('batchRecordLimit', () => {
  it('uses demo fallback 50 when nothing is configured', () => {
    expect(resolveBatchRecordLimit({ isDemo: true })).toEqual({
      limit: 50,
      unlimited: false,
      source: 'fallback',
    });
  });

  it('uses production fallback 5000 when nothing is configured', () => {
    expect(resolveBatchRecordLimit({ isDemo: false })).toEqual({
      limit: 5000,
      unlimited: false,
      source: 'fallback',
    });
  });

  it('reads env limits when set', () => {
    expect(
      resolveBatchRecordLimit({
        isDemo: false,
        envLimitDefault: '2500',
      })
    ).toEqual({
      limit: 2500,
      unlimited: false,
      source: 'env',
    });
  });

  it('ignores invalid env and falls back', () => {
    expect(
      resolveBatchRecordLimit({
        isDemo: true,
        envLimitDemo: 'not-a-number',
      })
    ).toEqual({
      limit: 50,
      unlimited: false,
      source: 'fallback',
    });
  });

  it('user batch_size_limit overrides env', () => {
    expect(
      resolveBatchRecordLimit({
        isDemo: false,
        envLimitDefault: '5000',
        userBatchSizeLimit: 200,
      })
    ).toEqual({
      limit: 200,
      unlimited: false,
      source: 'user',
    });
  });

  it('supports unlimited (-1) from user Access tab', () => {
    expect(
      resolveBatchRecordLimit({
        isDemo: true,
        userBatchSizeLimit: BATCH_RECORD_LIMIT_UNLIMITED,
      })
    ).toEqual({
      limit: -1,
      unlimited: true,
      source: 'user',
    });
  });

  it('extracts batch_size_limit from subscription.features', () => {
    expect(
      extractUserBatchSizeLimit({
        subscription: {
          features: { batch_size_limit: 750 },
        },
      })
    ).toBe(750);
  });

  it('caps records to the resolved limit', () => {
    const { records, truncated, skipped } = capBatchRecords([1, 2, 3, 4, 5], 3);
    expect(records).toEqual([1, 2, 3]);
    expect(truncated).toBe(true);
    expect(skipped).toBe(2);
  });

  it('does not cap when limit is unlimited', () => {
    const input = [1, 2, 3];
    expect(capBatchRecords(input, BATCH_RECORD_LIMIT_UNLIMITED)).toEqual({
      records: input,
      truncated: false,
      skipped: 0,
    });
  });
});
