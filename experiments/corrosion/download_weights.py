"""Download one official checkpoint from the Figshare ZIP using HTTP byte ranges.

Only standard-library modules are used. ZIP integrity is verified using size/CRC,
and a SHA-256 plus the official source metadata is recorded for reproducibility.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import urllib.request
import zipfile
import zlib

BASE = Path(__file__).resolve().parent
ARTICLE_URL = "https://api.figshare.com/v2/articles/16628668"


def request(url, start=None, end=None):
    headers = {"User-Agent": "SmartScrap-corrosion-research/1.0", "Accept-Encoding": "identity"}
    if start is not None:
        headers["Range"] = f"bytes={start}-{end}"
    response = urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=90)
    if start is not None and response.status != 206:
        response.close()
        raise RuntimeError("The server did not honor a byte-range request; no full archive was downloaded.")
    if start is not None:
        expected = f"bytes {start}-{end}/"
        if not response.headers.get("Content-Range", "").startswith(expected):
            response.close()
            raise RuntimeError("Unexpected Content-Range from the model server.")
    return response


class RemoteArchive(io.RawIOBase):
    def __init__(self, url, size):
        self.url, self.size, self.position = url, size, 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = offset + (self.position if whence == 1 else self.size if whence == 2 else 0)
        if self.position < 0:
            raise ValueError("Invalid offset")
        return self.position

    def read(self, size=-1):
        size = min(self.size-self.position, size if size >= 0 else self.size-self.position)
        if size <= 0:
            return b""
        if size > 2*1024*1024:
            raise RuntimeError("Metadata read unexpectedly large")
        with request(self.url, self.position, self.position+size-1) as response:
            data = response.read()
        if len(data) != size:
            raise RuntimeError("Truncated ZIP metadata")
        self.position += len(data)
        return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--member", help="Exact archive member name; omit to list checkpoints")
    parser.add_argument("--output", type=Path, default=BASE/"weights"/"official_checkpoint.pt")
    args = parser.parse_args()
    with request(ARTICLE_URL) as response:
        article = json.load(response)
    archive_info = next(f for f in article["files"] if f["name"].endswith(".zip"))
    remote = RemoteArchive(archive_info["download_url"], archive_info["size"])
    with zipfile.ZipFile(remote) as archive:
        members = archive.infolist()
        if not args.member:
            print(json.dumps({"article":article["title"], "archive_bytes":remote.size,
                "members":[{"name":m.filename,"bytes":m.file_size,"compressed_bytes":m.compress_size}
                           for m in members if not m.is_dir()]}, indent=2))
            return
        member = archive.getinfo(args.member)
        if member.flag_bits & 1:
            raise RuntimeError("Encrypted archive member is unsupported")
        if member.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise RuntimeError("Unsupported compression method")
        remote.seek(member.header_offset)
        header = remote.read(30)
        if header[:4] != b"PK\x03\x04":
            raise RuntimeError("Invalid local ZIP header")
        filename_length, extra_length = struct.unpack_from("<HH", header, 26)
        start = member.header_offset+30+filename_length+extra_length
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(args.output.suffix+".part")
        digest, crc, size, downloaded = hashlib.sha256(), 0, 0, 0
        decoder = zlib.decompressobj(-zlib.MAX_WBITS) if member.compress_type == zipfile.ZIP_DEFLATED else None
        print(f"Downloading selected checkpoint: {member.filename}", flush=True)
        print(f"Transfer: {member.compress_size/1e6:.1f} MB instead of {remote.size/1e6:.1f} MB", flush=True)
        with request(remote.url, start, start+member.compress_size-1) as response, temporary.open("wb") as output:
            while chunk := response.read(1024*1024):
                downloaded += len(chunk)
                data = decoder.decompress(chunk) if decoder else chunk
                output.write(data)
                digest.update(data)
                crc = zlib.crc32(data,crc)
                size += len(data)
                if downloaded//(25*1024*1024) != (downloaded-len(chunk))//(25*1024*1024):
                    print(f"Downloaded {downloaded/1e6:.0f}/{member.compress_size/1e6:.0f} MB",flush=True)
            if decoder:
                data = decoder.flush()
                output.write(data)
                digest.update(data)
                crc = zlib.crc32(data,crc)
                size += len(data)
        if downloaded != member.compress_size or size != member.file_size or crc != member.CRC:
            raise RuntimeError("Checkpoint failed size/CRC integrity verification")
        temporary.replace(args.output)
        metadata = {"article_id":article["id"],"article_title":article["title"],"version":article["version"],
            "source":article["url_public_html"],"license":article["license"],"archive":archive_info,
            "archive_member":member.filename,"file_bytes":size,"zip_crc32":f"{crc:08x}",
            "sha256":digest.hexdigest(),"transfer_bytes":downloaded,
            "article_description":article["description"]}
        args.output.with_suffix(".source.json").write_text(json.dumps(metadata,indent=2),encoding="utf-8")
        print(f"Saved {args.output}; SHA-256 {digest.hexdigest()}",flush=True)


if __name__ == "__main__":
    main()
