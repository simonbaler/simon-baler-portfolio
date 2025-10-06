import json
import os
import tempfile
import shutil

import pytest
from pathlib import Path

# These tests assume the Flask app is imported from app.py and configured for testing

def test_ui_mode_roundtrip(tmp_path):
    repo = Path(__file__).resolve().parents[1]
    data_path = repo / 'data.json'
    # snapshot original
    orig = data_path.read_text(encoding='utf-8')
    try:
        # write a temporary modified file via the API using requests to the running server
        # This test expects the dev server to be running on http://127.0.0.1:5000
        import requests
        url = 'http://127.0.0.1:5000/api/data'
        payload = json.loads(orig)
        # pick a mode to test
        payload['ui_mode'] = 'glam'
        r = requests.put(url, json=payload, timeout=5)
        assert r.status_code == 200
        jr = r.json()
        assert jr.get('ok') is True
        # fetch back
        r2 = requests.get(url, timeout=5)
        assert r2.status_code == 200
        data = r2.json()
        assert data.get('ui_mode') == 'glam'
    finally:
        # restore original data.json
        data_path.write_text(orig, encoding='utf-8')

if __name__ == '__main__':
    pytest.main(['-q', str(__file__)])
