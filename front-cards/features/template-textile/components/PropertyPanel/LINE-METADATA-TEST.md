# Line Metadata Testing Guide

## Test URL
http://localhost:7300/template-textile

## Features Implemented

### 1. Type Definitions
- Added `lineGroup`, `requiredFields`, and `linePriority` to BaseElement interface
- All element types (Text, Image, QR, Shape) inherit these properties

### 2. LineMetadataProperties Component
- Created dedicated component for editing line metadata
- Integrated into TextProperties and ImageProperties panels

### 3. Key Features

#### Line Group
- Free text input with datalist suggestions
- Suggestions include:
  - Predefined groups: contact-line-1, contact-line-2, phone-line, email-line, etc.
  - Existing groups from other elements in the template
- Purpose: Group elements that form a functional line

#### Line Priority
- Numeric input (1-100)
- Lower numbers = higher priority
- Purpose: Define order for automatic line reordering during batch generation

#### Required Fields
- Multi-select from vCard fields
- Visual list showing selected fields
- Add/remove functionality
- Shows field ID and placeholder text
- Purpose: Define which vCard fields must have values for the line to be visible

### 4. User Experience
- Metadata section appears at bottom of Text and Image property panels
- Summary shows current metadata configuration
- Field selector dropdown with all vCard fields
- Already selected fields are disabled in dropdown
- Remove button (X) for each required field

## Test Scenarios

### Scenario 1: Basic Line Group
1. Add a Text element to canvas
2. Select the element
3. In Properties panel, scroll to "Line Metadata" section
4. Enter "contact-line-1" in Line Group field
5. Verify autocomplete suggestions appear

### Scenario 2: Required Fields
1. Select an element with line group
2. Click "Add Required Field"
3. Select "work_phone" from dropdown
4. Verify it appears in the list
5. Add another field "mobile_phone"
6. Try to add "work_phone" again - should be disabled
7. Click X to remove a field

### Scenario 3: Multiple Elements Same Group
1. Create an Image element (icon)
2. Create a Text element (label)
3. Give both the same lineGroup (e.g., "phone-line")
4. Set linePriority to 1
5. Add requiredFields: ["work_phone", "work_phone_ext"]

### Scenario 4: Summary Display
1. Configure an element with:
   - lineGroup: "email-line"
   - linePriority: 2
   - requiredFields: ["email"]
2. Verify summary box shows all metadata

## Expected Behavior

### During Template Design
- Metadata is stored with each element
- Elements can share the same lineGroup
- Required fields use vCard field IDs (snake_case)
- No validation logic runs during design

### For Future Batch Processing
The metadata structure enables:
1. **Line Visibility**: Hide entire line if any requiredField is empty
2. **Automatic Reordering**: Sort visible lines by linePriority
3. **Group Operations**: Apply visibility to all elements in same lineGroup

## Data Structure Example
```json
{
  "type": "text",
  "text": "John Doe",
  "lineGroup": "contact-line-1",
  "requiredFields": ["full_name", "business_title"],
  "linePriority": 1,
  ...other properties
}
```

## Success Criteria
✅ Metadata properties added to type definitions
✅ UI components for editing metadata
✅ Suggestions for line groups
✅ vCard field selector with all fields
✅ Visual feedback for selected fields
✅ Summary display of configured metadata
✅ Metadata persists when switching between elements
✅ Compatible with existing template-textile functionality