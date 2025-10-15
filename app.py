from flask import Flask, render_template, request, jsonify, redirect, url_for, session, Response, stream_with_context
from functools import wraps
import os
import json
from PIL import Image
from werkzeug.utils import secure_filename
import requests
import json
import io
import logging
import threading
import queue
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# optional advanced libs
try:
    import cv2
    CV2_AVAILABLE = True
except Exception:
    cv2 = None
    CV2_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except Exception:
    np = None
    NUMPY_AVAILABLE = False

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except Exception:
    pytesseract = None
    TESSERACT_AVAILABLE = False

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET', 'change-me-please')

# Static profile data used by the chatbot
PROFILE = {
    "name": "BALER SIMON",
    "email": "simonbaler21@gmail.com",
    "phone": "+91 9392867166",
    "location": "Hyderabad, Telangana, India",
    "linkedin": "https://www.linkedin.com/in/simon-baler-60b105384",
    "objective": "Motivated Computer Science student with strong technical, analytical, and problem-solving skills. Experienced in building real-world projects and winning multiple hackathons.",
    "education": "B.Tech in Computer Science & Engineering (Software Engineering) — Siddhartha Institute of Technology and Sciences (2023-2027).",
    "skills": ["Python", "React.js", "HTML", "CSS", "Prompt Engineering", "PowerBI", "Excel", "Git", "SQL"],
    "projects": [
        {
            "title": "College Connect Website",
            "description": "A web platform connecting college students with resources and events.",
            "languages": "HTML, CSS, JavaScript, Python",
            "github": "https://github.com/simonbaler/college-connect",
            "images": [],
            "lottie": ""
        },
        {
            "title": "Intelligent Traffic Management System",
            "description": "An AI-based system for optimizing traffic flow in urban areas.",
            "languages": "Python, OpenCV, TensorFlow",
            "github": "https://github.com/simonbaler/traffic-management",
            "images": [],
            "lottie": ""
        },
        {
            "title": "E-Commerce Website",
            "description": "A full-stack e-commerce platform with user authentication and payment integration.",
            "languages": "React.js, Node.js, MongoDB",
            "github": "https://github.com/simonbaler/ecommerce",
            "images": [],
            "lottie": ""
        },
        {
            "title": "Music Website (Spotify Clone)",
            "description": "A music streaming website mimicking Spotify's interface and features.",
            "languages": "HTML, CSS, JavaScript, API Integration",
            "github": "https://github.com/simonbaler/music-website",
            "images": [],
            "lottie": ""
        }
    ],
    "achievements": ["Winner/Finalist in 3 Hackathons"]
}

# Data persistence path
DATA_PATH = os.path.join(os.path.dirname(__file__), 'data.json')
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
THUMB_FOLDER = os.path.join(UPLOAD_FOLDER, 'thumbs')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(THUMB_FOLDER, exist_ok=True)
ALLOWED_EXT = {'png','jpg','jpeg','gif','webp','bmp','tiff','svg','pdf','doc','docx'}
IMAGE_EXTS = {'png','jpg','jpeg','gif','webp','bmp','tiff','svg'}

def allowed(filename):
    return '.' in filename and filename.rsplit('.',1)[1].lower() in ALLOWED_EXT

def make_thumbnail(src_path, dest_path, size=(400,300)):
    try:
        img = Image.open(src_path)
        img.thumbnail(size)
        img.save(dest_path, optimize=True, quality=85)
    except Exception:
        pass


