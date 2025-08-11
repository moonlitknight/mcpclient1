
# Product Requirements Document (PRD)

## 1. Overview
**Project Name**: MCP Client  
**Description**: An MCP client that exposes an HTTP server which accepts chat requests in a JSON payload, returns chat responses in JSON, uses OpenAI for its LLM, and can be configured with MCP servers.  
**Tech Stack**: TypeScript, Jest (testing), Supabase integration  

## 2. Goals & Objectives
- Provide a simple, robust interface for sending prompts to OpenAI via MCP tools.  
- Ensure seamless integration with Supabase for authentication and database operations.  
- Maintain modularity so it can be used with different client-facing applications. This is a key requirement. Each .ts file should address a single concern. For example all OpenAI concerns will be encapsulated in a
single .ts module which will expose a well defined and typed internal API according to an Interface definition such that I can replace it with a Claude or DeppSeek equivalent in the future.

## 3. Non-Goals / Out of Scope
- Does not implement its own LLM—relies entirely on OpenAI.  
- Does not include frontend or UI components.  
- No high-availability clustering in this release.  

## 4. User Stories & Use Cases
1. **As an accounting system**, I want to send a chat prompt so that I can get structured AI output for financial queries.  
2. **As an authenticated Supabase user**, I want to query data through MCP tools securely.  
3. **As a developer**, I want an easy-to-configure `.mcp_config.json` file so I can quickly change MCP servers without code changes.  

## 5. Core Features

### 5.1 MCP Tools Interface
- Tool discovery and execution  
- Result processing and formatting  
- Error handling and logging  
- Configuration via `.mcp_config.json` (same format as `claude_desktop_config.json`).  

## 6. Technical Specifications
The MCP Client is an AI proxy implementing an MCP client, callable from any client-facing application.  
The first integration will be an in-house accounting app, but the project is application-agnostic.  
It will provide extensive `console.log` logging to demonstrate its internal state and status.  

### 6.1 Startup Process
1. Read `.env` file.  
2. Start the HTTP server and listen for requests.  
3. Read `.mcp_config.json` and initialize MCP servers.  
4. Post a test query to OpenAI (“What is the capital of France?”) and log the response.  

### 6.2 HTTP POST Request Flow
1. Parse the JSON payload.  
2. Send the input prompt to OpenAI.  
3. Reply with the raw OpenAI response.  

## 7. Configuration
### 7.1 `.env` Example
```env
HTTP_PORT=3001
OPENAI_KEY=
LLM_TEMPERATURE=0.66
```

### 7.2 `.mcp_config.json` Example
```json
{
  "env": {
    "SUPABASE_PROJECT_REF": "",
    "DATABASE_URL": "",
    "SUPABASE_ANON_KEY": ""
  }
}
```

## 8. JSON Formats
### 8.1 Incoming Request Payload
```json
{
  "text": "some question from the user",
  "supabase_jwt": "an encoded JWT from the supabase cookie"
}
```

## 9. Performance & Scalability Requirements
- Target latency: < 500ms for OpenAI request/response cycle (excluding network delays).  
- Support up to 50 concurrent requests in initial release.  

## 10. Security & Privacy Requirements
- All JWTs must be validated against Supabase.  
- API keys stored securely in `.env` (never logged).  
- No logging of sensitive user input unless explicitly allowed for debugging.  

## 11. Error Handling & Edge Cases
- Supabase unreachable → return HTTP 503 with JSON error.  
- OpenAI timeout → return HTTP 504 with JSON error.  
- Malformed payload → return HTTP 400.  

## 12. Deployment & Hosting Requirements
- Node.js runtime environment (v18+).  
- CI/CD pipeline for automated testing and deployment.  
- Configurable environment variables for deployment targets.  

## 13. Monitoring & Logging
- All requests logged to console in JSON format.  
- Metrics: request count, average latency, error rate.  
- Optional integration with monitoring tools (e.g., Prometheus).  

## 14. Development Requirements
### 14.1 Setup
```bash
pnpm install
```

### 14.2 Build
```bash
pnpm run build
```

### 14.3 Testing
```bash
pnpm test          # Run tests
pnpm test:watch    # Test watcher
pnpm test:coverage # Coverage report
```

## 15. Answered Questions
- Should we add support for multiple LLM providers beyond OpenAI?  
  - no
- Should responses be streamed or returned as a single payload?  
  - single payload
- Will caching be required for repeated queries?  
  - no
