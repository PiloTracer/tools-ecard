# Batch Import Feature (Placeholder)

## Status: PLACEHOLDER IMPLEMENTATION

This feature provides the API structure for batch import functionality but currently returns mock responses. Full implementation will be completed in a future iteration.

## Purpose
Handles the parsing and importing of batch files (CSV, VCF, TXT) into the system, including field mapping, data validation, and storage in Cassandra.

## API Endpoints (Placeholder)

All endpoints require authentication and currently return placeholder responses.

### Import Batch
```
POST /api/batch-import/{id}/import
Body: {
  mappings: [{
    sourceColumn: string,
    targetField: string,
    transformRule?: string
  }],
  options: {
    skipDuplicates?: boolean,
    validateEmails?: boolean,
    parseNames?: boolean,
    useLLM?: boolean
  }
}
Response: {
  success: true,
  data: {
    batchId: string,
    recordsProcessed: number,
    recordsImported: number,
    recordsFailed: number,
    errors: []
  }
}
```

### Get Import Preview
```
GET /api/batch-import/{id}/preview?limit=5
Response: {
  success: true,
  data: {
    batchId: string,
    records: [ParsedRecord],
    total: number
  }
}
```

### Get Field Mapping Suggestions
```
GET /api/batch-import/{id}/mappings/suggest
Response: {
  success: true,
  data: {
    batchId: string,
    suggestions: [{
      sourceColumn: string,
      targetField: string,
      confidence: number
    }]
  }
}
```

### Validate Import Data
```
POST /api/batch-import/{id}/validate
Body: {
  records: [ParsedRecord]
}
Response: {
  success: true,
  data: {
    batchId: string,
    valid: boolean,
    errors: []
  }
}
```

### Get Import Status
```
GET /api/batch-import/{id}/status
Response: {
  success: true,
  data: {
    batchId: string,
    status: string,
    progress: number,
    recordsProcessed: number,
    recordsImported: number,
    recordsFailed: number
  }
}
```

### Cancel Import
```
POST /api/batch-import/{id}/cancel
Response: {
  success: true,
  data: {
    batchId: string,
    cancelled: boolean
  }
}
```

## Planned Implementation

### Phase 1: File Parsing
- [ ] CSV parser with header detection
- [ ] VCF (vCard) parser
- [ ] Plain text parser with pattern matching
- [ ] Excel file support (XLSX)

### Phase 2: Field Mapping
- [ ] Automatic field detection
- [ ] Custom mapping rules
- [ ] Transformation functions
- [ ] Default value handling

### Phase 3: Data Validation
- [ ] Email validation
- [ ] Phone number formatting
- [ ] Required field checking
- [ ] Duplicate detection

### Phase 4: LLM Integration
- [ ] Name parsing with OpenAI/Anthropic
- [ ] Organization extraction
- [ ] Smart field matching
- [ ] Credit system integration

### Phase 5: Storage
- [ ] Cassandra batch_records table
- [ ] Efficient bulk inserts
- [ ] Transaction support
- [ ] Error recovery

### Phase 6: Job Processing
- [ ] Background job handler
- [ ] Progress tracking
- [ ] Cancellation support
- [ ] Retry logic

## Data Flow (Future)

```
1. User uploads file → batch-upload feature
2. File saved to SeaweedFS → batch record created
3. User initiates import → batch-import triggered
4. File fetched from storage → parsed based on type
5. Field mappings applied → data validated
6. Records saved to Cassandra → status updated
7. WebSocket notifications → UI updates
```

## Integration Points

### Dependencies
- `batch-upload`: Provides file storage and batch tracking
- `storage-service`: SeaweedFS integration
- `queue-service`: Job processing
- `llm-service`: Name parsing (future)

### Database
- PostgreSQL: Batch metadata
- Cassandra: Parsed records storage
- Redis: Job queue and caching

## Configuration

Required environment variables:
```bash
# Cassandra
CASSANDRA_HOSTS=cassandra
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=ecards_canonical

# LLM (future)
LLM_ENABLED=true
LLM_PRIMARY_PROVIDER=openai
OPENAI_API_KEY=...

# Import limits
MAX_RECORDS_PER_BATCH=10000
MAX_IMPORT_WORKERS=4
```

## Testing Strategy

### Unit Tests
- File parser logic
- Field mapping algorithms
- Validation rules
- Transformation functions

### Integration Tests
- End-to-end import flow
- Database operations
- Job processing
- Error handling

## Error Handling

### Common Errors
- `INVALID_FILE_FORMAT`: Unsupported file type
- `PARSING_ERROR`: Failed to parse file
- `VALIDATION_ERROR`: Data validation failed
- `STORAGE_ERROR`: Database operation failed
- `QUOTA_EXCEEDED`: User limit reached

## Performance Considerations

- Streaming file parsing for large files
- Batch database inserts (100 records at a time)
- Parallel processing workers
- Memory-efficient data handling

## Security

- File content sanitization
- SQL injection prevention
- Rate limiting per user
- File size restrictions

## Future Enhancements

1. **Smart Parsing**
   - AI-powered field detection
   - Multi-language support
   - Complex format handling

2. **Advanced Validation**
   - Custom validation rules
   - Cross-field validation
   - External API validation

3. **Data Enrichment**
   - Company lookup
   - Social media profiles
   - Address validation

4. **Export Features**
   - Export to various formats
   - Template generation
   - Batch merging

## Notes for Developers

This is a **PLACEHOLDER** implementation. When implementing the full feature:

1. Replace mock responses with actual logic
2. Implement file parsing libraries
3. Set up Cassandra schema and client
4. Integrate with job processing system
5. Add comprehensive error handling
6. Implement progress tracking
7. Add WebSocket notifications
8. Create integration tests

## Related Documentation

- [Batch Upload Feature](../batch-upload/README.md)
- [vCard Fields Schema](../../../shared/types/vcardFields.ts)
- [Cassandra Schema](../../../../db/init-cassandra/05-batch-upload-tables.cql)