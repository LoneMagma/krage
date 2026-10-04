"""Create a source-only release ZIP; never package runtime data or credentials."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
archive = root / 'outputs' / f'KRAGE-{version}-source.zip'
archive.parent.mkdir(exist_ok=True)
directories = {'app','components','lib','server','public','hooks','tests','scripts','docs','assets'}
root_files = {'README.md','package.json','package-lock.json','components.json','next-env.d.ts','next.config.ts','vite.config.ts','tsconfig.json','tsconfig.server.json','tsconfig.test.json','Dockerfile.rooms','.dockerignore','.gitignore'}
excluded = {'node_modules','data','outputs','trash','__pycache__','.git','.server-build','.test-build'}
paths = []
for p in sorted(root.rglob('*')):
    rel = p.relative_to(root)
    if p.is_symlink() or not p.is_file() or any(part in excluded for part in rel.parts):
        continue
    if rel.parts[0] not in directories and str(rel) not in root_files:
        continue
    if p.name.startswith('.env') or p.suffix in {'.log','.zip','.pyc','.tsbuildinfo'}:
        continue
    paths.append(p)
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in paths:
        z.write(p, Path(f'KRAGE-{version}') / p.relative_to(root))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name in ('package.json','server/package.json'):
        assert json.loads(z.read(f'KRAGE-{version}/{name}'))['version'] == version
    assert not any('/.env' in n or '/server/data/' in n or '/node_modules/' in n for n in z.namelist())
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(f'{checksum}  {archive.name}\n')
print(f'{archive}\n{len(paths)} files; {archive.stat().st_size:,} bytes\nSHA256 {checksum}')
