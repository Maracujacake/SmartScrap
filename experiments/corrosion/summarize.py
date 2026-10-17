"""Build visual summaries from saved predictions without rerunning the model."""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps

from infer import font, render_comparison

BASE = Path(__file__).resolve().parent


def percentage(value):
    return "<0,01" if 0 < value < 0.01 else f"{value:.2f}".replace(".",",")


def main():
    output = BASE/"output"
    report = json.loads((output/"report.json").read_text(encoding="utf-8"))
    results = report["results"]
    for result in results:
        image = Image.open(BASE/"input"/result["image"]).convert("RGB")
        mask = Image.open(output/result["files"]["mask"]).convert("RGB")
        overlay = Image.open(output/result["files"]["overlay"]).convert("RGB")
        labels = np.array(Image.open(output/result["files"]["mask_ids"]))
        counts = np.bincount(labels.ravel(),minlength=4)
        assert labels.shape == (512,512) and counts.tolist() == [c["pixels"] for c in result["classes"]]
        assert sum(c["pixels"] for c in result["classes"]) == 512*512
        assert mask.size == overlay.size == image.size
        render_comparison(image,mask,overlay,result,output/result["files"]["comparison"])
    canvas = Image.new("RGB",(1300,900),"#f4f7f5")
    draw = ImageDraw.Draw(canvas)
    draw.text((20,16),"Mesma cena, diferentes versoes de iluminacao",font=font(27,True),fill="#194d3e")
    draw.text((20,54),"DeepLabV3+ | pesos oficiais L2 | cores = classes previstas | sem rotulos de referencia",font=font(17),fill="#64796d")
    for index,result in enumerate(results):
        x = 20+(index%3)*430
        y = 94+(index//3)*374
        tile = ImageOps.contain(Image.open(output/result["files"]["overlay"]),(410,280),Image.Resampling.BILINEAR)
        draw.rounded_rectangle((x,y,x+410,y+350),radius=9,fill="white")
        canvas.paste(tile,(x+(410-tile.width)//2,y+12))
        draw.text((x+12,y+285),f"Quadro ({result['panel']})",font=font(19,True),fill="#365749")
        draw.text((x+12,y+314),f"Fair {percentage(result['classes'][1]['percent_pixels'])}% | Severe {percentage(result['classes'][3]['percent_pixels'])}%",font=font(17),fill="#687f71")
    draw.text((20,857),"Percentuais sobre todos os pixels. As variantes nao representam lotes diferentes nem comprovam pureza.",font=font(16),fill="#8b5a3f")
    canvas.save(output/"lighting_comparison.png")
    print("Verified six masks against saved class counts; saved comparison boards and lighting gallery.")


if __name__ == "__main__":
    main()
