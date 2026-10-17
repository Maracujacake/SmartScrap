"""Run the official corrosion checkpoint on local images; no training or API calls.

Output pixel percentages describe the supplied image, not lot mass, chemical
purity, or validated corrosion coverage of metal alone.
"""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import platform
import sys
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
import torch
from torch import nn
from torch.nn import functional as F

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / "model_src"))
from network._deeplab import ASPP, ASPPConv, ASPPPooling, DeepLabHeadV3Plus, DeepLabV3
from network.backbone.resnet import Bottleneck
from network.utils import IntermediateLayerGetter

CLASSES = [
    {"id":0,"name":"Good / Background","label":"Fundo / bom estado (agrupados)","color":[0,0,0]},
    {"id":1,"name":"Fair","label":"Fair - corrosao leve","color":[128,0,0]},
    {"id":2,"name":"Poor","label":"Poor - corrosao mais avancada","color":[0,128,0]},
    {"id":3,"name":"Severe","label":"Severe - corrosao severa","color":[128,128,0]},
]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(1024*1024):
            digest.update(block)
    return digest.hexdigest()


def load_model(path):
    source_path = path.with_suffix(".source.json")
    if not source_path.is_file():
        raise ValueError("Missing official checkpoint provenance; run download_weights.py first")
    provenance = json.loads(source_path.read_text(encoding="utf-8"))
    if sha256(path) != provenance["sha256"]:
        raise ValueError("Checkpoint no longer matches its recorded SHA-256")
    allowed = [DeepLabV3, DeepLabHeadV3Plus, ASPP, ASPPConv, ASPPPooling,
        IntermediateLayerGetter, Bottleneck, nn.Sequential, nn.ModuleList,
        nn.Conv2d, nn.BatchNorm2d, nn.ReLU, nn.MaxPool2d, nn.AdaptiveAvgPool2d,
        nn.Dropout, nn.Linear, set, collections.OrderedDict]
    allowed_names = {f"{obj.__module__}.{obj.__qualname__}" for obj in allowed}
    allowed_names.update({"builtins.set","__builtin__.set"})
    unknown = set(torch.serialization.get_unsafe_globals_in_checkpoint(path))-allowed_names
    if unknown:
        raise ValueError(f"Checkpoint contains unreviewed globals: {sorted(unknown)}")
    with torch.serialization.safe_globals(allowed):
        model = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(model, DeepLabV3) or model.classifier.classifier[-1].out_channels != 4:
        raise ValueError("Not the expected four-class DeepLabV3+ checkpoint")
    model.eval()
    model.requires_grad_(False)
    backbone_blocks = [len(model.backbone[name]) for name in ("layer1","layer2","layer3","layer4")]
    architecture = "ResNet101" if backbone_blocks == [3,4,23,3] else "ResNet50" if backbone_blocks == [3,4,6,3] else str(backbone_blocks)
    metadata = {"model":"DeepLabV3+", "backbone":architecture,"backbone_blocks":backbone_blocks,
        "parameters":sum(parameter.numel() for parameter in model.parameters()),
        "checkpoint":path.name,"checkpoint_sha256":provenance["sha256"],
        "checkpoint_source":provenance["source"],"archive_member":provenance["archive_member"],
        "loss":"L2 spectrum loss" if "l2_loss" in provenance["archive_member"] else "See source checkpoint",
        "device":"CPU","input_size":[512,512],"color_order":"BGR","pixel_range":[0,255],
        "normalization":"None, matching the author's evaluation script",
        "resize":"Bilinear, align_corners=False, without antialias; quantized to uint8 before float conversion",
        "safe_loading":"torch.load(weights_only=True) with reviewed class allowlist"}
    return model, metadata


def preprocess(image):
    # Match OpenCV's BGR uint8 resize / float input in the author's inference.
    rgb = np.array(image, dtype=np.uint8)
    tensor = torch.from_numpy(rgb[:, :, ::-1].copy()).permute(2,0,1).unsqueeze(0).float()
    tensor = F.interpolate(tensor,size=(512,512),mode="bilinear",align_corners=False,antialias=False)
    return tensor.round().clamp(0,255)


def font(size=18, bold=False):
    candidate = Path("C:/Windows/Fonts") / ("segoeuib.ttf" if bold else "segoeui.ttf")
    try:
        return ImageFont.truetype(str(candidate),size)
    except OSError:
        return ImageFont.load_default(size=size)


