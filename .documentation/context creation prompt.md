Based on /pre-CLAUDE_CONTEXT.md
  1. Analyze and acquire understanding of the general project to   
  be initiated.
  2. Adjust the following: the name can be received in separate    
  fields (for example: first name, middle name, last name, second  
  last name), or can be received as a whole (ej: Pilo Cantor       
  Jimente), if the user has credits/rate-limit available, an LLM   
  will decide which is which, if the user has no credits
  available, the name will be presented "AS IS" (as provided, as   
  a whole "name", no parsing) and saved complete in the name       
  field.
  3. Generate "docker-compose.dev.yml" with all the necessary      
  services, including normalized (postgre) and canonical
  (cassandra) databases.
  4. front-cards is a next.js 16 web application which is the      
  only public web application that will be used for this
  application.
  5. The approach for development will be "feature" based.
  6. Any functionality must be identifiable through a feature      
  name. This way context will be managed more specifically and     
  efficiently. This may include shared or global functionalities.  
  7. Keep in mind that the web application must subscribe to       
  external web application (for notifications).
  8. The application will have to access external APIs to verify   
  the user's information and status.
  9. The application will have to use external applications for    
  bucket functionality (seaweedfs)
  10. Generate /CLAUDE_CONTEXT.md for the whole project with all the      
  necessary knowledge, and including (properly stated and
  formatted) these requirements, but not limited to these ones,    
  you can define this more professionally and with more
  completeness.
  11. generate /.claude/SESSION_STARTERS.md with directions on     
  how to open new sessions quickly with necessary context.