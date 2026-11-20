#!/usr/bin/env python3
"""Craf — a small drawing desk that speaks to Nott.

Runs a local studio at http://127.0.0.1:7317 and bridges into the Nott
installation found on this machine (notebook, file library, palette).

    python craf.py            serve only
    python craf.py --open     serve and open the app window
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
LIB = ROOT / "library"
PORT = int(os.environ.get("CRAF_PORT", "7317"))
NOTT = Path(os.environ.get("CRAF_NOTT", r"C:\Users\admin\OneDrive\Documents\AZnote"))
MAX_BODY = 96 * 1024 * 1024

LIB.mkdir(exist_ok=True)
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/jpeg", ".jpg")


# --------------------------------------------------------------------------- nott

def _read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def _safe_name(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]+', "", str(name or "")).strip()
    name = re.sub(r"\s+", " ", name)
    return name[:90]


def nott_palette() -> list[dict]:
    """Read the live accent colours out of Nott's stylesheet."""
    css = NOTT / "ui" / "renderer" / "style.css"
    try:
        text = css.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []
    keys = ["--accent", "--accent-2", "--accent-3", "--ok", "--warn", "--error"]
    seen, out = set(), []
    for key in keys:
        m = re.search(re.escape(key) + r"\s*:\s*(#[0-9a-fA-F]{6})", text)
        if m:
            hexv = m.group(1).lower()
            if hexv not in seen:
                seen.add(hexv)
                out.append({"name": key.lstrip("-").replace("-", " "), "hex": hexv})
    return out


def nott_notes(limit: int = 8) -> list[dict]:
    folder = NOTT / "notes" / "notebook"
    rows = []
    try:
        for p in folder.glob("*.md"):
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
            title = lines[0].lstrip("# ").strip() if lines else p.stem
            snippet = next((ln for ln in lines[1:] if not ln.startswith("#")), "")
            rows.append({
                "name": p.name,
                "title": title[:80],
                "snippet": re.sub(r"\[[^\]]*\]\([^)]*\)", "", snippet)[:110],
                "mtime": p.stat().st_mtime,
            })
    except Exception:
        pass
    rows.sort(key=lambda r: r["mtime"], reverse=True)
    return rows[:limit]


def nott_images(limit: int = 24) -> list[dict]:
    folder = NOTT / "notes" / "files"
    rows = []
    try:
        for p in folder.iterdir():
            if p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
                continue
            try:
                st = p.stat()
            except Exception:
                continue
            rows.append({"name": p.name, "size": st.st_size, "mtime": st.st_mtime})
    except Exception:
        pass
    rows.sort(key=lambda r: r["mtime"], reverse=True)
    return rows[:limit]


CACHE = ROOT / ".cache"
CACHE.mkdir(exist_ok=True)


def nott_thumb(name: str) -> Path | None:
    """Small cached preview for a Nott image (some are camera-sized)."""
    src = (NOTT / "notes" / "files" / name).resolve()
    root = (NOTT / "notes" / "files").resolve()
    if root not in src.parents or not src.is_file():
        return None
    key = str(abs(hash((name, int(src.stat().st_mtime)))))
    out = CACHE / f"nott-{key}.jpg"
    if out.exists():
        return out
    try:
        from PIL import Image  # type: ignore
        im = Image.open(src)
        im.thumbnail((420, 420))
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(out, "JPEG", quality=82)
        return out
    except Exception:
        return None


def nott_info() -> dict:
    ok = (NOTT / "nott.py").exists()
    if not ok:
        return {"ok": False, "root": str(NOTT), "reason": "Không tìm thấy Nott"}
    cfg = _read_json(NOTT / "config.json", {})
    groups = cfg.get("groups") or []
    group = next((g.get("name", "") for g in groups if g.get("enabled")), cfg.get("group_name", ""))
    return {
        "ok": True,
        "root": str(NOTT),
        "name": cfg.get("me_name", ""),
        "group": group,
        "palette": nott_palette(),
        "notes": nott_notes(),
        "images": nott_images(),
        "launcher": str(NOTT / "Nott.lnk") if (NOTT / "Nott.lnk").exists() else "",
    }


