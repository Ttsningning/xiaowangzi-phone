"""Normalize supplied transparent action sheets; preserve the original alpha.
Usage: python3 scripts/prepare-fox.py /path/to/extracted/桌宠
"""
from pathlib import Path
from PIL import Image
import sys, json
root=Path(__file__).resolve().parent.parent
src=Path(sys.argv[1]); dest=root/'themes/prince/pet';dest.mkdir(parents=True,exist_ok=True)
groups={'idle':('表情.PNG',4,1,None),'walk':('走路.PNG',6,1,None),'climb':('攀爬.PNG',6,1,[2,3,4,5,4,3]),'hang':('挂着.PNG',4,2,[0,1]),'mount':('爬上去.PNG',6,1,None),'happy':('被摸和高兴.PNG',4,1,None),'jump':('跳跃.PNG',5,1,None),'held':('拎起小狐.PNG',4,1,[1,2,3]),'fail':('攀爬失败(最后一个作为乱爬被抓住).PNG',6,1,None),'rest':('被摸和高兴.PNG',4,1,[3])}
manifest={}
for name,(filename,cols,rows,indices) in groups.items():
 im=Image.open(src/filename).convert('RGBA'); indices=indices or list(range(cols*rows));frames=[]
 for i in indices:
  x,y=i%cols,i//cols
  f=im.crop((round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows)))
  bbox=f.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
  frames.append(f.crop(bbox) if bbox else f)
 # One scale per action preserves pose changes between its frames.
 scale=min(224/max(f.width for f in frames),224/max(f.height for f in frames))
 atlas=Image.new('RGBA',(256*len(frames),256))
 for i,f in enumerate(frames):
  f=f.resize((max(1,round(f.width*scale)),max(1,round(f.height*scale))),Image.Resampling.LANCZOS)
  atlas.alpha_composite(f,(i*256+(256-f.width)//2,244-f.height))
 atlas.save(dest/(name+'.webp'),format='WEBP',quality=88,method=6)
 manifest[name]={'frames':len(frames),'file':name+'.webp'}
(dest/'frames.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',sum(v['frames'] for v in manifest.values()),'transparent frames')
