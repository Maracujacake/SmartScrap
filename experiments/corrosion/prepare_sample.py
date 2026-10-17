"""Extract the provided article's Figure 2 photographs without altering pixels."""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

BASE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    args = parser.parse_args()
    images = PdfReader(args.pdf).pages[4].images
    output = BASE / "input"
    output.mkdir(exist_ok=True)
    records = []
    for index in range(6):
        embedded = images[index]
        image = Image.open(io.BytesIO(embedded.data)).convert("RGB")
        # Restrict extraction to the six Figure 2 photographs, not Figure 3.
        if image.width != 520 or not 320 <= image.height <= 340:
            raise ValueError("Unexpected Figure 2 layout; inspect the PDF before extracting")
        label = chr(ord("a") + index)
        filename = f"figure2_{label}.png"
        image.save(output / filename)
        records.append({"file":filename,"panel":label,"size":list(image.size),
                        "embedded_image_sha256":hashlib.sha256(embedded.data).hexdigest()})
    metadata = {"source":"CSBFNet article provided by the user; Figure 2, PDF page 5",
        "doi":"10.1016/j.engappai.2023.106241", "primary_panel":"c",
        "notes":"Six lighting/gamma variants of the same scene; not six independent samples. No enhancement applied by SmartScrap.",
        "images":records}
    (output / "source.json").write_text(json.dumps(metadata,indent=2),encoding="utf-8")
    print(json.dumps(metadata,indent=2))


if __name__ == "__main__":
    main()
