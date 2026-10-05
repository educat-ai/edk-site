#!/bin/zsh
set -eu
edk_preview_root="${0:A:h}/dist"
python3 - "$edk_preview_root" <<'PY'
from pathlib import Path
from urllib.request import urlopen
import os
import socket
import subprocess
import sys
import time

root = Path(sys.argv[1])
expected = (root / 'index.html').read_bytes()
chosen = None

def matches(url):
    try:
        with urlopen(url, timeout=2) as response:
            return response.status == 200 and response.read() == expected
    except Exception:
        return False

for port in (4187, 4188, 4189):
    address = f'http://127.0.0.1:{port}/'
    if matches(address):
        chosen = address
        break
    with socket.socket() as check:
        try:
            check.bind(('127.0.0.1', port))
        except OSError:
            continue
    process = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(root)],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True
    )
    for attempt in range(20):
        if matches(address):
            chosen = address
            break
        if process.poll() is not None:
            break
        time.sleep(0.1)
    if chosen:
        break

if not chosen:
    print('EDK yerel önizlemesi başlatılamadı. 4187–4189 portlarını kontrol edin.', file=sys.stderr)
    sys.exit(1)
print('EDK bu Mac’te açılıyor:', chosen)
if os.environ.get('EDK_PREVIEW_NO_OPEN') != '1':
    subprocess.run(['open', chosen], check=True)
PY
