import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
materials={}
def mat(c):
 if c not in materials:
  m=bpy.data.materials.new(c);m.diffuse_color=tuple(int(c[i:i+2],16)/255 for i in (1,3,5))+(1,);materials[c]=m
 return materials[c]
def ell(name,loc,scale,c,seg=12,rings=8):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat(c));bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return o
def loft(name,levels,c):
 n=12;verts=[]
 for y,rx,rz in levels:
  for i in range(n):
   a=2*math.pi*i/n;verts.append((rx*math.cos(a),y,rz*math.sin(a)))
 faces=[tuple(range(n)),tuple(reversed(range((len(levels)-1)*n,len(levels)*n)))]
 for j in range(len(levels)-1):
  for i in range(n):faces.append((j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(mat(c))
 for f in mesh.polygons:f.use_smooth=True
 return o
def strap(loc,scale,c):return ell('webbing',loc,scale,c,8,4)
lengths=[.23,.57,math.dist((-.18,1.1,-.25),(-.31,1.39,0)),math.dist((.15,1.02,-.53),(-.18,1.1,-.25)),math.dist((.4,1.13,.03),(.31,1.39,0)),math.dist((.23,1.02,-.23),(.4,1.13,.03)),.4,.38,.4,.38]
result=[]
for variant in range(3):
 cloth,kit,skin,hair,accent=[('#998063','#394c43','#c89470','#352821','#d1bb89'),('#344a60','#a76b53','#c78d70','#2c2022','#c6c9bf'),('#343c48','#596672','#815b49','#161c23','#80aaa6')][variant]
 female=variant==1;parts=[]
 for part,L in enumerate(lengths):
  before=set(bpy.data.objects)
  if part==0:
   ell('face',(0,.015,-.008),(.133 if female else .145,.184,.133),skin,16,12)
   ell('jaw',(0,-.082,-.025),(.102,.075,.106),skin)
   ell('neck',(0,-.155,0),(.072,.065,.07),skin)
   for side in [-1,1]:
    ell('ear',(side*.143,.005,0),(.022,.042,.025),skin)
    ell('eye',(side*.056,.044,-.128),(.028,.012,.011),'#e1d8c5')
    ell('iris',(side*.055,.044,-.139),(.010,.011,.005),'#25302b')
    strap((side*.056,.071,-.129),(.038,.008,.009),hair)
   ell('nose',(0,.005,-.139),(.024,.037,.034),skin)
   ell('mouth',(0,-.060,-.119),(.040,.006,.008),'#885849')
   if variant==0:
    ell('hair',(0,.116,.018),(.148,.090,.131),hair)
    ell('earpiece',(-.153,.010,.013),(.024,.045,.037),kit)
    strap((-.095,-.049,-.116),(.065,.007,.009),kit)
   elif female:
    ell('hair crown',(0,.122,.023),(.145,.087,.14),hair)
    for side in [-1,1]:ell('hair sides',(side*.125,.050,.043),(.026,.106,.09),hair)
    ell('tied hair',(0,.022,.156),(.070,.080,.070),hair)
    ell('tail',(0,-.107,.172),(.047,.13,.049),hair)
   else:
    ell('hood rear',(0,.066,.084),(.174,.17,.111),cloth)
    for side in [-1,1]:ell('hood edge',(side*.15,.04,.006),(.028,.14,.06),kit)
    ell('hood top',(0,.169,.022),(.163,.047,.139),cloth)
    ell('face wrap',(0,-.070,-.090),(.13,.065,.074),kit)
  elif part==1:
   w=.205 if female else .238
   loft('jacket',[(-.285,w*.80,.119),(-.23,w*.84,.124),(-.09,w*.82,.123),(.08,w,.147),(.20,w*1.1,.144),(.255,w*.78,.10),(.285,.095,.087)],cloth)
   ell('carrier',(0,.065,-.122),(w*.83,.177,.051),kit)
   ell('back panel',(0,.058,.125),(w*.83,.175,.045),kit)
   for side in [-1,1]:
    strap((side*w*.62,.13,-.153),(.024,.12,.012),accent)
    ell('pouch',(side*.075,-.119,-.151),(.059,.075,.030),kit)
    strap((side*.075,-.12,-.18),(.044,.007,.008),accent)
   loft('belt',[(-.28,w*.86,.132),(-.235,w*.87,.132)],'#292e30')
   if variant==2:ell('radio',(.185,.105,.03),(.037,.08,.045),kit)
  else:
   leg=part>=6;lower=part in [3,5,7,9];r=(.091 if leg else .079)*(.87 if female else 1)
   loft('trouser' if leg else 'sleeve',[(-L*.49,r*.72,r*.79),(-L*.30,r*.86,r*.88),(0,r,r*.96),(L*.29,r*1.06,r),(L*.48,r*.85,r*.87)],cloth)
   ell('joint',(0,-L*.46,0),(r*.71,.046,r*.75),cloth)
   if leg and lower:
    ell('boot',(0,-L*.42,-.047),(r*.95,.092,.146),'#2b3034')
    ell('sole',(0,-L*.59,-.049),(r,.025,.151),'#191f24')
    for y in [-.08,-.11,-.14]:strap((0,y,-.117),(.057,.008,.007),kit)
   elif lower:
    ell('glove',(0,-L*.42,0),(r*.80,.081,r*.81),kit)
    strap((0,-L*.29,-r*.66),(r*.88,.016,.015),accent)
   elif leg:
    ell('thigh seam',(.035,-.01,.073),(.039,L*.25,.015),kit)
   else:
    ell('shoulder seam',(0,L*.24,0),(r*1.11,.069,r*1.08),kit)
  objects=list(set(bpy.data.objects)-before)
  positions=[];normals=[];colors=[]
  for o in objects:
   o.data.calc_loop_triangles();c=o.data.materials[0].diffuse_color
   for tri in o.data.loop_triangles:
    for vi in tri.vertices:
     v=o.data.vertices[vi];p=o.matrix_world@v.co
     positions.extend(round(x,5) for x in p);normals.extend(round(x,5) for x in v.normal);colors.extend(round(((x+.055)/1.055)**2.4 if x>.04045 else x/12.92,5) for x in c[:3])
   o.name=f'character{variant}_part{part}_{o.name}'
   o.hide_set(True)
  parts.append({'position':positions,'normal':normals,'color':colors})
 result.append(parts)
import base64,struct
packed=[]
for char in result:
 parts=[]
 for p in char:
  vertices={};indices=[];raw=bytearray()
  for i in range(0,len(p['position']),3):
   key=tuple(round(x*10000) for x in p['position'][i:i+3])+tuple(round(x*127) for x in p['normal'][i:i+3])+tuple(round(x*255) for x in p['color'][i:i+3])
   if key not in vertices:vertices[key]=len(vertices);raw.extend(struct.pack('<hhhbbbBBB',*key))
   indices.append(vertices[key])
  parts.append([base64.b64encode(raw).decode(),base64.b64encode(struct.pack('<'+'H'*len(indices),*indices)).decode()])
 packed.append(parts)
(ROOT/'lib/game/assets').mkdir(parents=True,exist_ok=True)
(ROOT/'lib/game/assets/characters.ts').write_text('// Blender-authored packed mesh data.\nexport const CHARACTER_MESHES = '+json.dumps(packed,separators=(',',':'))+';\n')
# Source scene is arranged as three inspectable, upright characters.
rig=[(0,1.545,0),(0,1.145,0),(-.245,1.245,-.125),(-.015,1.06,-.39),(.355,1.26,.015),(.315,1.075,-.10),(-.15,.66,0),(-.15,.27,0),(.15,.66,0),(.15,.27,0)]
for o in bpy.data.objects:
 v=int(o.name.split('_')[0][9:]);part=int(o.name.split('_')[1][4:]);o.hide_set(False);o.location+=Vector(rig[part])+Vector((v*1.2,0,0))
(ROOT/'assets/blender').mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/krage-characters.blend'))
print('CHARACTERS_EXPORTED',sum(len(p['position'])//9 for c in result for p in c),'triangles')
