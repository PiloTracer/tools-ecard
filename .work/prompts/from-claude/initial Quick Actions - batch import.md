feature:  batch-upload
help me buld requirements including user stories.
A. Miscellaneous:
1. "Template Designer" must direct to "template-textile" feature (example: http://localhost:7300/template-textile)
B. "Batch Import" button, initiates with feature "batch-upload":
2. Upload batches is a One-File drag and drop or File select feature, that's properly encapsulated into a component.
3. the file loaded is saved into seaweedfs as follows:
 buckets/files/batches/invoketheoracle@gmail.com
we're using the username instead of user id in the path.
4. the process of uploading a file requires proper handling, prepare for large files (up to 10MB or whatever recommended), and saving that information in the normalized database.  If additional metadata is required, you can add it to canonical database.
5. WHAT IS THE BEST/SIMPLEST WAY TO HAVE AN ASYNCHRONOUS INDEPENDENT PROCESS to pick up that file, and process it to import the data. Maybe later work in feature "batch-parse" which will receive a notification created at "batch-upload"
6. Prepare canonical database to receive the main batch data. Batch data is a collection of objects resulting from parsing the source data and addapted to the data available, but fields defined are restricted to vcardFields.ts attached.
7. obvoiusly, the data must be relateable between the canonical and normalized databases.
8. Information in the normalized database must be enough to list the batches uploaded, find out their status, etc. (include enough information that allows professional follow up on the batches, for example: is it read, is it parsed, is it loaded, is it active, recommend all fields)
9. The drag and drop component will be reused in the next feature to work on. Right now, we need to layout the foundation and complete the file uploading functionality, just consider this process will be available somewhere else in the application later.

provide professional requirement, fill in the gaps, this will be used by AI coding assistant to implement the feature.

don't give me code or specific strategies, just help me present the requirement, properly explained and simple to understand for the AI Coding Assistant.


*****************************

this session must be fully handled by agent
  "feature-worker", who will be in charge of implementing 2   
  features: batch-upload (full feature), batch-import (place  
  holder with endpoints, this will be completed later)        
  The requirements are at: ".claude\prompts\initial Quick     
  Actions - batch import REQUIREMENTS.md"
  Proceed with task unattended.
  You can create all necessary database growndwork, any new   
  schemas/models will be created on application start only    
  if they do not exist. 