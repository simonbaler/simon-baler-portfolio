# Thorough Testing Plan for Flask Portfolio Project

## UI Pages to Test
- Welcome page (language selection)
- Index page (main profile)
- Certifications page
- Snaps page
- Events page
- Gallery page
- Resume page
- Admin login page
- Admin panel page
- 404 error page

## API Endpoints to Test
- GET /api/data - fetch profile data
- POST /api/data - update profile data
- PUT /api/data - update profile data
- DELETE /api/data - reset profile data
- POST /api/upload - upload files (certificates, snaps, profile picture, resume)
- POST /chat - chatbot rule-based responses
- POST /chat-llm - chatbot with Gemini API fallback
- POST /set-lang - set language in session
- GET /stream - server-sent events for background processing

## Admin Features to Test
- Admin login with correct and incorrect credentials
- Admin logout
- Load profile data in admin panel
- Save profile data in admin panel
- Reset profile data to default
- File uploads via admin panel (valid and invalid files)

## Edge Cases and Error Handling
- Unauthorized access to admin routes and APIs
- Invalid file uploads (wrong extensions, no file)
- Invalid API payloads (missing fields, wrong types)
- Session handling and language persistence
- Background processing notifications via SSE

---

Please confirm if I should proceed with this thorough testing plan.
