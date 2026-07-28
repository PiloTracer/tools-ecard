import {
  resolveBatchRecordLimit,
  resolveServerBatchRecordLimit,
} from '../../../src/core/limits/batchRecordLimit';

describe('batchRecordLimit (server)', () => {
  const prevDemo = process.env.DEMO_MODE;
  const prevLimit = process.env.BATCH_RECORD_LIMIT;
  const prevDemoLimit = process.env.BATCH_RECORD_LIMIT_DEMO;

  afterEach(() => {
    if (prevDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prevDemo;
    if (prevLimit === undefined) delete process.env.BATCH_RECORD_LIMIT;
    else process.env.BATCH_RECORD_LIMIT = prevLimit;
    if (prevDemoLimit === undefined) delete process.env.BATCH_RECORD_LIMIT_DEMO;
    else process.env.BATCH_RECORD_LIMIT_DEMO = prevDemoLimit;
  });

  it('resolveServerBatchRecordLimit uses demo env when DEMO_MODE is on', () => {
    process.env.DEMO_MODE = 'true';
    process.env.BATCH_RECORD_LIMIT_DEMO = '25';
    expect(resolveServerBatchRecordLimit(null)).toEqual({
      limit: 25,
      unlimited: false,
      source: 'env',
    });
  });

  it('user override wins over env', () => {
    process.env.DEMO_MODE = 'false';
    process.env.BATCH_RECORD_LIMIT = '5000';
    expect(resolveServerBatchRecordLimit(100)).toEqual({
      limit: 100,
      unlimited: false,
      source: 'user',
    });
  });

  it('resolveBatchRecordLimit falls back to 5000 in production', () => {
    expect(resolveBatchRecordLimit({ isDemo: false })).toEqual({
      limit: 5000,
      unlimited: false,
      source: 'fallback',
    });
  });
});
