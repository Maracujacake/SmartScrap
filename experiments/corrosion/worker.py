"""Local JSON-lines worker. No network, no retraining, one cached model per process."""
import json
import os
from pathlib import Path
import sys
import traceback
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError
import torch
import numpy as np

from infer import BASE, load_model, predict

ROOT = Path(os.environ["CORROSION_DATA_DIR"]).resolve()
WEIGHTS = Path(os.environ.get("CORROSION_WEIGHTS", str(BASE/"weights/l2_loss_weights_35.pt")))
Image.MAX_IMAGE_PIXELS = 20_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)
torch.set_num_threads(min(8, os.cpu_count() or 1))
MODEL, METADATA = None, None


class InputError(Exception):
    pass


def send(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def sanitize(source, destination):
    try:
        with Image.open(source) as opened:
            if opened.format not in {"JPEG", "PNG", "WEBP"} or getattr(opened, "n_frames", 1) != 1:
                raise InputError("Envie uma fotografia JPG, PNG ou WebP sem animação.")
            if min(opened.size) < 256:
                raise InputError("A fotografia precisa ter pelo menos 256 pixels de largura e altura.")
            if opened.width * opened.height > 20_000_000:
                raise InputError("A imagem excede o limite de 20 milhões de pixels. Reduza a resolução.")
            opened.verify()
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
                rgba = image.convert("RGBA")
                image = Image.new("RGB", rgba.size, "white")
                image.paste(rgba, mask=rgba.getchannel("A"))
            else:
                image = image.convert("RGB")
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            # Re-encoding discards EXIF/GPS, comments, profiles and original metadata.
            Image.fromarray(np.array(image)).save(destination, "JPEG", quality=92)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise InputError("A imagem excede o limite de 20 milhões de pixels. Reduza a resolução.")
    except (UnidentifiedImageError, OSError, ValueError):
        raise InputError("Não foi possível abrir a fotografia. Envie um JPG, PNG ou WebP válido.")


def process(job):
    global MODEL, METADATA
    directory = Path(job["directory"]).resolve()
    if directory.parent != ROOT or directory.name != job["id"]:
        raise InputError("Diretório de análise inválido.")
    count = job["photo_count"]
    if not isinstance(count, int) or not 1 <= count <= 3:
        raise InputError("Envie entre uma e três fotografias.")
    paths = []
    for index in range(count):
        destination = directory/f"photo-{index}.jpg"
        sanitize(directory/f"raw-{index}.bin", destination)
        paths.append(destination)
    supported = job["material"] in {"Aço", "Ferro"}
    if not supported:
        return {"scope":"unsupported_material", "material":job["material"],
            "message":"Fotografias registradas. Este modelo de corrosão foi treinado em aço e não avalia este material.",
            "photos":[{"position":index,"original_size":list(Image.open(path).size)} for index,path in enumerate(paths)],
            "model":None}
    if MODEL is None:
        MODEL, METADATA = load_model(WEIGHTS)
    photos = []
    for index, path in enumerate(paths):
        result = predict(MODEL, path, directory)
        photos.append({"position":index,"original_size":result["original_size"],
            "inference_ms":result["inference_ms"],"classes":result["classes"],
            "corrosion_predicted_percent_pixels":result["corrosion_predicted_percent_pixels"]})
    percentages = [photo["corrosion_predicted_percent_pixels"] for photo in photos]
    return {"scope":"steel_corrosion", "material":job["material"],"model":METADATA,"photos":photos,
        "summary":{"photos":count,"min_predicted_percent":min(percentages),"max_predicted_percent":max(percentages)},
        "interpretation":"Percentuais dos pixels de cada fotografia, incluindo o fundo. Não representam pureza, massa ou composição do lote.",
        "reference_mask_available":False,"accuracy_f1_iou":None}


def main():
    send({"event":"ready"})
    for line in sys.stdin:
        job = {}
        try:
            job = json.loads(line)
            result = process(job)
            send({"id":job["id"],"result":result})
        except InputError as error:
            send({"id":job.get("id"),"error":str(error)})
        except Exception:
            traceback.print_exc(file=sys.stderr)
            send({"id":job.get("id"),"error":"Não foi possível executar o modelo local. Verifique o ambiente Python e os pesos e tente novamente."})


if __name__ == "__main__":
    main()
