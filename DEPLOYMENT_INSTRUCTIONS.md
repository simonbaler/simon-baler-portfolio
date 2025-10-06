# Deployment Instructions for Render

This document provides instructions to deploy the Flask portfolio project on Render with the correct Python version and settings.

## 1. Specify Python Version

Create a file named `runtime.txt` in the project root with the following content to specify Python 3.11:

```
python-3.11.9
```

Render will use this Python version for the build and runtime.

## 2. Update Requirements

Ensure `requirements.txt` includes all necessary dependencies including `gunicorn` as the WSGI server:

```
Flask==2.3.4
Pillow==10.1.0
requests==2.34.0
gunicorn==20.1.0
```

## 3. Modify Flask App for Production

In `app.py`, update the app run command to use the `PORT` environment variable and disable debug mode:

```python
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
```

## 4. Render Service Settings

- Set the build command to:

```
pip install --upgrade pip setuptools wheel && pip install -r requirements.txt
```

- Set the start command to:

```
gunicorn app:app
```

- Ensure the environment variable `FLASK_SECRET` is set for session security.

## 5. Static Files and Uploads

- The app serves static files from `static/` and uploads to `static/uploads/`.
- Ensure Render has write permissions to `static/uploads/` for file uploads.

## 6. Additional Notes

- The app uses background threads for image processing; ensure Render supports this or consider alternative async processing.
- The admin login credentials are hardcoded; consider securing this for production.
- The chatbot uses environment variable `GEMINI_API_KEY` for advanced features; set this in Render if needed.

---

Following these steps will help you deploy the Flask portfolio app successfully on Render.
