"""Prepare supplied transparent market artwork, including the arrow in its sheet.
Usage: python3 scripts/prepare-market.py /path/to/万界杂货铺.zip
"""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
import io,sys
out=Path(__file__).resolve().parent.parent/'themes/prince/market';out.mkdir(parents=True,exist_ok=True)
art={'browse':'E48204E3-D777-45BD-B92F-E0E83849CB2F','stall':'F9E22A5C-834B-4739-A25B-2DDC789DF667','orders':'CB1AA5A8-0AD9-4CB8-8A54-B47B074DE853','feed':'010EA37B-0704-4DFE-BAD3-043F3473553B','letter':'D0FF4217-FBB6-4F55-9A43-3E924F023F32','bag':'F5C9D97E-7F07-4B86-9F65-6B64905EE41F','archive':'FD6C82D9-5B42-4D85-A2AF-09C61EA97E20','top':'B70CB5E5-8BD5-4DEF-9BA5-E574E23AEA3B','empty':'B70CB5E5-8BD5-4DEF-9BA5-E574E23AEA3B'}
with ZipFile(sys.argv[1]) as z:
 for name,ident in art.items():
  file=next(n for n in z.namelist() if n.endswith(ident+'.PNG') and not n.startswith('__MACOSX'))
  im=Image.open(io.BytesIO(z.read(file))).convert('RGBA')
  if name=='top':im=im.crop((985,310,1350,600))
  if name=='empty':im=im.crop((140,600,765,1024))
  im=im.crop(im.getchannel('A').getbbox());im.thumbnail((240,240),Image.Resampling.LANCZOS)
  tile=Image.new('RGBA',(256,256));tile.alpha_composite(im,((256-im.width)//2,(256-im.height)//2));tile.save(out/(name+'.webp'),lossless=True,method=6)
print('Prepared',len(art),'transparent market icons')
