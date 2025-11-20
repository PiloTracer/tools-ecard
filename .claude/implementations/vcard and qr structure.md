## **Core Contact Fields (All Cards)**
```javascript
// Primary identification
full_name: string          // "John Doe Frakenfort"
first_name: string         // "John"
last_name: string          // "Doe"

// Contact methods
work_phone: string         // "+1 (555) 123-4567"
work_phone_ext: string     // "123"
mobile_phone: string       // "+1 (555) 987-6543"
email: string              // "john.doe@company.com"

// Address (structured)
address_street: string     // "123 Main Street"
address_city: string       // "New York"
address_state: string      // "NY"
address_postal: string     // "10001"
address_country: string    // "USA"

// Social profiles
social_instagram: string   // "@johndoe"
social_twitter: string     // "@johndoe_official"
social_facebook: string    // "johndoe.profile"
```

## **Business Fields (Business Cards)**
```javascript
// Company details
business_name: string         // "Acme Corporation"
business_title: string        // "Senior Developer"
business_department: string   // "Engineering Supervisor"
business_url: string          // "https://acme.com"
business_hours: string        // "Mon-Fri 9AM-5PM EST"

// Business address (optional override)
business_address_street: string    // "456 Business Ave"
business_address_city: string      // "San Francisco"
business_address_state: string     // "CA"
business_address_postal: string    // "94107"
business_address_country: string   // "USA"

// Professional profiles
business_linkedin: string   // "linkedin.com/in/johndoe"
business_twitter: string    // "@acme_official"
```

## **Personal Fields (Personal Cards)**
```javascript
// Personal details
personal_url: string       // "https://johndoe.com"
personal_bio: string       // "Software engineer and photography enthusiast"
personal_birthday: string  // "1990-05-15"
```

## **Implementation Notes**
- Full support of any character (unicode, utf8)
- Use **vCard 4.0 format** (RFC 6350) for maximum compatibility
- For QR codes: Generate **dynamic vCard QR codes** and test on multiple devices
- **Field naming convention**: `category_fieldname` (snake_case, clear prefixes)
- **Required fields**: `full_name`, `email`, `mobile_phone` (minimum for functional contact)
- **Optional fields**: All others - include based on card type and available data