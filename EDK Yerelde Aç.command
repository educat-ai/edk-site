#!/bin/zsh
set -eu
edk_project_root="${0:A:h}"
python3 - "$edk_project_root" <<'PY'
from pathlib import Path
from urllib.request import urlopen
import json
import os
import shutil
import socket
import subprocess
import sys
import time

root = Path(sys.argv[1])
dist = root / 'dist'
expected = (dist / 'index.html').read_bytes()
injection = b'<script src="/__edk_local_test/client.js?v=local-test-1"></script>'
ports = (4187, 4188, 4189)
chosen = None
connection = Path('/Users/erencinar/Library/Application Support/EDK Local Test/connection.json')

def fetch(url):
    with urlopen(url, timeout=2) as response:
        if response.status != 200:
            raise ValueError('Not ready')
        return response.read()

def matches_test(address):
    try:
        state = json.loads(fetch(address + 'api/test-status'))
        return state.get('ready') is True and state.get('mode') == 'local-test' and fetch(address).replace(injection, b'', 1) == expected
    except Exception:
        return False

def matches_preview(address):
    try:
        return fetch(address) == expected
    except Exception:
        return False

def available(port):
    with socket.socket() as check:
        try:
            check.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False

if connection.exists():
    for port in ports:
        address = f'http://127.0.0.1:{port}/'
        if matches_test(address):
            chosen = address
            break
    if not chosen:
        node = shutil.which('node') or next((p for p in ('/opt/homebrew/bin/node', '/usr/local/bin/node') if os.access(p, os.X_OK)), None)
        if not node:
            sys.exit('EDK yerel test için mevcut Node çalıştırıcısı bulunamadı.')
        for port in ports:
            if not available(port):
                continue
            env = dict(os.environ)
            env['EDK_LOCAL_PORT'] = str(port)
            process = subprocess.Popen([node, str(root / 'local-test' / 'server.mjs'), '--use-approved-connection'],
                cwd=str(root), env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            address = f'http://127.0.0.1:{port}/'
            for attempt in range(300):
                if matches_test(address):
                    chosen = address
                    break
                if process.poll() is not None:
                    break
                time.sleep(0.1)
            if chosen:
                break
            # A timeout must not leave another test server waiting to start.
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass
            break
    if not chosen:
        sys.exit('EDK yerel test bağlantısı başlatılamadı. Google bağlantısını ve 4187–4189 portlarını kontrol edin. Gönderim etkinleştirilmedi.')
    print('EDK yerel test bu Mac’te açılıyor:', chosen)
else:
    for port in ports:
        address = f'http://127.0.0.1:{port}/'
        if matches_preview(address):
            chosen = address
            break
        if not available(port):
            continue
        process = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(dist)],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        for attempt in range(20):
            if matches_preview(address):
                chosen = address
                break
            if process.poll() is not None:
                break
            time.sleep(0.1)
        if chosen:
            break
    if not chosen:
        sys.exit('EDK yerel önizlemesi başlatılamadı. 4187–4189 portlarını kontrol edin.')
    print('EDK yerel önizleme açılıyor; gönderim kapalı:', chosen)

if os.environ.get('EDK_PREVIEW_NO_OPEN') != '1':
    subprocess.run(['open', chosen], check=True)
PY
