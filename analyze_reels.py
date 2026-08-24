#!/usr/bin/env python3
"""
analyze_reels.py

Reads the per-video folders produced by extract_reels.py (frames + transcript),
sends each one to the Claude API against the "7 Lego Bricks" content framework,
and compiles the results into a single CSV.

Requires the ANTHROPIC_API_KEY environment variable to be set:
    export ANTHROPIC_API_KEY=sk-ant-...

Usage:
    python analyze_reels.py --data-dir reels_data --output ~/Desktop/reels_analysis.csv
"""

import argparse
import base64
import csv
import json
import sys
from pathlib import Path
from typing import Literal

import anthropic
from pydantic import BaseModel

DEFAULT_MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """\
You are a short-form video strategist who tags Instagram Reels against the \
"7 Lego Bricks" content framework. You are given three frames from a Reel \
(the very first frame, a frame at roughly the 2-second hook-resolution point, \
and a frame from the middle of the video) plus its spoken-word transcript. \
Base every judgment strictly on what is visible in the frames and audible in \
the transcript -- do not invent details you cannot support.

Tag the video against these 7 bricks:
1. Topic -- what the video is literally about.
2. Angle -- the unique spin or point of view taken on that topic (why this \
   version of the topic, not just the topic itself).
3. Hook Structure -- how the video opens: the visual hook, the on-screen text \
   hook, the spoken hook, and whether the hook uses direct contrast (an \
   explicit "X vs Y" / before-after stated outright) or implied contrast (a \
   contrast the viewer has to infer).
4. Story Structure -- the narrative shape, e.g. case study, listicle, \
   narrative arc, tutorial, myth-bust, day-in-the-life, etc.
5. Visual Format -- the shooting/editing format, e.g. split screen, vlog, \
   POV, talking head, screen recording, text-on-screen montage, etc.
6. Key Visuals -- what A-roll (the presenter on camera), B-roll (cutaway/\
   supporting footage), and graphics/on-screen text are used.
7. Audio -- music, sound effects, and voiceover/delivery style.

Also flag:
- Visual Stop: the specific color or contrast choice in the first 1-2 seconds \
  that is designed to stop a scrolling thumb (e.g. a bright color block, a \
  jarring cut, a high-contrast object against the background).
- Contrast/Curiosity Gap: the specific gap between what the viewer expects and \
  what is shown or claimed, that creates the urge to keep watching.

Finally, write one short, concrete sentence on why this video works, tying \
back to the specific bricks above -- not a generic compliment.

If the transcript is empty or unhelpful (e.g. music-only), rely on the \
frames and note that the video appears to be non-verbal/music-led rather \
than guessing at spoken content.
"""

USER_TEMPLATE = """\
Video title: {title}
Uploader: {uploader}
Duration: {duration:.1f}s

Transcript:
{transcript}

Analyze the three attached frames (in order: first frame, hook-resolution \
frame at ~2s, middle frame) together with this transcript.
"""


class HookStructure(BaseModel):
    visual_hook: str
    text_hook: str
    spoken_hook: str
    contrast_type: Literal["direct", "implied", "none"]


class ReelAnalysis(BaseModel):
    topic: str
    angle: str
    hook_structure: HookStructure
    story_structure: str
    visual_format: str
    key_visuals: str
    audio: str
    visual_stop: str
    contrast_gap: str
    why_this_works: str


def image_block(path: Path) -> dict:
    media_type = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": data},
    }


def analyze_one(client: anthropic.Anthropic, model: str, meta: dict, video_dir: Path) -> ReelAnalysis:
    frame_order = ["first", "hook", "middle"]
    content = [image_block(video_dir / meta["frames"][key]) for key in frame_order]
    content.append({
        "type": "text",
        "text": USER_TEMPLATE.format(
            title=meta.get("title") or "(untitled)",
            uploader=meta.get("uploader") or "(unknown)",
            duration=meta.get("duration_seconds") or 0.0,
            transcript=meta.get("transcript") or "(no speech detected)",
        ),
    })

    response = client.messages.parse(
        model=model,
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
        output_format=ReelAnalysis,
    )
    return response.parsed_output


def check_api_key(client: anthropic.Anthropic, model: str) -> None:
    try:
        client.messages.count_tokens(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
        )
    except anthropic.AuthenticationError:
        print(
            "No valid Anthropic API credentials found.\n"
            "Set your API key before running this script:\n"
            "  export ANTHROPIC_API_KEY=sk-ant-...\n"
            "(Get a key at https://console.anthropic.com/settings/keys)",
            file=sys.stderr,
        )
        sys.exit(1)
    except anthropic.APIError:
        # Any other API error means the key resolved fine; the actual
        # analysis calls will surface real errors per-video.
        pass


def main():
    parser = argparse.ArgumentParser(description="Tag extracted Reels against the 7 Lego Bricks framework via Claude.")
    parser.add_argument("--data-dir", default=Path("reels_data"), type=Path,
                         help="Directory produced by extract_reels.py (default: reels_data)")
    parser.add_argument("--output", default=Path.home() / "Desktop" / "reels_analysis.csv", type=Path,
                         help="Output CSV path (default: ~/Desktop/reels_analysis.csv)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Claude model to use (default: {DEFAULT_MODEL})")
    args = parser.parse_args()

    if not args.data_dir.exists():
        print(f"Data directory not found: {args.data_dir}", file=sys.stderr)
        sys.exit(1)

    video_dirs = sorted(d for d in args.data_dir.iterdir() if d.is_dir() and (d / "meta.json").exists())
    if not video_dirs:
        print(f"No processed videos (meta.json) found under {args.data_dir}", file=sys.stderr)
        sys.exit(1)

    client = anthropic.Anthropic()
    check_api_key(client, args.model)

    args.output.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "url", "video_id", "title", "topic", "angle",
        "hook_visual", "hook_text", "hook_spoken", "hook_contrast_type",
        "story_structure", "visual_format", "key_visuals", "audio",
        "visual_stop", "contrast_gap", "why_this_works",
    ]

    rows = []
    failures = []
    for video_dir in video_dirs:
        meta = json.loads((video_dir / "meta.json").read_text())
        print(f"Analyzing {video_dir.name}: {meta.get('title') or meta['url']}")
        try:
            analysis = analyze_one(client, args.model, meta, video_dir)
        except Exception as e:
            failures.append({"video_dir": video_dir.name, "url": meta["url"], "error": str(e)})
            print(f"  FAILED: {e}", file=sys.stderr)
            continue

        rows.append({
            "url": meta["url"],
            "video_id": meta["video_id"],
            "title": meta.get("title") or "",
            "topic": analysis.topic,
            "angle": analysis.angle,
            "hook_visual": analysis.hook_structure.visual_hook,
            "hook_text": analysis.hook_structure.text_hook,
            "hook_spoken": analysis.hook_structure.spoken_hook,
            "hook_contrast_type": analysis.hook_structure.contrast_type,
            "story_structure": analysis.story_structure,
            "visual_format": analysis.visual_format,
            "key_visuals": analysis.key_visuals,
            "audio": analysis.audio,
            "visual_stop": analysis.visual_stop,
            "contrast_gap": analysis.contrast_gap,
            "why_this_works": analysis.why_this_works,
        })

    with args.output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    if failures:
        failures_path = args.data_dir / "analysis_failures.json"
        failures_path.write_text(json.dumps(failures, indent=2))
        print(f"\n{len(failures)} video(s) failed to analyze -- see {failures_path}")

    print(f"\nWrote {len(rows)} rows to {args.output}")


if __name__ == "__main__":
    main()
