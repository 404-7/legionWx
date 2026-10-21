"""Read-only extraction of user-supplied Warcraft data, never executes map scripts."""
import sys, os, json, struct, io, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(os.environ['TEMP']) / 'legion-xls-reader'))
import mpyq

source = Path(sys.argv[1])
out = Path('.cache/source341')
out.mkdir(parents=True, exist_ok=True)
binary = source.read_bytes()
(out/'manifest.json').write_text(json.dumps({'file':source.name,'sha256':hashlib.sha256(binary).hexdigest()},ensure_ascii=False,indent=2),encoding='utf-8')
offset = binary.find(b'MPQ\x1a')
if offset < 0: raise ValueError('MPQ header not found')
archive = mpyq.MPQArchive(io.BytesIO(binary[offset:]), listfile=False)
names = ['war3map.j','war3map.w3u','war3map.w3a','war3map.wts']
print('Archive entries:', len(names))
print('\n'.join(n for n in names if n.lower().endswith(('.w3u','.w3a','.j','.wts','.slk','.txt'))))
for name in ['war3map.j','war3map.w3u','war3map.w3a','war3map.wts']:
    data = archive.read_file(name)
    if data:
        (out / name).write_bytes(data)
        print(name, len(data))

def objects(data, extended=False):
    pos = 0
    def read(fmt):
        nonlocal pos
        size = struct.calcsize(fmt)
        values = struct.unpack_from(fmt,data,pos)
        pos += size
        return values[0] if len(values)==1 else values
    def string():
        nonlocal pos
        end = data.index(b'\0',pos)
        text = data[pos:end].decode('utf-8','replace')
        pos=end+1
        return text
    version = read('<i')
    result=[]
    for table in range(2):
        for _ in range(read('<i')):
            old,new=read('<4s4s')
            item={'base':old.decode('latin1'),'id':new.decode('latin1').strip('\0') or old.decode('latin1'),'custom':bool(table),'fields':{}}
            for _ in range(read('<i')):
                field=read('<4s').decode('latin1');kind=read('<i')
                level,column = (read('<i'),read('<i')) if extended else (0,0)
                value = read('<i') if kind==0 else read('<f') if kind in (1,2) else string()
                end=read('<4s')
                key=field+(f':{level}:{column}' if extended else '')
                item['fields'][key]=value
            result.append(item)
    if pos!=len(data): raise ValueError(f'unparsed bytes {len(data)-pos}, version={version}')
    return result

for name,extended in [('war3map.w3u',False),('war3map.w3a',True)]:
    data=(out/name).read_bytes()
    parsed=objects(data,extended)
    (out/(name+'.json')).write_text(json.dumps(parsed,ensure_ascii=False,indent=2),encoding='utf-8')
    print(name,'objects',len(parsed))
