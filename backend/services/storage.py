"""Private object storage. Cloud failures propagate; never silently fall back to disk."""
import os
from functools import lru_cache
from pathlib import Path, PurePosixPath
from google.api_core.exceptions import NotFound, PreconditionFailed

ROOT = Path(__file__).resolve().parents[1]


def _key(key: str) -> str:
    path = PurePosixPath(key)
    if not key or path.is_absolute() or '..' in path.parts or '\\' in key:
        raise ValueError('Invalid storage key')
    return str(path)


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def read(self, key: str) -> bytes | None:
        path = self.root / _key(key)
        try:
            return path.read_bytes()
        except FileNotFoundError:
            return None

    def write(self, key: str, data: bytes, content_type: str = 'application/octet-stream'):
        path = self.root / _key(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic replacement keeps readers from observing partial files.
        import tempfile
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
            handle.write(data)
            temporary = Path(handle.name)
        temporary.replace(path)

    def create(self, key: str, data: bytes, content_type: str = 'application/octet-stream'):
        path = self.root / _key(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with path.open('xb') as handle:
                handle.write(data)
        except FileExistsError:
            pass


class GCSStorage:
    def __init__(self, bucket: str, prefix: str):
        from google.cloud import storage
        self.bucket = storage.Client().bucket(bucket)
        self.prefix = prefix.strip('/')

    def _blob(self, key: str):
        return self.bucket.blob('/'.join(filter(None, (self.prefix, _key(key)))))

    def read(self, key: str) -> bytes | None:
        try:
            return self._blob(key).download_as_bytes(timeout=30)
        except NotFound:
            return None

    def write(self, key: str, data: bytes, content_type: str = 'application/octet-stream'):
        self._blob(key).upload_from_string(data, content_type=content_type, timeout=30)

    def create(self, key: str, data: bytes, content_type: str = 'application/octet-stream'):
        try:
            self._blob(key).upload_from_string(data, content_type=content_type, if_generation_match=0, timeout=30)
        except PreconditionFailed:
            pass  # Another instance already initialized this object.


@lru_cache(maxsize=8)
def _store(backend: str, root: str, bucket: str, prefix: str):
    if backend == 'local':
        return LocalStorage(root)
    if backend == 'gcs' and bucket:
        return GCSStorage(bucket, prefix)
    raise RuntimeError('Set SHIPSURE_STORAGE_BACKEND=local or gcs; gcs requires SHIPSURE_STORAGE_BUCKET')


def get_storage():
    return _store(os.getenv('SHIPSURE_STORAGE_BACKEND', 'local'),
                  os.getenv('SHIPSURE_STORAGE_ROOT', str(ROOT)),
                  os.getenv('SHIPSURE_STORAGE_BUCKET', ''),
                  os.getenv('SHIPSURE_STORAGE_PREFIX', 'shipsure/demo'))
