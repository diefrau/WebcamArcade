"""Create level-matched release copies; never overwrite supplied BGM files.

Usage: python scripts/normalize-bgm.py --ffmpeg /path/to/ffmpeg
Requires FFmpeg with libmp3lame. Measures full songs (EBU R128 LUFS/true peak),
uses linear two-pass loudnorm, then measures the encoded MP3 again.
"""
import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = ["WebArcMainTitle", "WebArcBounce", "WebArcQS", "WebArcLTR"]


def run(exe, *args):
    result = subprocess.run([exe, "-hide_banner", "-nostats", *args],
                            capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result.stderr


def measure(exe, file):
    log = run(exe, "-i", str(file), "-af",
              "loudnorm=I=-20:TP=-2:LRA=11:print_format=json", "-f", "null", "-")
    data = json.loads(re.findall(r"\{[^{}]+\}", log)[-1])
    return {"integratedLUFS": float(data["input_i"]),
            "truePeakDBTP": float(data["input_tp"]),
            "loudnessRangeLU": float(data["input_lra"])}, data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    output = ROOT / "src/assets/audio/bgm"
    output.mkdir(parents=True, exist_ok=True)

    def normalize(name):
        source = ROOT / "BGM" / f"{name}.mp3"
        destination = output / source.name
        before, measured = measure(args.ffmpeg, source)
        settings = ("loudnorm=I=-20:TP=-2:LRA=11:linear=true:"
                    f"measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:"
                    f"measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}:"
                    f"offset={measured['target_offset']}")
        run(args.ffmpeg, "-y", "-i", str(source), "-map", "0:a:0", "-af", settings,
            "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k",
            "-map_metadata", "-1", str(destination))
        after, _ = measure(args.ffmpeg, destination)
        if abs(after["integratedLUFS"] + 20) > .5 or after["truePeakDBTP"] > -1.8:
            raise RuntimeError(f"Encoded output outside target: {name}: {after}")
        return name, {"sourceSHA256": hashlib.sha256(source.read_bytes()).hexdigest(),
                      "source": before, "release": after,
                      "loudnessChangeDB": round(after["integratedLUFS"] - before["integratedLUFS"], 2)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        report = dict(pool.map(normalize, NAMES))
    (output / "levels.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