def enhance_image(path, max_size=(2000,2000)):
    """Simple enhancement: auto-orient, resize to max_size, and apply slight contrast/auto-level."""
    try:
        img = Image.open(path)
        # auto-orient via EXIF
        try:
            from PIL import ExifTags
            exif = img._getexif()
            if exif:
                for k,v in ExifTags.TAGS.items():
                    if v == 'Orientation':
                        orientation_key = k; break
                orient = exif.get(orientation_key, None) if 'orientation_key' in locals() else None
                if orient == 3:
                    img = img.rotate(180, expand=True)
                elif orient == 6:
                    img = img.rotate(270, expand=True)
                elif orient == 8:
                    img = img.rotate(90, expand=True)
        except Exception:
            pass
        img.thumbnail(max_size)
        # slight auto-contrast (low amount)
        try:
            from PIL import ImageOps, ImageEnhance
            img = ImageOps.autocontrast(img, cutoff=1)
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(1.05)
        except Exception:
            pass
        img.save(path, optimize=True, quality=90)
    except Exception:
        pass

    # Note: advanced OpenCV/pytesseract processing is intentionally moved to a background worker
    # to avoid blocking request handlers. See advanced_enhance() below which will be called
    # asynchronously by a worker thread when available.


# Background processing queue & SSE client registry
PROCESS_QUEUE = queue.Queue()
CLIENTS = set()
CLIENTS_LOCK = threading.Lock()

def send_sse(event, data):
    """Push an event to all connected SSE clients (non-blocking)."""
    payload = {'event': event, 'data': data}
    with CLIENTS_LOCK:
        for q in list(CLIENTS):
            try:
                q.put(payload, block=False)
            except Exception:
                pass


def event_stream(client_q):
    try:
        while True:
            msg = client_q.get()
            # format as SSE
            s = ''
            if 'event' in msg:
                s += f"event: {msg['event']}\n"
            s += f"data: {json.dumps(msg['data'], ensure_ascii=False)}\n\n"
            yield s
    except GeneratorExit:
        return


@app.route('/stream')
def stream():
    # Server-Sent Events endpoint
    def gen():
        q = queue.Queue()
        with CLIENTS_LOCK:
            CLIENTS.add(q)
        try:
            # send a welcome ping
            q.put({'event': 'connected', 'data': {'time': time.time()}})
            for chunk in event_stream(q):
                yield chunk
        finally:
            with CLIENTS_LOCK:
                try:
                    CLIENTS.discard(q)
                except Exception:
                    pass
    return Response(stream_with_context(gen()), mimetype='text/event-stream')


