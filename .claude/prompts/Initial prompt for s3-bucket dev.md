I need feature-worker to start working on s3-bucket feature.
  s3-bucket feature will conect to a s3 api compatible cloud bucket storage.
  At the moment we'll use seaweedfs.
  As a reference use these 2 configuration files for the seaweedservice we'll be using:
  .claude\tmp\seaweedfs\init_seaweedfs.py
  .claude\tmp\seaweedfs\seaweedfs_service.py
  This feature only involves building an API service to:
  1. create buckets (directories in the seaweedfs service)
  2. put files in a given bucket/path
  3. retrieve files from a given bucket/path
  4. multi-part uploads for large files
  some more detailed functions
  Authentication & Configuration
  Set endpoint URL (e.g., http://localhost:8333 for SeaweedFS S3 gateway)
  Provide access key and secret key (if authentication is enabled)
  Specify region (often unused with self-hosted S3, but some SDKs require it)
  Bucket Management
  CreateBucket: Create a new bucket
  ListBuckets: List all buckets under the account
  DeleteBucket: Remove an empty bucket
  Object Management
  PutObject: Upload a file/object to a bucket
  GetObject: Download an object by key
  HeadObject: Retrieve metadata of an object without downloading
  DeleteObject: Remove an object from a bucket
  ListObjects (or ListObjectsV2): List objects in a bucket (with optional prefix/delimiter for pseudo-folders)
  Multipart Uploads (for large files)
  CreateMultipartUpload
  UploadPart
  CompleteMultipartUpload
  AbortMultipartUpload

  initially, you might provide setup and plan (you decide what documents are necessary, just include them under .claude structure:
  .claude\features\s3-bucket-feature.md
  and a plan to carry out the whole project with user stories (gherking style) at:
  .claude\plans\s3-bucket-plan.md
  and maybe a prompt guide to put up any agent at speed when initiating new conversations (maybe at: .claude/prompts/s3-bucket-prompt.md
  please generate files that are not too redundant, keep them simple, meaninfull. 

  this feature will be used by multiple features across the application, just make sure it's easy, simple and straight forward for easiest
  integration throughout the application.


  created:
  .claude/features/s3-bucket.md
  .claude/plans/s3-bucket-plan.md
  .claude/prompts/s3-bucket-prompt.md