def projects() -> list[dict]:
    out = []
    for p in LIB.glob("*.json"):
        try:
            meta = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        pid = p.stem
        thumb = LIB / f"{pid}.jpg"
        out.append({
            "id": pid,
            "name": meta.get("name", "Không tên"),
            "w": meta.get("w", 0),
            "h": meta.get("h", 0),
            "updatedAt": meta.get("updatedAt", int(p.stat().st_mtime * 1000)),
            "thumb": f"/library/{pid}.jpg" if thumb.exists() else "",
        })
    out.sort(key=lambda r: r["updatedAt"], reverse=True)
    return out


# --------------------------------------------------------------------------- server

class Handler(BaseHTTPRequestHandler):
    server_version = "Craf/1.0"

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    def _send(self, code: int, body: bytes, ctype: str = "application/json; charset=utf-8",
              cache: str = "no-store"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, data, code: int = 200):
        self._send(code, json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _err(self, msg: str, code: int = 400):
        self._json({"ok": False, "error": msg}, code)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            raise ValueError("body")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _static(self, rel: str, cache: str = "no-store"):
        path = (ROOT / rel).resolve()
        if ROOT not in path.parents or not path.is_file():
            return self._send(404, b"not found", "text/plain; charset=utf-8")
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self._send(200, path.read_bytes(), ctype, cache)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)
        qs = urllib.parse.parse_qs(parsed.query)
        if path in ("/", "/index.html"):
            return self._static("app/index.html")
        if path.startswith("/app/"):
            return self._static(path[1:])
        if path.startswith("/library/"):
            name = path[len("/library/"):]
            if not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
                return self._send(404, b"no", "text/plain")
            target = (LIB / name).resolve()
            if LIB not in target.parents or not target.is_file():
                return self._send(404, b"no", "text/plain")
            ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
            return self._send(200, target.read_bytes(), ctype, "no-cache")
        if path == "/api/bootstrap":
            return self._json({"nott": nott_info(), "projects": projects()})
        if path == "/api/nott":
            return self._json(nott_info())
        if path in ("/api/nott/file", "/api/nott/thumb"):
            name = (qs.get("name") or [""])[0]
            if not name:
                return self._err("thiếu tên tệp")
            if path.endswith("thumb"):
                cached = nott_thumb(name)
                if cached:
                    return self._send(200, cached.read_bytes(), "image/jpeg", "max-age=600")
            target = (NOTT / "notes" / "files" / name).resolve()
            root = (NOTT / "notes" / "files").resolve()
            if root not in target.parents or not target.is_file():
                return self._send(404, b"no", "text/plain")
            ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
            return self._send(200, target.read_bytes(), ctype, "max-age=3600")
        return self._send(404, b"not found", "text/plain; charset=utf-8")

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/api/projects":
                return self.save_project()
            if path == "/api/projects/delete":
                body = self._body()
                pid = _safe_name(body.get("id", ""))
                if not re.fullmatch(r"[A-Za-z0-9_-]{4,40}", pid):
                    return self._err("id không hợp lệ")
                for ext in (".json", ".jpg"):
                    try:
                        (LIB / f"{pid}{ext}").unlink()
                    except FileNotFoundError:
                        pass
                return self._json({"ok": True})
            if path == "/api/nott/send":
                return self.send_to_nott()
            if path == "/api/nott/open":
                return self.open_nott()
        except ValueError:
            return self._err("dữ liệu gửi lên không hợp lệ", 413)
        except Exception as exc:  # noqa: BLE001 - report to the UI, keep serving
            return self._err(f"{type(exc).__name__}: {exc}", 500)
        return self._send(404, b"not found", "text/plain; charset=utf-8")

    # -- projects ----------------------------------------------------------
    def save_project(self):
        body = self._body()
        pid = _safe_name(body.get("id", ""))
        if not re.fullmatch(r"[A-Za-z0-9_-]{4,40}", pid):
            return self._err("id không hợp lệ")
        layers = body.get("layers") or []
        if not isinstance(layers, list) or len(layers) > 24:
            return self._err("quá nhiều lớp")
        clean = []
        for layer in layers:
            src = str(layer.get("src", ""))
            if src and not src.startswith("data:image/"):
                return self._err("lớp không hợp lệ")
            clean.append({
                "name": _safe_name(layer.get("name", "Lớp")) or "Lớp",
                "visible": bool(layer.get("visible", True)),
                "opacity": max(0, min(100, int(layer.get("opacity", 100)))),
                "blend": str(layer.get("blend", "source-over"))[:32],
                "src": src,
            })
        doc = {
            "id": pid,
            "name": _safe_name(body.get("name", "Không tên")) or "Không tên",
            "w": max(16, min(8000, int(body.get("w", 1080)))),
            "h": max(16, min(8000, int(body.get("h", 1350)))),
            "bg": str(body.get("bg", "#FDFAF3"))[:9],
            "layers": clean,
            "createdAt": int(body.get("createdAt") or time.time() * 1000),
            "updatedAt": int(time.time() * 1000),
        }
        target = LIB / f"{pid}.json"
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, target)

        thumb = str(body.get("thumb", ""))
        if thumb.startswith("data:image/"):
            try:
                blob = base64.b64decode(thumb.split(",", 1)[1])
                if len(blob) < 4 * 1024 * 1024:
                    (LIB / f"{pid}.jpg").write_bytes(blob)
            except Exception:
                pass
        return self._json({"ok": True, "id": pid, "updatedAt": doc["updatedAt"]})

    # -- nott bridge -------------------------------------------------------
    def send_to_nott(self):
        body = self._body()
        info = nott_info()
        if not info["ok"]:
            return self._err("Không tìm thấy thư mục Nott", 404)
        name = _safe_name(body.get("name", "Bản vẽ")) or "Bản vẽ"
        png = str(body.get("png", ""))
        if not png.startswith("data:image/png;base64,"):
            return self._err("thiếu ảnh PNG")
        stamp = time.strftime("%Y%m%d-%H%M")
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "craf"
        fname = f"craf-{slug}-{stamp}.png"
        files = NOTT / "notes" / "files"
        files.mkdir(parents=True, exist_ok=True)
        (files / fname).write_bytes(base64.b64decode(png.split(",", 1)[1]))

        note = _safe_name(body.get("note", ""))
        w, h = int(body.get("w", 0)), int(body.get("h", 0))
        when = time.strftime("%d/%m/%Y · %H:%M")
        lines = [
            f"# {name}",
            f"Craf · {w} × {h} · {when}",
            "",
            f"Ảnh: notes/files/{fname}",
            "",
        ]
        if note:
            lines += [note, ""]
        content = "\n".join(lines)

        nb = NOTT / "notes" / "notebook"
        nb.mkdir(parents=True, exist_ok=True)
        note_name = f"{name} (Craf).md"
        note_path = nb / note_name
        note_path.write_text(content, encoding="utf-8")
        return self._json({"ok": True, "file": fname, "note": note_name, "saved": len(content)})

    def open_nott(self):
        try:
            body = self._body()
        except Exception:
            body = {}
        target = str(body.get("target", "nott"))
        try:
            if target == "nott-folder":
                os.startfile(str(NOTT / "notes"))  # type: ignore[attr-defined]
            elif target == "library":
                os.startfile(str(LIB))  # type: ignore[attr-defined]
            else:
                link = NOTT / "Nott.lnk"
                os.startfile(str(link if link.exists() else NOTT))  # type: ignore[attr-defined]
            return self._json({"ok": True})
        except Exception as exc:  # noqa: BLE001
            return self._err(f"Không mở được: {exc}", 500)


# --------------------------------------------------------------------------- launcher

def open_window(url: str):
    for exe in (
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ):
        if Path(exe).exists():
            try:
                subprocess.Popen([exe, f"--app={url}", "--window-size=1440,940",
                                  "--no-first-run", "--no-default-browser-check"],
                                 close_fds=True)
                return
            except Exception:
                pass
    webbrowser.open(url)


def main():
    ap = argparse.ArgumentParser(description="Craf studio")
    ap.add_argument("--open", action="store_true", help="mở cửa sổ ứng dụng")
    ap.add_argument("--port", type=int, default=PORT)
    args = ap.parse_args()

    url = f"http://127.0.0.1:{args.port}/"
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError:
        print(f"Craf đang chạy sẵn: {url}")
        if args.open:
            open_window(url)
        return
    httpd.daemon_threads = True
    print(f"Craf · {url}")
    print(f"Nott · {NOTT}{'' if (NOTT / 'nott.py').exists() else '  (không thấy)'}")
    if args.open:
        threading.Timer(0.6, lambda: open_window(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nCraf đã dừng.")


if __name__ == "__main__":
    main()
