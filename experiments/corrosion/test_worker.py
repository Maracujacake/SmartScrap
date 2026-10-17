"""Photo validation tests, without downloading or loading model weights."""
import os
from pathlib import Path
import struct
import tempfile
import unittest
import zlib

os.environ.setdefault("CORROSION_DATA_DIR", str(Path(__file__).resolve().parent))
from PIL import Image
from worker import InputError, sanitize


class PhotoValidationTests(unittest.TestCase):
    def setUp(self):
        self.test_parent = Path(__file__).resolve().parents[2]/"data"
        self.test_parent.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix="smartscrap-photo-test-", dir=self.test_parent)
        self.root = Path(self.temporary.name).resolve()
        assert self.root.parent == self.test_parent.resolve()
        assert self.root.name.startswith("smartscrap-photo-test-")
        self.source, self.destination = self.root/"input.bin", self.root/"photo.jpg"

    def tearDown(self):
        self.temporary.cleanup()

    def test_orientation_metadata_and_size(self):
        exif = Image.Exif()
        exif[274] = 6
        exif[270] = "Private description"
        Image.new("RGB", (2000, 400), "gray").save(self.source, "JPEG", exif=exif)
        sanitize(self.source, self.destination)
        with Image.open(self.destination) as image:
            self.assertEqual(image.size, (320, 1600))
            self.assertEqual(dict(image.getexif()), {})
            self.assertEqual(image.format, "JPEG")

    def test_small_and_corrupted_photos(self):
        Image.new("RGB", (255, 512)).save(self.source, "PNG")
        with self.assertRaisesRegex(InputError, "256 pixels"):
            sanitize(self.source, self.destination)
        self.source.write_bytes(b"\xff\xd8\xff" + bytes(30))
        with self.assertRaisesRegex(InputError, "fotografia"):
            sanitize(self.source, self.destination)

    def test_animation_is_rejected(self):
        frames = [Image.new("RGB", (256, 256), color) for color in ("red", "blue")]
        frames[0].save(self.source, "PNG", save_all=True, append_images=frames[1:], duration=100)
        with self.assertRaisesRegex(InputError, "sem animação"):
            sanitize(self.source, self.destination)

    def test_oversize_dimensions_rejected_before_decoding_pixels(self):
        def chunk(kind, content):
            return struct.pack(">I", len(content)) + kind + content + struct.pack(">I", zlib.crc32(kind + content))
        header = struct.pack(">IIBBBBB", 5000, 4001, 8, 2, 0, 0, 0)
        self.source.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"\x00")) + chunk(b"IEND", b""))
        with self.assertRaisesRegex(InputError, "20 milhões"):
            sanitize(self.source, self.destination)


if __name__ == "__main__":
    unittest.main()
