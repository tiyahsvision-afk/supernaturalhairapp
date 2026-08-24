#!/usr/bin/env python3
"""
extract_reels.py

Batch-downloads Instagram Reels from a list of URLs, pulls three frames
(first frame, hook-resolution frame at ~2s, and a middle frame), transcribes
the audio with faster-whisper, and then deletes the video (and intermediate
audio) so only frames + transcript are kept on disk.

Usage:
    python extract_reels.py --urls urls.txt --output-dir reels_data

Output layout:
    reels_data/
      0001_<video_id>/
        meta.json          # url, title, duration, transcript, frame paths, etc.
        frame_first.jpg
        frame_hook.jpg
        frame_middle.jpg
      failures.json         # any URLs that failed, with the reason
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from tqdm import tqdm

try:
    import yt_dlp
except ImportError:
    print("Missing dependency: yt-dlp. Run: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


HOOK_FRAME_SECONDS = 2.0
FIRST_FRAME_SECONDS = 0.5


def check_binary(name: str) -> None:
    if shutil.which(name) is None:
        print(
            f"Missing dependency: '{name}' was not found on PATH.\n"
            f"Install ffmpeg (which provides both ffmpeg and ffprobe), e.g.:\n"
            f"  macOS:   brew install ffmpeg\n"
            f"  Ubuntu:  sudo apt-get install ffmpeg\n",
            file=sys.stderr,
        )
        sys.exit(1)


def read_urls(path: Path) -> list[str]:
    urls = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        urls.append(line)
    return urls


def download_video(url: str, dest_dir: Path, ffmpeg_path: str | None, cookies_file: str | None,
                    cookies_from_browser: str | None) -> dict:
    """Downloads the reel with yt-dlp and returns its info dict."""
    outtmpl = str(dest_dir / "video.%(ext)s")
    ydl_opts = {
        "outtmpl": outtmpl,
        "format": "bv*[ext=mp4][height<=1080]+ba[ext=m4a]/best[ext=mp4]/best",
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "retries": 3,
    }
    if ffmpeg_path:
        # yt-dlp treats this as a literal path (file or directory), not a PATH
        # lookup -- only set it when the caller explicitly overrode the default,
        # otherwise let yt-dlp find ffmpeg on PATH itself.
        ydl_opts["ffmpeg_location"] = ffmpeg_path
    if cookies_file:
        ydl_opts["cookiefile"] = cookies_file
    if cookies_from_browser:
        ydl_opts["cookiesfrombrowser"] = (cookies_from_browser,)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    video_path = None
    for f in dest_dir.glob("video.*"):
        if f.suffix.lower() in (".mp4", ".mkv", ".webm", ".mov"):
            video_path = f
            break
    if video_path is None:
        raise RuntimeError("yt-dlp reported success but no video file was found on disk")

    info["_video_path"] = str(video_path)
    return info


def ffprobe_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(video_path),
        ],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def extract_frame(video_path: Path, timestamp: float, out_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path), "-ss", f"{timestamp:.3f}",
            "-frames:v", "1", "-q:v", "2", str(out_path),
        ],
        capture_output=True, text=True, check=True,
    )


def extract_audio(video_path: Path, out_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path), "-vn",
            "-ac", "1", "-ar", "16000", "-f", "wav", str(out_path),
        ],
        capture_output=True, text=True, check=True,
    )


def transcribe(audio_path: Path, whisper_model) -> tuple[str, str]:
    segments, info = whisper_model.transcribe(str(audio_path), beam_size=5)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return text, info.language


def process_one(url: str, index: int, output_dir: Path, whisper_model, ffmpeg_path: str,
                 cookies_file: str | None, cookies_from_browser: str | None,
                 keep_video: bool) -> dict:
    slug_dir = output_dir / f"{index:04d}_pending"
    slug_dir.mkdir(parents=True, exist_ok=True)

    try:
        info = download_video(url, slug_dir, ffmpeg_path, cookies_file, cookies_from_browser)
    except Exception as e:
        shutil.rmtree(slug_dir, ignore_errors=True)
        raise RuntimeError(f"download failed: {e}") from e

    video_id = info.get("id") or f"reel{index:04d}"
    final_dir = output_dir / f"{index:04d}_{video_id}"
    if final_dir != slug_dir:
        if final_dir.exists():
            shutil.rmtree(final_dir)
        slug_dir.rename(final_dir)
    video_path = Path(info["_video_path"])
    video_path = final_dir / video_path.name

    try:
        duration = ffprobe_duration(video_path)
    except Exception:
        duration = float(info.get("duration") or 0.0)

    mid_ts = max(duration / 2.0, 0.0)
    hook_ts = min(HOOK_FRAME_SECONDS, max(duration - 0.05, 0.0)) if duration > 0 else HOOK_FRAME_SECONDS
    first_ts = min(FIRST_FRAME_SECONDS, max(duration - 0.05, 0.0)) if duration > 0 else FIRST_FRAME_SECONDS

    frames = {
        "first": final_dir / "frame_first.jpg",
        "hook": final_dir / "frame_hook.jpg",
        "middle": final_dir / "frame_middle.jpg",
    }
    extract_frame(video_path, first_ts, frames["first"])
    extract_frame(video_path, hook_ts, frames["hook"])
    extract_frame(video_path, mid_ts, frames["middle"])

    audio_path = final_dir / "audio.wav"
    extract_audio(video_path, audio_path)
    transcript, language = transcribe(audio_path, whisper_model)

    audio_path.unlink(missing_ok=True)
    if not keep_video:
        video_path.unlink(missing_ok=True)
        for leftover in final_dir.glob("video.*"):
            leftover.unlink(missing_ok=True)

    meta = {
        "url": url,
        "video_id": video_id,
        "title": info.get("title"),
        "uploader": info.get("uploader") or info.get("channel"),
        "duration_seconds": duration,
        "transcript": transcript,
        "transcript_language": language,
        "frames": {k: str(v.name) for k, v in frames.items()},
    }
    (final_dir / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    return meta


def main():
    parser = argparse.ArgumentParser(description="Download and process a batch of Instagram Reels.")
    parser.add_argument("--urls", required=True, type=Path, help="Text file with one Reel URL per line.")
    parser.add_argument("--output-dir", default=Path("reels_data"), type=Path,
                         help="Directory to write per-video folders into (default: reels_data)")
    parser.add_argument("--whisper-model", default="small",
                         help="faster-whisper model size: tiny, base, small, medium, large-v3 (default: small)")
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"], help="Whisper inference device")
    parser.add_argument("--compute-type", default="int8",
                         help="faster-whisper compute type, e.g. int8 (cpu) or float16 (cuda)")
    parser.add_argument("--ffmpeg-path", default=None,
                         help="Path to the ffmpeg binary or its containing directory, if not on PATH")
    parser.add_argument("--cookies-file", default=None, help="Path to a Netscape-format cookies.txt for Instagram")
    parser.add_argument("--cookies-from-browser", default=None,
                         help="Browser to pull Instagram cookies from, e.g. chrome, firefox, safari")
    parser.add_argument("--keep-video", action="store_true", help="Don't delete the source video after processing")
    parser.add_argument("--skip-existing", action="store_true",
                         help="Skip URLs whose output folder already has a meta.json")
    args = parser.parse_args()

    check_binary("ffmpeg")
    check_binary("ffprobe")

    from faster_whisper import WhisperModel

    urls = read_urls(args.urls)
    if not urls:
        print(f"No URLs found in {args.urls}", file=sys.stderr)
        sys.exit(1)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Loading faster-whisper model '{args.whisper_model}' ({args.device}/{args.compute_type})...")
    whisper_model = WhisperModel(args.whisper_model, device=args.device, compute_type=args.compute_type)

    failures = []
    processed = 0
    for i, url in enumerate(tqdm(urls, desc="Processing reels"), start=1):
        if args.skip_existing:
            existing = list(args.output_dir.glob(f"{i:04d}_*/meta.json"))
            if existing:
                continue
        try:
            process_one(
                url, i, args.output_dir, whisper_model, args.ffmpeg_path,
                args.cookies_file, args.cookies_from_browser, args.keep_video,
            )
            processed += 1
        except Exception as e:
            failures.append({"index": i, "url": url, "error": str(e)})
            tqdm.write(f"[{i:04d}] FAILED: {url} -> {e}")

    if failures:
        (args.output_dir / "failures.json").write_text(json.dumps(failures, indent=2))

    print(f"\nDone. Processed {processed}/{len(urls)} reels. "
          f"{len(failures)} failed" + (" (see failures.json)" if failures else "") + ".")


if __name__ == "__main__":
    main()
