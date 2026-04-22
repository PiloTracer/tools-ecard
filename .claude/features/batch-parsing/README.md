# Batch Parsing Feature

Background worker for parsing uploaded batch files into structured contact records.

## Overview

Processes uploaded files (.csv, .txt, .vcf) asynchronously, extracting contact data with LLM-assisted name parsing, and stores records in Cassandra.

## User Stories

- As a system, I need to parse uploaded files in the background
- As a user, I want intelligent name parsing using AI
- As a user, I want to see parsing progress in real-time

## Key Workflows

### 1. Parse Batch File
1. Job picked from Redis queue
2. File fetched from storage
3. File format detected and parser selected
4. Rows extracted and validated
5. Names parsed using LLM (if enabled)
6. Records stored in Cassandra
7. Batch status updated to "parsed"

## Dependencies

- **Depends on:** batch-upload, s3-bucket
- **Used by:** batch-records

## Configuration

- LLM providers: OpenAI, Anthropic, DeepSeek
- Fallback: Parse as-is when LLM unavailable
