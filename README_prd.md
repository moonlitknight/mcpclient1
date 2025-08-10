# Product Requirements Document (PRD)

## 1. Overview
**Project Name**: MCP Client  
**Description**: An MCP client that exposes an http server which accepts chat requests in a JSON payload, and return chat responses in JSON, uses OpenAI for its LLM, and can be configured with MCP servers
**Tech Stack**: TypeScript, Jest (testing), Supabase integration  

## 2. Core Features
### 2.1 Supabase Integration
- Database operations (tables: g_journal, g_coa, g_banking, etc.)
- Authentication and authorization. All incoming chat requests 

### 2.2 MCP Tools Interface
- Tool discovery and execution
- Result processing and formatting
- Error handling and logging
- configuration via a .mcp_config.json file with the same format as claude_desktop_config.json


## 3. Technical Specifications
This project can be described as an AI proxy which implements an MCP client. It is designed to be callable from any client facing application. The first such application will be
an in house accounting application, but that should be irrelevant to the this project. 
The project wil provide copious logging on console.log to show its workings and status.

### 3.1 Startup
When the app starts, it should:-
1. Read its .env file
2. Start the http server and listen for requests
3. Read the .mcp_config.json file and initialise all mcp servers
4. Post a simple query to OpenAI "what is the capital of France?" and log the response to prove that all is working

### 3.2 For an http POST request 
1. Parse the JSON payload
2. Send the input prompt to OpenAI
3. Reply to the httpPOST with the raw OpenAI response

## 4 Configuration
### 4.1 .env
HTTP_PORT=3001
OPENAI_KEY=
LLM_TEMPERATURE=0.66


### 4.2 .mcp_config.json
```
env: {
   SUPABASE_PROJECT_REF:
   DATABASE_URL:
   SUPABASE_ANON_KEY:
}
```

## 5. JSON formats
### 5.1 Incoming request payload
```
{
  text: "some question from the user",
  supabase_jwt: "an encoded JWT from the supabase cookie"
}
```

## 6. Development Requirements
### 6.1 Setup
```bash
pnpm install
```

### 6.2 Build
```bash
pnpm run build
```

### 6.3 Testing
```bash
pnpm test          # Run tests
pnpm test:watch    # Test watcher
pnpm test:coverage # Coverage report
```

