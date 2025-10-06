# Baler Simon — Portfolio Website

This repository is a minimal portfolio website built with HTML, CSS, JavaScript and a small Python (Flask) backend that provides a simple chatbot answering questions about the profile.

Features
- Modern animated UI (CSS) and responsive layout
- Chatbot widget that answers common profile questions
- Flask backend serving content and chat endpoint

Quick start (Windows)

1. Create a virtual environment and activate it (cmd.exe):

```
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies:

```
pip install -r requirements.txt
```

3. Run the app:

```
python app.py
```

4. Open http://127.0.0.1:5000 in your browser.
 
 - New welcome flow: visiting the site first shows a welcome popup with language selection and speech. You can skip or pick a language.
 - Additional pages: Certifications (`/certifications`), Snaps (`/snaps`), Events (`/events`), Gallery (`/gallery`), Resume (`/resume`). Each page has its own stylesheet in `static/css`.
 - Admin panel: visit `/admin/login` and login with username: `Nani@2821` and password: `Nani@2821`. The admin panel allows loading/saving the profile JSON via `/api/data` and will persist it to `data.json`.

 Admin actions
 - Load — fetch current `data.json` and display it.
 - Save — overwrite `data.json` with the JSON in the textarea (used to add skills, projects, certificates, etc.).
 - Reset Default — revert `data.json` to the default profile values.

Generative Chatbot (Gemini)
- This project prefers the Gemini (Google Generative) API when the `GEMINI_API_KEY` environment variable is set.
- To enable it, set `GEMINI_API_KEY` in your environment and restart the app. Example (Windows cmd):

```
set GEMINI_API_KEY=your_api_key_here
python app.py
```

- If no key is present, the chatbot falls back to the local rule-based responder.

Gemini (Google Generative) key and prompt context
- If you set `GEMINI_API_KEY` in your environment, the `/chat-llm` endpoint will call the Gemini/Generative API and include a short summary of the `data.json` profile in the prompt so the assistant answers with context.
- Do NOT commit your API key to the repository. Use environment variables or a secure secrets manager. Example to run locally (Windows cmd):

```
set GEMINI_API_KEY=AIzaSy...YOUR_KEY... 
python app.py
```

The server will fallback to the improved rule-based responder if the Gemini call fails or no key is provided.

Uploads
- Admin can upload certificate and snap images via the Admin UI. Files are saved to `static/uploads/` and thumbnails to `static/uploads/thumbs/`.
- Thumbnails are generated using Pillow. Ensure you install the requirements:

```
pip install -r requirements.txt
```

Responsive UI and Themes
- The site is responsive and includes a theme toggle (dark/light). The toggle is persisted in localStorage.


Notes and next steps
- The chatbot is rule-based and uses static profile data in `app.py`. For more advanced conversational behavior, integrate an LLM or knowledge-base search.
- Improve accessibility, add contact form (with email service), and add real project pages with links and screenshots.
