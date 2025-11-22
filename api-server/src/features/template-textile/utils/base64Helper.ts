/**
 * Helper function to decode base64 data from data URLs
 * Handles both plain base64 and data URL format (data:image/svg+xml;base64,DATA)
 */
export function decodeBase64Data(data: string): Buffer {
  let base64Data = data;
  
  // If it's a data URL, extract the base64 part after the comma
  if (data.includes(',')) {
    const commaIndex = data.indexOf(',');
    base64Data = data.substring(commaIndex + 1);
  }
  
  return Buffer.from(base64Data, 'base64');
}
