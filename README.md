# Instagram Reels Content-Framework Analyzer

Two scripts:

1. **`extract_reels.py`** -- downloads a batch of Instagram Reels, pulls 3 frames
   (first frame, hook-resolution frame at ~2s, middle frame), transcribes the
   audio with `faster-whisper`, then deletes the video (keeping only the
   frames + transcript).
2. **`analyze_reels.py`** -- sends each video's frames + transcript to the
   Claude API and tags it against the "7 Lego Bricks" content framework,
   compiling everything into a single CSV on your Desktop.

## Setup

Requires Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

You also need the `ffmpeg` binary (not the pip package) on your `PATH`:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
```

### Anthropic API key

`analyze_reels.py` reads your key from the environment -- never hardcode it:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com/settings/keys.

## Usage

### 1. Put your Reel URLs in a text file

One URL per line (see `urls.example.txt`):

```
https://www.instagram.com/reel/XXXXXXXXXXX/
https://www.instagram.com/reel/YYYYYYYYYYY/
```

### 2. Download + transcribe

```bash
python extract_reels.py --urls urls.txt --output-dir reels_data
```

Useful flags:

- `--whisper-model small` -- `tiny`/`base`/`small`/`medium`/`large-v3` (default `small`; bigger = more accurate, slower)
- `--device cuda --compute-type float16` -- if you have a GPU
- `--cookies-file cookies.txt` or `--cookies-from-browser chrome` -- Instagram
  frequently rate-limits or requires login for reel downloads; export cookies
  from a logged-in browser session if downloads get blocked
- `--skip-existing` -- resume a batch without re-processing already-done reels
- `--keep-video` -- don't delete the source video (debugging)

Output, per reel, under `reels_data/<index>_<video_id>/`:
- `frame_first.jpg`, `frame_hook.jpg`, `frame_middle.jpg`
- `meta.json` (url, title, duration, transcript, frame filenames)

Failed downloads are logged to `reels_data/failures.json` and the batch
continues.

### 3. Tag against the framework + compile the CSV

```bash
python analyze_reels.py --data-dir reels_data --output ~/Desktop/reels_analysis.csv
```

This calls the Claude API (`claude-sonnet-4-6` by default, vision-capable) once
per reel with its 3 frames + transcript, asking it to tag:

1. Topic
2. Angle
3. Hook Structure (visual / text / spoken hook + direct-vs-implied contrast)
4. Story Structure
5. Visual Format
6. Key Visuals
7. Audio

...plus the **visual stop** in the first 1-2 seconds and the **contrast /
curiosity gap** being created, and a one-sentence "why this works" note.

The CSV columns are: `url, video_id, title, topic, angle, hook_visual,
hook_text, hook_spoken, hook_contrast_type, story_structure, visual_format,
key_visuals, audio, visual_stop, contrast_gap, why_this_works`.

Any per-video analysis failures are logged to
`reels_data/analysis_failures.json`; the run still produces a CSV of
everything that succeeded.

Override the model with `--model claude-opus-5` etc. if you want a different
one.