def advanced_enhance(path, max_size=(2000,2000)):
    """Advanced processing ported from the previous inline block: uses OpenCV and pytesseract when available.
    This function is safe to call in a background thread and will attempt best-effort processing.
    """
    if not CV2_AVAILABLE:
        return
    try:
        # read with cv2 (keeps orientation after Pillow work)
        if NUMPY_AVAILABLE:
            try:
                im = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
            except Exception:
                im = cv2.imread(path)
        else:
            im = cv2.imread(path)
        if im is None:
            return
        gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        # denoise
        try:
            im = cv2.fastNlMeansDenoisingColored(im,None,10,10,7,21)
        except Exception:
            pass
        # deskew: compute largest contour / minAreaRect
        try:
            blur = cv2.GaussianBlur(gray, (5,5), 0)
            thresh = cv2.adaptiveThreshold(blur,255,cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,11,2)
            contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest = max(contours, key=cv2.contourArea)
                rect = cv2.minAreaRect(largest)
                angle = rect[-1]
                if angle < -45:
                    angle = 90 + angle
                (h, w) = im.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                im = cv2.warpAffine(im, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        except Exception:
            pass

        # OCR-based crop (if tesseract available): find text boxes and crop to union
        if TESSERACT_AVAILABLE:
            try:
                rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb)
                data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT)
                n = len(data.get('level', []))
                xs, ys, xe, ye = [], [], [], []
                for i in range(n):
                    try:
                        x = int(data['left'][i]); y = int(data['top'][i]); w = int(data['width'][i]); h = int(data['height'][i]);
                        conf = int(float(data['conf'][i])) if str(data['conf'][i]).strip() not in ['', 'nan'] else -1
                    except Exception:
                        conf = -1
                    if conf > 30:
                        xs.append(x); ys.append(y); xe.append(x+w); ye.append(y+h)
                if xs and ys and xe and ye:
                    x1, y1, x2, y2 = min(xs), min(ys), max(xe), max(ye)
                    padx = int((x2-x1)*0.06); pady = int((y2-y1)*0.06)
                    x1 = max(0, x1-padx); y1 = max(0, y1-pady); x2 = min(im.shape[1], x2+padx); y2 = min(im.shape[0], y2+pady)
                    im = im[y1:y2, x1:x2]
            except Exception:
                pass

        # final resize to max_size
        try:
            h, w = im.shape[:2]
            scale = min(max_size[0]/w, max_size[1]/h, 1.0)
            if scale < 1.0:
                im = cv2.resize(im, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
        except Exception:
            pass

        # write back (use imencode to handle unicode paths)
        try:
            ext = os.path.splitext(path)[1].lower()
            success, encimg = cv2.imencode(ext, im)
            if success:
                with open(path, 'wb') as f:
                    f.write(encimg.tobytes())
        except Exception:
            try:
                cv2.imwrite(path, im)
            except Exception:
                pass
    except Exception as e:
        logging.exception('advanced enhance failed: %s', e)


def _worker_loop():
    while True:
        try:
            task = PROCESS_QUEUE.get()
            if task is None:
                break
            path = task.get('path')
            kind = task.get('kind')
            name = task.get('name')
            # perform advanced processing
            advanced_enhance(path)
            # re-generate thumbnail (best-effort)
            try:
                thumb_path = os.path.join(THUMB_FOLDER, os.path.basename(path))
                make_thumbnail(path, thumb_path)
            except Exception:
                pass
            # notify clients that processing finished for this item
            try:
                payload = {'kind': kind, 'name': name, 'url': f"/static/uploads/{os.path.basename(path)}", 'thumb': f"/static/uploads/thumbs/{os.path.basename(path)}"}
                send_sse('processed', payload)
            except Exception:
                pass
        except Exception:
            logging.exception('worker exception')


# start worker thread
WORKER_THREAD = threading.Thread(target=_worker_loop, daemon=True)
WORKER_THREAD.start()


def load_data():
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return PROFILE.copy()
    else:
        # write default
        save_data(PROFILE)
        return PROFILE.copy()


def save_data(obj):
    with open(DATA_PATH, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def answer_bot(message: str) -> str:
    if not message:
        return "Hi — ask me about skills, projects, education, achievements, or contact details."
    m = message.lower()
    # greetings
    if any(w in m for w in ["hello","hi","hey","greetings"]):
        return f"Hi, I'm {PROFILE.get('name')} — ask me about skills, projects or contact details."
    # contact
    if any(w in m for w in ["email","mail","gmail","contact email"]):
        return f"Email: {PROFILE.get('email')}"
    if any(w in m for w in ["phone","call","contact number","mobile"]):
        return f"Phone: {PROFILE.get('phone')}"
    if "linkedin" in m:
        return f"LinkedIn: {PROFILE.get('linkedin')}"
    # personal / location
    if any(w in m for w in ["where","location","hyderabad","city"]):
        return PROFILE.get('location')
    # objective/education
    if any(w in m for w in ["objective","goal","seeking"]):
        return PROFILE.get('objective')
    if any(w in m for w in ["education","college","degree","school"]):
        return PROFILE.get('education')
    # lists
    if any(w in m for w in ["skill","skills","tech","technologies"]):
        return ", ".join(load_data().get('skills', []))
    if any(w in m for w in ["project","portfolio"]):
        projects = load_data().get('projects', [])
        titles = [p.get('title', str(p)) for p in projects]
        return "Projects: " + ", ".join(titles)
    if any(w in m for w in ["certificate","certificates"]):
        certs = load_data().get('certificates', [])
        if certs: return "Certificates: " + ", ".join([c.get('name') if isinstance(c, dict) else str(c) for c in certs])
        return "No certificates listed yet."
    if any(w in m for w in ["snap","photo","image","gallery"]):
        snaps = load_data().get('snaps', [])
        return f"I have {len(snaps)} snaps. Visit the Snaps page to view them." if snaps else "No snaps available yet."
    if any(w in m for w in ["hackathon","award","achievement"]):
        return ", ".join(load_data().get('achievements', []))
    # fallback
    return "I can share info about education, skills, projects, achievements, or contact details. Try: 'skills', 'projects', or 'email'."


@app.context_processor
def inject_ui_mode():
    try:
        data = load_data()
        m = data.get('ui_mode') or ''
        return {'UI_MODE': f"mode-{m}" if m else ''}
    except Exception:
        return {'UI_MODE': ''}

# simple auth decorator
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('admin'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated


@app.route('/admin')
@admin_required
def admin():
    data = load_data()
    return render_template('admin.html', data=data)


@app.route('/admin/login', methods=['GET','POST'])
def admin_login():
    if request.method == 'GET':
        return render_template('admin_login.html')
    body = request.form or {}
    username = body.get('username')
    password = body.get('password')
    if username == 'Nani@2821' and password == 'Nani@2821':
        session['admin'] = True
        return redirect(url_for('admin'))
    return render_template('admin_login.html', error='Invalid credentials')


@app.route('/admin/logout')
def admin_logout():
    session.pop('admin', None)
    return redirect(url_for('index'))


@app.route('/api/data', methods=['GET','POST','PUT','DELETE'])
@admin_required
def api_data():
    if request.method == 'GET':
        data = load_data()
        return jsonify(data)
    if request.method in ('POST','PUT'):
        obj = request.get_json() or {}
        # Normalize incoming payload to preserve lottie/description fields and ensure
        # arrays like certificates/snaps/events are objects with consistent shape.
        def normalize_items(arr):
            if not arr or not isinstance(arr, list):
                return []
            out = []
            for it in arr:
                if isinstance(it, str):
                    out.append({'name': it})
                elif isinstance(it, dict):
                    item = it.copy()
                    # preserve lottie if present and non-empty
                    l = it.get('lottie')
                    if isinstance(l, str) and l.strip():
                        item['lottie'] = l
                    # preserve description if present and non-empty
                    d = it.get('description')
                    if isinstance(d, str) and d.strip():
                        item['description'] = d
                    out.append(item)
                else:
                    out.append(it)
            return out

        # normalize specific collections
        try:
            if 'certificates' in obj:
                obj['certificates'] = normalize_items(obj.get('certificates'))
            if 'snaps' in obj:
                obj['snaps'] = normalize_items(obj.get('snaps'))
            if 'events' in obj:
                obj['events'] = normalize_items(obj.get('events'))
            # projects should be arrays of dicts; convert strings to dicts if needed
            if 'projects' in obj and isinstance(obj.get('projects'), list):
                proj = []
                for p in obj.get('projects'):
                    if isinstance(p, str):
                        proj.append({"title": p, "description": "", "languages": "", "github": "", "images": [], "lottie": ""})
                    elif isinstance(p, dict):
                        proj.append(p)
                obj['projects'] = proj
            if 'skills' in obj and isinstance(obj.get('skills'), list):
                skl = []
                for s in obj.get('skills'):
                    if isinstance(s, str):
                        skl.append(s)
                    elif isinstance(s, dict):
                        skl.append(s.get('name', str(s)))
                obj['skills'] = [x for x in skl if x]
        except Exception:
            pass

        save_data(obj)
        # Notify connected clients about UI mode change so public pages can update live
        try:
            ui = obj.get('ui_mode')
            if ui:
                send_sse('ui_mode', {'mode': ui})
        except Exception:
            pass
        return jsonify({'ok': True})
    if request.method == 'DELETE':
        kind = request.form.get('kind', 'cert')
        save_data(PROFILE)
        return jsonify({'ok': True})


@app.route('/contact', methods=['POST'])
def contact():
    data = request.form or {}
    name = data.get('from_name', '').strip()
    user_email = data.get('from_email', '').strip()
    message_text = data.get('message', '').strip()
    if not all([name, user_email, message_text]):
        return jsonify({'ok': False, 'error': 'Missing required fields'}), 400
    # Profile email
    profile = load_data()
    to_email = profile.get('email', 'simonbaler21@gmail.com')
    from_email = to_email  # Use same for sender
    subject = f"New Contact Form Message from {name}"
    body = f"Name: {name}\nEmail: {user_email}\nMessage:\n{message_text}"
    # SMTP setup
    smtp_server = 'smtp.gmail.com'
    smtp_port = 587
    password = os.environ.get('EMAIL_PASSWORD')
    if not password:
        return jsonify({'ok': False, 'error': 'Email configuration missing'}), 500

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(from_email, password)
        text = msg.as_string()
        server.sendmail(from_email, to_email, text)
        server.quit()

        return jsonify({'ok': True, 'message': 'Email sent successfully'})
    except Exception as e:
        print(f'Email error: {e}')
        return jsonify({'ok': False, 'error': 'Failed to send email'}), 500


@app.route('/events')
def events():
    data = load_data()
    events = data.get('events', [])
    return render_template('events.html', events=events)


@app.route('/gallery')
def gallery():
    return render_template('gallery.html')


@app.route('/resume')
def resume():
    data = load_data()
    resume = data.get('resume', {})
    return render_template('resume.html', resume=resume)


@app.route('/projects')
def projects():
    data = load_data()
    projects = data.get('projects', [])
    return render_template('projects.html', profile=data, projects=projects)

@app.errorhandler(404)
def page_not_found(e):
    # render a friendly 404 page that matches the site style
    return render_template('404.html'), 404


@app.route('/')
def index():
    data = load_data()
    lang = session.get('lang', 'english')
    return render_template('index.html', profile=data, lang=lang)


@app.route('/welcome')
def welcome():
    return render_template('welcome.html')
    
@app.route('/set-lang', methods=['POST'])
def set_lang():
    data = request.get_json() or {}
    lang = data.get('lang') or 'english'
    session['lang'] = lang
    return jsonify({'ok': True, 'lang': lang})

@app.route('/set-user-info', methods=['POST'])
def set_user_info():
    data = request.get_json() or {}
    role = data.get('role')
    name = data.get('name', '').strip()
    details = data.get('details', {})
    if not role or not name:
        return jsonify({'ok': False, 'error': 'Missing role or name'}), 400
    session['user_info'] = {
        'role': role,
        'name': name,
        'details': details,
        'lang': session.get('lang', 'english')
    }
    return jsonify({'ok': True})

@app.route('/api/user-info', methods=['GET'])
def api_user_info():
    return jsonify(session.get('user_info', {}))

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    message = data.get('message', '')
    # use persisted profile data for answers
    profile = load_data()
    reply = answer_bot(message)
    return jsonify({"reply": reply})


@app.route('/chat-llm', methods=['POST'])
def chat_llm():
    data = request.get_json() or {}
    message = data.get('message', '')
    # Prefer Gemini/Google Generative if GEMINI_API_KEY present
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if gemini_key:
        try:
            # call Google Generative API (simple text generation)
            url = 'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generate'
            headers = {'X-Goog-Api-Key': gemini_key, 'Content-Type': 'application/json'}
            # include short profile summary as context
            profile = load_data()
            projects = profile.get('projects', [])
            titles = [p.get('title', str(p)) for p in projects]
            summary = f"Name: {profile.get('name')}\nLocation: {profile.get('location')}\nSkills: {', '.join(profile.get('skills',[]))}\nProjects: {', '.join(titles)}\nContact: {profile.get('email')} | {profile.get('phone')}"
            prompt_text = f"You are a concise assistant that answers questions about the following profile:\n{summary}\nUser: {message}\nAnswer in one or two short sentences."
            body = {"prompt": {"text": prompt_text}, "maxOutputTokens": 256}
            r = requests.post(url, headers=headers, json=body, timeout=10)
            if r.ok:
                jr = r.json()
                # attempt to extract the generated text
                text = jr.get('candidates',[{}])[0].get('content','') if isinstance(jr.get('candidates'), list) else ''
                if text:
                    return jsonify({'reply': text.strip()})
        except Exception as e:
            print('Gemini error', e)
    # fallback to rule-based
    return chat()

if __name__ == '__main__':
    app.run(debug=True)
