"""Cut each supplied fox into an isolated, transparent frame in both directions.
Usage: python3 scripts/prepare-fox.py /path/to/extracted/桌宠
Requires Pillow, NumPy and SciPy. No artwork is repainted or regenerated.
"""
from pathlib import Path
from PIL import Image, ImageOps
from scipy import ndimage
import numpy as np
import sys, json
root=Path(__file__).resolve().parent.parent
src=Path(sys.argv[1]); dest=root/'themes/prince/pet';dest.mkdir(parents=True,exist_ok=True)
groups={'idle':('表情.PNG',4,1,None),'walk':('走路.PNG',6,1,None),'climb':('攀爬.PNG',6,1,[2,3,4,5,4,3]),'hang':('挂着.PNG',4,2,[0,1]),'mount':('爬上去.PNG',6,1,None),'happy':('被摸和高兴.PNG',4,1,None),'jump':('跳跃.PNG',5,1,None),'held':('拎起小狐.PNG',4,1,[1,2,3]),'fail':('攀爬失败(最后一个作为乱爬被抓住).PNG',6,1,None),'rest':('被摸和高兴.PNG',4,1,[3])}
manifest={}
for name,(filename,cols,rows,indices) in groups.items():
 im=Image.open(src/filename).convert('RGBA'); pixels=np.array(im);alpha=pixels[:,:,3]
 labels,n=ndimage.label(alpha>32);sizes=np.bincount(labels.ravel());slices=ndimage.find_objects(labels)
 main=[i for i in range(1,n+1) if sizes[i]>20000]
 main.sort(key=lambda i:(int((slices[i-1][0].start+slices[i-1][0].stop)/2/(im.height/rows)),slices[i-1][1].start))
 if len(main)!=cols*rows:raise ValueError(f'{filename}: expected {cols*rows} foxes, found {len(main)}')
 # Assign detached paws and decorative marks to their nearest fox. Equal-width
 # slicing is intentionally avoided: several original poses cross cell borders.
 seeds=np.where(np.isin(labels,main),labels,0)
 distance,near=ndimage.distance_transform_edt(seeds==0,return_indices=True)
 owner=seeds[tuple(near)]
 for i in range(1,n+1):
  if i in main or sizes[i]<45:continue
  region=labels==i
  if np.min(distance[region])>90:continue
  owners=owner[region];chosen=np.bincount(owners).argmax()
  seeds[region]=chosen
 distance,near=ndimage.distance_transform_edt(seeds==0,return_indices=True)
 owner=seeds[tuple(near)]
 frames=[]
 for index in indices or range(len(main)):
  ident=main[index];mask=(owner==ident)&(distance<5)
  p=pixels.copy();p[:,:,3]=np.where(mask,alpha,0)
  frame=Image.fromarray(p);bbox=frame.getchannel('A').getbbox();frames.append(frame.crop(bbox))
 scale=min(224/max(f.width for f in frames),224/max(f.height for f in frames))
 entry={'frames':len(frames),'right':[],'left':[]}
 for i,f in enumerate(frames):
  f=f.resize((max(1,round(f.width*scale)),max(1,round(f.height*scale))),Image.Resampling.LANCZOS)
  tile=Image.new('RGBA',(256,256));tile.alpha_composite(f,((256-f.width)//2,244-f.height))
  for direction,t in [('right',tile),('left',ImageOps.mirror(tile))]:
   rel=f'{name}/{direction}-{i:02}.png';p=dest/rel;p.parent.mkdir(exist_ok=True);t.save(p,optimize=True);entry[direction].append(rel)
 manifest[name]=entry
# Remove obsolete animation strips after every isolated frame has been written.
for name in groups:
 p=dest/(name+'.webp')
 if p.exists():p.unlink()
(dest/'frames.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared',sum(v['frames'] for v in manifest.values()),'isolated frames per direction')
