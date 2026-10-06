#!/usr/bin/env python3
"""Generate one narration wav per line in audio/voiceover.json with the local
Kokoro model, through `hyperframes tts`. Lines that already exist are kept, so
delete a wav to re-record it. Then run audio/make-audio.py.

Needs: pip install kokoro-onnx soundfile
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, "audio", "voiceover.json")
VO_DIR = os.path.join(ROOT, "audio", "vo")


def main():
    cfg = json.load(open(CFG))
    os.makedirs(VO_DIR, exist_ok=True)
    env = {**os.environ, "HYPERFRAMES_SKIP_SKILLS": "1"}
    for key, text in cfg["lines"].items():
        out = os.path.join(VO_DIR, key + ".wav")
        if os.path.exists(out):
            continue
        subprocess.run(
            ["npx", "-y", "hyperframes@0.8.137", "tts", text, "-v", cfg["voice"], "-s", str(cfg["speed"]), "-o", out],
            check=True, env=env, capture_output=True,
        )
        dur = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out],
            capture_output=True, text=True,
        ).stdout.strip()
        print(f"{key:8s} {float(dur):5.2f}s  {text}")


if __name__ == "__main__":
    sys.exit(main())
