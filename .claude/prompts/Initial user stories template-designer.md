# Template Designer Feature Specification

## User Stories

### Template Creation and Configuration
As a user, I want to create a new template so that I can design custom e-cards/vcards.
- I can select a background image from my resource library or upload a new one
- I can define global settings like phone prefix, website URL, and company information
- I can choose between vcard, qr square, or qr vertical template types
- I can set dimensions for the template (fixed for vcards as shown in reference)
- I can select output format (JPG or PNG)
- I can save my template for future use

### Resource Management
As a user, I want to manage resources so that I can use them in my templates.
- I can upload and organize fonts, icons, and images in my resource library
- Resources are stored in SeaweedFS with proper user/project structure
- I can select from preset assets or my uploaded resources
- I can delete unused resources

### Text Asset Configuration
As a user, I want to configure text assets so that I can display professional information correctly.
- I can select from predefined text fields (Name, Middle Name, Last Name, Second Last Name, Full Name, Position, Company, Phone, Mobile, Extension)
- For each text element, I can set:
  - Font family and size
  - Position (x,y coordinates)
  - Color (primary and secondary)
  - Text fitting behavior (1-line only, multiple lines, word-wrap)
  - Per-word styling rules (e.g., first word in blue, rest in black)
- I can add custom text fields as needed

### Layout Design
As a user, I want to arrange elements visually so that I can create appealing designs.
- I can drag and drop elements onto a canvas
- I can resize and reposition elements
- I can create table containers with configurable rows/columns
  - Tables automatically adjust when data is missing (e.g., empty row removed)
  - Example: Phone/Email/Website table with 2 columns, 3 rows
- I can see real-time previews of my design

### Template Testing
As a user, I want to test my template so that I can verify it works correctly.
- I can input sample data to see how the template renders
- I can generate a test vcard/qr-code directly from the editor
- I can see how the template handles different data scenarios
- I can adjust elements based on test results

### Data Storage and Management
As a user, I want my template data to be properly stored.
- Template configuration is stored in Cassandra with user/project identification
- Resource files are stored in SeaweedFS with proper user/project structure
- I can load previously saved templates
- I can duplicate existing templates to create variations

### Visual Reference
As a user, I want to see examples of good templates.
- I can view reference templates (like the attached CODE Development Group example)
- I can see how text elements should be arranged
- I can see how icons and QR codes integrate with the design