YOU ARE AN EXPERT IN THE OAUTH INTEGRATION PROCESS (read
  /.claude/implementations/OAUTH_IMPLEMENTATION_GUIDE.md)

  1. in .env.dev.example set a URI variable for the user to subscribe through     
  the Tools dashboard at: http://epicdev.com/app/features/user-subscription       
  2. in .env.dev.example Add additional Redirect URI's for Oauth (comma
  separated for single variable maybe) according to the oauth implementation      
  guide.
  3. in .env.dev.example must set the necessary settings for oauth (besides the   
  oauth redirect uris), like client, secret, etc.
  4. if the user authenticates using "Login with Tools Dashboard" the oauth must  
  be performed according to the oauth implementation guide.
  5. Passed this point, the user can only access other pages in the app if he's   
  authenticated
  6. Create the first page for the authenticated user
  7. Once the user is authenticated he's redirected to the new page. 