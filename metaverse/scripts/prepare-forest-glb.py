"""Prepare the supplied Blender forest GLB for the web without changing the source.
Usage: python3 scripts/prepare-forest-glb.py SOURCE.glb [OUTPUT.glb]
Requires Pillow. Geometry and scene transforms remain untouched.
"""
import io,json,struct,sys,hashlib
from pathlib import Path
from PIL import Image
source=Path(sys.argv[1]);output=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).resolve().parents[1]/'assets/models/forest.glb'
raw=source.read_bytes();magic,version,total=struct.unpack_from('<III',raw);assert magic==0x46546c67 and version==2
length,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+length]);offset=20+length
binlength,binkind=struct.unpack_from('<II',raw,offset);binary=raw[offset+8:offset+8+binlength]
images={image['bufferView']:image for image in doc.get('images',[])};rebuilt=bytearray();report=[]
for i,view in enumerate(doc['bufferViews']):
 data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 if i in images:
  image=images[i];im=Image.open(io.BytesIO(data));original=im.size;im.thumbnail((2048,2048),Image.Resampling.LANCZOS);out=io.BytesIO()
  if image['mimeType']=='image/jpeg':im.convert('RGB').save(out,format='JPEG',quality=90,optimize=True)
  else:im.save(out,format='PNG',optimize=True)
  data=out.getvalue();report.append({'name':image.get('name'),'original':original,'web':im.size,'bytes':len(data)})
 while len(rebuilt)%4:rebuilt.append(0)
 view['byteOffset']=len(rebuilt);view['byteLength']=len(data);rebuilt.extend(data)
# Blender's generated coordinates exported as texCoord=-1 are not a glTF UV set.
def sanitize(value):
 if isinstance(value,dict):
  if value.get('texCoord',0)<0:value['texCoord']=0
  for child in value.values():sanitize(child)
 elif isinstance(value,list):
  for child in value:sanitize(child)
sanitize(doc);doc['buffers'][0]['byteLength']=len(rebuilt)
encoded=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4);rebuilt.extend(b'\0'*((-len(rebuilt))%4))
result=struct.pack('<III',magic,2,12+8+len(encoded)+8+len(rebuilt))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(rebuilt),0x004e4942)+rebuilt
output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(result)
print(json.dumps({'source_sha256':hashlib.sha256(raw).hexdigest(),'source_bytes':len(raw),'web_bytes':len(result),'images':report},indent=2))
