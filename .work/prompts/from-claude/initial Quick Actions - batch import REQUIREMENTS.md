### Batch Upload Feature Requirements  

#### **User Stories**  
1. *As a user*, I want to upload a batch file via drag-and-drop or file selection so I can import multiple contact records (e.g., vCards) in one action.  
2. *As a user*, I want to track the status of my batch upload (e.g., "uploaded," "parsing," "completed," "error") to understand processing progress and take corrective action if needed.  
3. *As a system administrator*, I need batch files to be stored securely in SeaweedFS using the user’s email (not user ID) in the file path to ensure organized, user-specific storage.  
4. *As a system*, I must handle large files (up to 10MB) efficiently during upload to prevent server overload and ensure a smooth user experience.  
5. *As a system*, I need an asynchronous process to automatically trigger batch parsing after upload completion, without blocking the user interface.  

---

#### **Technical Requirements**  
**1. Reusable Upload Component**  
- Implement a standalone drag-and-drop/file selection component supporting single-file uploads (e.g., `.csv`, `.txt`, `.vcf`).  
- Validate file size (≤10MB) and type *before* upload. Reject invalid files with clear user feedback.  
- Design for reuse in future features (e.g., configurable props for `onSuccess`, `onError`, and allowed file types).  

**2. File Storage & Path Structure**  
- Save uploaded files to SeaweedFS under:  
  `buckets/files/batches/{user_email}`  
  - Use the **authenticated user’s email** (e.g., `invoketheoracle@gmail.com`) as the directory name.  
  - Store the original filename as-is (e.g., `contacts.vcf`).  

**3. Normalized Database (Batch Tracking)**  
- Create a `batches` table to store metadata for **tracking and auditing**:  
  | Field             | Type      | Description                                                                 |  
  |-------------------|-----------|-----------------------------------------------------------------------------|  
  | `id`              | UUID      | Unique batch identifier (primary key).                                      |  
  | `user_email`      | String    | Uploader’s email (matches SeaweedFS path).                                  |  
  | `file_name`       | String    | Original filename (e.g., `contacts.vcf`).                                   |  
  | `file_size`       | Integer   | File size in bytes.                                                         |  
  | `file_path`       | String    | Full SeaweedFS path (e.g., `buckets/files/batches/invoketheoracle@gmail.com/contacts.vcf`). |  
  | `status`          | Enum      | Current state: `uploaded`, `parsing`, `parsed`, `loaded`, `error`.          |  
  | `created_at`      | Timestamp | Upload start time.                                                          |  
  | `updated_at`      | Timestamp | Last status update time.                                                    |  
  | `error_message`   | Text      | Details if status = `error` (e.g., "Invalid vCard format").                 |  
  | `processed_at`    | Timestamp | Time when processing completed (nullable).                                  |  
- Ensure the table supports:  
  - Listing batches by user/email.  
  - Filtering by status (e.g., "Show all failed batches").  
  - Auditing timelines (e.g., "How long did parsing take?").  

**4. Canonical Database (Parsed Data)**  
- Create a `batch_records` table to store **parsed contact data** with fields strictly matching `vcardFields.ts` (e.g., `full_name`, `email`, `phone`, `organization`).  
- Each record **must link** to its source batch via `batch_id` (foreign key to `batches.id`).  
- Normalize data to match schema definitions (e.g., split `full_name` into `given_name`/`family_name` if required).  

**5. Asynchronous Processing**  
- After saving the file to SeaweedFS and recording metadata in `batches`, **trigger an asynchronous job** to notify the `batch-parse` feature.  
  - The job must include: `batch_id`, `file_path`, and `user_email`.  
  - Use a lightweight mechanism (e.g., database event, message queue) to decouple upload from parsing.  
- The `batch-parse` feature (to be built later) will:  
  - Fetch the file from SeaweedFS using `file_path`.  
  - Parse data into `batch_records` using `vcardFields.ts` as the schema.  
  - Update the batch status in `batches` (e.g., `parsed` → `loaded`).  

**6. Data Relatability & Integrity**  
- All records in `batch_records` **must** reference a valid `batches.id` to ensure traceability.  
- Maintain referential integrity: Deleting a batch in `batches` cascades to its `batch_records`.  

**7. Error Handling**  
- **Upload failures** (e.g., oversized file, invalid type): Reject immediately, show user error, and *do not create* a `batches` record.  
- **Processing failures** (e.g., invalid vCard data): Update `batches.status` to `error` and populate `error_message` with actionable details (e.g., "Line 42: Missing required field `email`").  

**8. Security & Validation**  
- Authenticate and authorize the user before saving to SeaweedFS or `batches`.  
- Sanitize user-provided filenames to prevent path traversal attacks.  

---

#### **Gaps Addressed**  
- **Status Tracking**: Defined all required fields in `batches` for professional follow-up (e.g., `processed_at`, `error_message`).  
- **Async Workflow**: Specified how `batch-upload` triggers `batch-parse` (via job with `batch_id`/`file_path`).  
- **Data Relatability**: Explicitly linked `batches` and `batch_records` via `batch_id`.  
- **File Handling**: Clarified size limits (10MB), validation rules, and SeaweedFS path structure.  
- **Reusability**: Designed the upload component as a standalone module for future use.  

#### **Out of Scope**  
- Parsing logic (handled in future `batch-parse` feature).  
- User interface for "View Batches" (covered in a separate feature).  
- Template Designer navigation (handled in `template-textile`).  

This structure ensures the AI coding assistant has clear, actionable requirements while leaving implementation details (e.g., queue technology) flexible.