def render_comparison(image, mask, overlay, result, destination):
    width, tile_height = 420, 300
    canvas = Image.new("RGB",(width*3+80,550),"#f4f7f5")
    draw = ImageDraw.Draw(canvas)
    draw.text((20,18),"SmartScrap | Teste real do DeepLabV3+",font=font(25,True),fill="#194d3e")
    draw.text((20,55),f"{result['image']} - checkpoint oficial L2 - CPU - sem treinamento adicional",font=font(15),fill="#60756b")
    for index,(picture,label) in enumerate([(image,"Imagem fornecida"),(mask,"Mascara prevista"),(overlay,"Sobreposicao da previsao")]):
        x = 20+index*(width+20)
        draw.rounded_rectangle((x,93,x+width,93+tile_height),radius=9,fill="#ffffff")
        shown = ImageOps.contain(picture,(width-12,tile_height-12),Image.Resampling.NEAREST if index==1 else Image.Resampling.BILINEAR)
        canvas.paste(shown,(x+(width-shown.width)//2,93+(tile_height-shown.height)//2))
        draw.text((x,402),label,font=font(17,True),fill="#35554a")
    for index,info in enumerate(result["classes"]):
        x = 20+(index%2)*640
        y = 439+(index//2)*31
        draw.rounded_rectangle((x,y+3,x+15,y+18),radius=3,fill=tuple(info["color"]))
        percentage = "<0,01" if 0 < info['percent_pixels'] < 0.01 else f"{info['percent_pixels']:.2f}".replace(".",",")
        draw.text((x+24,y),f"{info['label']}: {percentage}% dos pixels",font=font(16),fill="#536c60")
    draw.text((20,516),"Saida experimental sem rotulo de referencia. Percentual de pixels nao e pureza, massa ou area metalica do lote.",font=font(14),fill="#8b5a3f")
    canvas.save(destination)


def predict(model,image_path,output):
    image = ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")
    tensor = preprocess(image)
    start = time.perf_counter()
    with torch.inference_mode():
        logits = model(tensor)
    elapsed = (time.perf_counter()-start)*1000
    if logits.shape != (1,4,512,512) or not torch.isfinite(logits).all():
        raise ValueError("Invalid model output")
    labels = logits.argmax(dim=1)[0].numpy().astype(np.uint8)
    palette = np.array([info["color"] for info in CLASSES],dtype=np.uint8)
    ids = Image.fromarray(labels)
    mask = Image.fromarray(palette[labels]).resize(image.size,Image.Resampling.NEAREST)
    original = np.asarray(image,dtype=np.float32)
    colors = np.asarray(mask,dtype=np.float32)
    affected = np.asarray(ids.resize(image.size,Image.Resampling.NEAREST)) != 0
    blended = original.copy()
    blended[affected] = original[affected]*0.50+colors[affected]*0.50
    overlay = Image.fromarray(blended.round().astype(np.uint8))
    stem = image_path.stem
    counts = np.bincount(labels.ravel(),minlength=4)
    result = {"image":image_path.name,"panel":stem.rsplit("_",1)[-1],"original_size":list(image.size),
        "image_sha256":sha256(image_path),"inference_ms":round(elapsed,2),"output_tensor_shape":list(logits.shape),
        "classes":[{**info,"pixels":int(counts[info["id"]]),
                    "percent_pixels":round(float(counts[info["id"]])/labels.size*100,4)} for info in CLASSES],
        "corrosion_predicted_percent_pixels":round(float(counts[1:].sum())/labels.size*100,4),
        "interpretation":"Percentages of all image pixels, including background. No mass, chemical purity, or lot quality inference.",
        "reference_mask_available":False,"accuracy_f1_iou":None,
        "files":{"mask_ids":f"{stem}_ids.png","mask":f"{stem}_mask.png",
                 "overlay":f"{stem}_overlay.png","comparison":f"{stem}_comparison.png"}}
    ids.save(output/result["files"]["mask_ids"])
    mask.save(output/result["files"]["mask"])
    overlay.save(output/result["files"]["overlay"])
    render_comparison(image,mask,overlay,result,output/result["files"]["comparison"])
    (output/f"{stem}_result.json").write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights",type=Path,default=BASE/"weights"/"l2_loss_weights_35.pt")
    parser.add_argument("--image",type=Path,default=BASE/"input"/"figure2_c.png")
    parser.add_argument("--all-panels",action="store_true")
    parser.add_argument("--output",type=Path,default=BASE/"output")
    parser.add_argument("--threads",type=int,default=min(8,os.cpu_count() or 1))
    args = parser.parse_args()
    if args.threads<1 or args.threads>64:
        parser.error("Use 1 to 64 CPU threads")
    torch.set_num_threads(args.threads)
    torch.manual_seed(0)
    args.output.mkdir(parents=True,exist_ok=True)
    print("Loading the verified official checkpoint...",flush=True)
    model,metadata = load_model(args.weights)
    print(json.dumps(metadata,indent=2),flush=True)
    paths = sorted((BASE/"input").glob("figure2_?.png")) if args.all_panels else [args.image]
    if not paths:
        raise ValueError("No input images found")
    # A warm-up separates one-time CPU setup from the reported inference time.
    with torch.inference_mode():
        model(preprocess(Image.open(paths[0]).convert("RGB")))
    results = []
    for path in paths:
        print(f"Analyzing {path.name}...",flush=True)
        result = predict(model,path,args.output)
        results.append(result)
        print(json.dumps({"image":result["image"],"inference_ms":result["inference_ms"],
            "classes":{entry["name"]:entry["percent_pixels"] for entry in result["classes"]}}),flush=True)
    report = {"model":metadata,"runtime":{"python":platform.python_version(),"torch":torch.__version__,
        "numpy":np.__version__,"cpu_threads":args.threads,"warmup_runs":1},
        "primary_panel":"c","results":results,
        "limitations":["No reference labels: accuracy, F1 and IoU cannot be calculated.",
            "Bridge corrosion model applied outside its training domain to a scrap-yard image.",
            "Good and Background share one class; this is not a healthy-metal detector.",
            "The six panels are gamma variants of the same scene, not independent samples.",
            "Output is not chemical purity, scrap mass composition, or a lot quality certificate."]}
    (args.output/"report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")


if __name__ == "__main__":
    main()
