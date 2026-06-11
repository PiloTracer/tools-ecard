# Font Management Feature

Google Fonts integration with caching and font metrics storage.

## Overview

Loads, caches, and manages fonts from Google Fonts for use in template designer. Stores font metadata in Cassandra for fast lookups.

## User Stories

- As a user, I want access to Google Fonts in template designer
- As a system, I need to cache fonts for performance
- As a developer, I want font metrics available for text rendering

## Key Workflows

### 1. Font Loading on Startup
1. Server starts
2. Load Google Fonts list from API
3. Store font metadata in Cassandra
4. Cache frequently used fonts locally
5. Fonts available for template designer

### 2. Font Selection in Template
1. User opens font picker
2. Frontend requests font list from API
3. Fonts displayed with preview
4. User selects font
5. Font loaded and applied to text element

## Dependencies

- **Used by:** template-textile
- **External services:** Google Fonts API

## Configuration

- Font cache directory: `.local-fonts/`
- Cassandra keyspace: `ecards_canonical`
