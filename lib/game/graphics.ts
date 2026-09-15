import { CHARACTER_MESHES } from './assets/characters.js';
import { solveLimb } from './motion.js';
import { ARENA_PALETTES, COLORS } from './palette.js';
import { motionState, weaponPose } from './animation.js';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EDGE_ATTACKS, type ArenaMap, type Actor } from './core.js';
const grain = new Uint8Array(32 * 32 * 4);
for (let i = 0; i < 32 * 32; i++) {
  const hash=Math.imul(i ^ 0x6d2b79f5,0x45d9f3b) >>> 0;
  const value = 230 + ((hash ^ (hash >>> 16)) >>> 0) % 20;
  grain.set([value, value, value, 255], i * 4);
}
const surfaceGrain = new T.DataTexture(grain, 32, 32);
surfaceGrain.wrapS = surfaceGrain.wrapT = T.RepeatWrapping;
surfaceGrain.magFilter = T.LinearFilter;
surfaceGrain.minFilter = T.LinearMipmapLinearFilter;
surfaceGrain.generateMipmaps = true;
surfaceGrain.needsUpdate = true;
// Shared, deterministic concrete grain and recessed panel seams: no texture downloads.
const wallPixels = new Uint8Array(128 * 128 * 4);
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
  const seam = y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 2;
  const hash=Math.imul((x+1)*374761393 ^ (y+1)*668265263,1274126177) >>> 0;
  const shade = seam ? 178+(hash%8) : 216+(hash%15);
  wallPixels.set([shade, shade, shade, 255], (y * 128 + x) * 4);
}
const wallTexture = new T.DataTexture(wallPixels, 128, 128);
wallTexture.wrapS = wallTexture.wrapT = T.RepeatWrapping;
wallTexture.magFilter = T.LinearFilter;
wallTexture.minFilter = T.LinearMipmapLinearFilter;
wallTexture.generateMipmaps = true;
wallTexture.anisotropy = 2;
wallTexture.colorSpace = T.SRGBColorSpace;
wallTexture.needsUpdate = true;
const wallMaterials = new Map<string, T.MeshLambertMaterial>();
const materials = new Map<string, T.MeshLambertMaterial>();
export function material(color: string) {
  let m = materials.get(color);
  if (!m) {
    m = new T.MeshLambertMaterial({ color, map: surfaceGrain });
    materials.set(color, m);
  }
  return m;
}
const cube = new T.BoxGeometry(1, 1, 1);
export function box(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c: string,
) {
  const m = new T.Mesh(cube, material(c));
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const roundedCube = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
const finishes = new Map<string, T.MeshPhongMaterial>();
export function armor(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
) {
  let mat = finishes.get(color);
  if (!mat) {
    mat = new T.MeshPhongMaterial({
      color,
      shininess: 30,
      specular: '#647782',
      map: surfaceGrain,
    });
    finishes.set(color, mat);
  }
  const m = new T.Mesh(roundedCube, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function cylinder(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  c: string,
  n = 16,
) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, h, n), material(c));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function label(
  parent: T.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  size = 2,
  color = '#e6e4cf',
  rotation = 0,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '900 88px Arial';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const m = new T.Mesh(
    new T.PlaneGeometry(size * 4, size),
    new T.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.y = rotation;
  parent.add(m);
  return m;
}
/** One background draw, no downloaded skybox or dynamic cloud simulation. */
export function buildSky(mapId: number) {
  const palette = ARENA_PALETTES[mapId];
  const sky = new T.Mesh(new T.SphereGeometry(190, 24, 12), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: {
      horizon: { value: new T.Color(palette.sky) },
      zenith: { value: new T.Color(mapId === 0 ? '#668ba1' : '#607b9c') },
      cloud: { value: new T.Color(mapId === 0 ? '#eee3cf' : '#dbe4ed') },
      overcast: { value: mapId === 1 ? 0.65 : 0.0 },
    },
    vertexShader: `varying vec3 direction; void main() { direction = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: `uniform vec3 horizon; uniform vec3 zenith; uniform vec3 cloud; uniform float overcast; varying vec3 direction;
      float hash(vec3 p) { p=fract(p*0.3183099+vec3(0.13,0.37,0.71)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main() {
        vec3 d=normalize(direction);
        vec3 color=mix(horizon,zenith,smoothstep(-0.04,0.85,d.y));
        vec3 p=d*vec3(4.0,7.0,4.0)+vec3(12.4,3.7,8.9);
        float n=noise(p)*0.57+noise(p*2.03+5.1)*0.28+noise(p*4.07+9.3)*0.15;
        float density=smoothstep(0.56-overcast*0.22,0.76-overcast*0.17,n);
        float shade=noise(p+vec3(0.0,0.28,0.0));
        vec3 cloudColor=cloud*mix(0.82,1.04,shade);
        color=mix(color,cloudColor,density*smoothstep(-0.03,0.18,d.y)*0.85);
        float sun=pow(max(0.0,dot(d,normalize(vec3(-0.42,0.7,0.25)))),180.0);
        color+=vec3(0.1,0.075,0.035)*sun*(1.0-overcast);
        color+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'arena-sky'; sky.renderOrder = -100;
  sky.frustumCulled = false;
  sky.onBeforeRender = (_renderer, _scene, camera) => { sky.position.copy(camera.position); sky.updateMatrixWorld(); };
  return sky;
}
export function buildMap(map: ArenaMap) {
  const group = new T.Group();
  const palette = ARENA_PALETTES[map.id];
  group.add(buildSky(map.id));
  box(group, 0, -1.08, 0, 190, 1, 190, palette.ground);
  box(group, 0, -0.5, 0, map.width, 1, map.depth, palette.ground);
  if (map.id === 0) {
    // Distant sandstone silhouettes remain outside the playable boundary.
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const mesa = new T.Mesh(new T.CylinderGeometry(5 + i % 3, 9 + i % 4, 9 + i % 5, 5), material(i % 2 ? '#a8977d' : '#b7a88d'));
      mesa.position.set(Math.sin(angle) * 78, 0, Math.cos(angle) * 78);
      group.add(mesa);
    }
  }
  // Soft terrain at the perimeter grounds the arena without obscuring combat lanes.
  for(let i=0;i<16;i++) {
    const angle=i*Math.PI/8;
    const bank=new T.Mesh(new T.SphereGeometry(1,10,5),material(map.id===0?'#b59b78':'#c9d7e3'));
    bank.scale.set(3+i%3,map.id===0?0.65:0.85,2.6+i%2);
    bank.position.set(Math.sin(angle)*(map.width/2+5),-0.5,Math.cos(angle)*(map.depth/2+5));
    group.add(bank);
  }
  // Expansion joints and navigation markings are geometry, with no downloaded textures.
  for (let x = -map.width / 2; x < map.width / 2; x += 4)
    box(group, x, 0.003, 0, 0.024, 0.006, map.depth, palette.seam);
  for (let z = -map.depth / 2; z < map.depth / 2; z += 4)
    box(group, 0, 0.004, z, map.width, 0.006, 0.024, palette.seam);
  for (const b of map.blocks) {
    const structureColor = map.id === 0 && (b.kind === 'building' || b.kind === 'wall')
      ? (b.kind === 'wall' ? '#b7a082' : '#9b7e5e') : b.color;
    const structure = box(group, b.x, b.y, b.z, b.w, b.h, b.d, structureColor);
    if (b.kind === 'wall' || b.kind === 'building') {
      let finish = wallMaterials.get(structureColor);
      if (!finish) {
        finish = new T.MeshLambertMaterial({ color: structureColor, map: wallTexture, vertexColors: true });
        wallMaterials.set(structureColor, finish);
      }
      structure.material = finish;
      const geometry = new RoundedBoxGeometry(b.w,b.h,b.d,1,Math.min(0.055,b.h*0.025)), uv = geometry.getAttribute('uv'), normals = geometry.getAttribute('normal');
      structure.scale.set(1,1,1);
      const positions = geometry.getAttribute('position'), shades: number[] = [];
      for (let i = 0; i < uv.count; i++) {
        const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i));
        uv.setXY(i, uv.getX(i) * (nx > 0.5 ? b.d : b.w) / 3,
          uv.getY(i) * (ny > 0.5 ? b.d : b.h) / 3);
        const shade = 0.77 + (positions.getY(i) / b.h + 0.5) * 0.23;
        shades.push(shade, shade, shade);
      }
      geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3));
      structure.geometry = geometry;
      box(group, b.x, b.y + b.h / 2 - 0.055, b.z, b.w + 0.04, 0.11, b.d + 0.04, palette.trim);
    }
    if (b.y - b.h / 2 < 0.05 && b.kind !== 'wall' && b.kind !== 'step')
      box(group, b.x, 0.008, b.z, b.w + 0.16, 0.012, b.d + 0.16, palette.seam);
    if (b.kind === 'building') {
      // Recessed side panels, cladding joints and hardware stay close to the solid envelope.
      for (const side of [-1, 1]) {
        const x = b.x + side * (b.w / 2 + 0.016);
        box(group, x, b.y, b.z, 0.025, b.h * 0.7, b.d * 0.6, palette.metal);
        for (let z = b.z - b.d / 2 + 0.7; z < b.z + b.d / 2; z += 1.4)
          box(
            group,
            x + side * 0.017,
            b.y,
            z,
            0.02,
            b.h - 0.4,
            0.035,
            palette.trim,
          );
        box(
          group,
          x + side * 0.02,
          b.y + b.h * 0.3,
          b.z,
          0.02,
          0.16,
          b.d * 0.65,
          palette.accent,
        );
      }
      for (const sign of [-1, 1])
        box(
          group,
          b.x + sign * (b.w / 2 - 0.14),
          b.y,
          b.z + b.d / 2 + 0.02,
          0.18,
          b.h,
          0.035,
          palette.metal,
        );

      box(
        group,
        b.x,
        b.y + b.h / 2 + 0.12,
        b.z,
        b.w + 0.2,
        0.24,
        b.d + 0.2,
        palette.trim,
      );
      box(
        group,
        b.x,
        b.y - b.h / 2 + 0.18,
        b.z,
        b.w + 0.08,
        0.35,
        b.d + 0.08,
        palette.metal,
      );
      for (let x = b.x - b.w / 2 + 1; x < b.x + b.w / 2 - 0.5; x += 2) {
        box(
          group,
          x,
          b.y + 0.4,
          b.z + b.d / 2 + 0.035,
          1.1,
          1.4,
          0.07,
          palette.glass,
        );
        box(
          group,
          x,
          b.y + 0.4,
          b.z + b.d / 2 + 0.085,
          0.055,
          1.4,
          0.02,
          palette.trim,
        );
        box(
          group,
          x,
          b.y + 0.4,
          b.z + b.d / 2 + 0.085,
          1.1,
          0.06,
          0.02,
          palette.trim,
        );
      }
      box(group, b.x, b.y + b.h / 2 + 0.45, b.z, 1.6, 0.6, 1.2, palette.metal);
      for (let n = 0; n < 5; n++)
        box(
          group,
          b.x - 0.6 + n * 0.3,
          b.y + b.h / 2 + 0.45,
          b.z + 0.61,
          0.07,
          0.4,
          0.03,
          palette.glass,
        );
      box(
        group,
        b.x + b.w / 2 - 0.5,
        b.y,
        b.z + b.d / 2 + 0.08,
        0.12,
        b.h,
        0.12,
        palette.metal,
      );
    } else if (b.kind === 'crate') {
      for (const side of [-1, 1]) {
        box(
          group,
          b.x + side * (b.w / 2 - 0.12),
          b.y,
          b.z,
          b.w > 0.5 ? 0.16 : 0.08,
          b.h + 0.04,
          b.d + 0.05,
          palette.metal,
        );
        box(
          group,
          b.x,
          b.y,
          b.z + side * (b.d / 2 + 0.02),
          b.w,
          0.11,
          0.035,
          palette.trim,
        );
      }
    } else if (b.kind === 'platform' || b.kind === 'bridge') {
      box(
        group,
        b.x,
        b.y + b.h / 2 + 0.035,
        b.z,
        b.w + 0.08,
        0.07,
        b.d + 0.08,
        palette.trim,
      );
      for (let z = b.z - b.d / 2 + 0.4; z < b.z + b.d / 2; z += 0.8)
        box(
          group,
          b.x + b.w / 2 + 0.01,
          b.y + b.h / 2 - 0.35,
          z,
          0.025,
          0.22,
          0.4,
          palette.accent,
        );
    }
  }
  // Route stripes; A and B ends are visually identifiable from either approach.
  for (const s of [-1, 1]) {
    for (let z = -map.depth / 2 + 3; z < map.depth / 2 - 2; z += 2.5)
      box(group, s * 5, 0.012, z, 0.13, 0.012, 1.3, palette.trim);
    box(
      group,
      0,
      0.015,
      s * (map.depth / 2 - 2),
      8,
      0.016,
      0.35,
      s === 1 ? COLORS.ally : COLORS.enemy,
    );
  }
  if (map.id === 0) {
    label(group, 'DUNE', -17, 5.6, -7.96, 1.15, '#ffcf85');
    label(group, '07', 0, 2.6, -15.46, 0.65, '#f3b669');
    // Exhaust stacks, pipes and ribbed steel distinguish the warm industrial yard.
    for (const x of [-2.5, 0, 2.5]) {
      cylinder(group, x, 5.8, -17, 0.65, 4, '#665c50');
      cylinder(group, x, 7.8, -17, 0.77, 0.15, '#a08767');
    }
    for (const b of map.blocks) {
      if (b.kind === 'furnace') {
        for (let i = 0; i < 7; i++)
          box(
            group,
            b.x - 3 + i,
            1.6,
            b.z + b.d / 2 + 0.02,
            0.5,
            0.12,
            0.035,
            '#e49336',
          );
      }
      if (b.kind === 'building') {
        for (let x = b.x - b.w / 2 + 0.2; x < b.x + b.w / 2; x += 0.65)
          box(
            group,
            x,
            b.y,
            b.z - b.d / 2 - 0.025,
            0.06,
            b.h - 0.5,
            0.05,
            '#624934',
          );
      }
      if (b.kind === 'tank') {
        for (let z = b.z - b.d / 2 + 0.7; z < b.z + b.d / 2; z += 1.4) {
          cylinder(group, b.x, b.y, z, 1.25, b.h, '#707356');
          cylinder(group, b.x, b.y + b.h / 2 + 0.05, z, 1.3, 0.12, '#afa17b');
        }
      }
    }
    for (const x of [-23, 23]) {
      box(group, x, 7.6, -19, 0.5, 15.2, 0.5, '#554939');
      box(group, x, 14.8, -12, 0.45, 0.45, 14, '#a47337');
    }
    for (let n = 0; n < 10; n++) {
      const angle = (n / 10) * Math.PI * 2,
        x = Math.sin(angle) * 72,
        z = Math.cos(angle) * 72;
      box(group, x, 5 + (n % 4), z, 7, 10 + (n % 4) * 2, 8, '#64738b');
      if (n % 2 === 0) cylinder(group, x, 13, z, 1.2, 18, '#4e5d72');
    }
  } else {
    // Terrain silhouettes and outposts stay beyond the playable walls.
    for (let i=0;i<16;i++) {
      const angle=i*Math.PI/8, radius=92+(i%3)*5, height=23+(i%5)*5;
      const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
      const ridge=new T.Mesh(new T.ConeGeometry(15+i%4,height,6),material(i%2?'#8196aa':'#9badbb'));
      ridge.position.set(x,height*.24-4,z);ridge.rotation.y=angle;group.add(ridge);
      const cap=new T.Mesh(new T.ConeGeometry((15+i%4)*.48,height*.48,6),material('#dce5ea'));
      cap.position.set(x,ridge.position.y+height*.26,z);cap.rotation.y=angle;group.add(cap);
    }
    for (const side of [-1,1]) {
      const x=side*(map.width/2+10),z=side*12;
      box(group,x,2,z,6,4,5,'#637b8d');box(group,x,4.08,z,6.3,.24,5.3,'#e0e9ed');
      for(const dx of [-1.8,0,1.8])box(group,x+dx,2.5,z+2.51,1.1,.85,.035,'#adcbd7');
      box(group,x+2,1,z+2.53,1.2,2,.05,'#344b5f');
      cylinder(group,x-1.7,4.8,z-1.5,.18,1.6,'#455b6c',8);
      for(let i=0;i<6;i++) {
        const tx=side*(map.width/2+6+i%3*3),tz=-map.depth/2-7-i*4;
        cylinder(group,tx,1,tz,.18,2,'#5b6870',6);
        for(let tier=0;tier<3;tier++) {
          const tree=new T.Mesh(new T.ConeGeometry(1.7-tier*.35,2.7,6),material(tier%2?'#a2b9be':'#5c7980'));
          tree.position.set(tx,2+tier*1.15,tz);group.add(tree);
        }
      }
    }
    label(group, 'SNOW', -13, 4.8, -7.96, 1.2, '#d1f3ff');
    // Blue research campus: equipment cabinets, luminous seams and antenna dishes.
    for (const b of map.blocks) {
      if (b.kind === 'building') {
        box(
          group,
          b.x,
          b.y + b.h / 2 - 0.65,
          b.z + b.d / 2 + 0.04,
          b.w - 0.4,
          0.1,
          0.04,
          palette.accent,
        );
        box(
          group,
          b.x,
          b.y + b.h / 2 + 0.25,
          b.z,
          b.w * 0.7,
          0.4,
          b.d * 0.7,
          '#dce9ec',
        );
      }
      if (b.kind === 'server') {
        for (let y = 0.4; y < 2.4; y += 0.3) {
          box(
            group,
            b.x,
            y,
            b.z + b.d / 2 + 0.03,
            b.w - 0.4,
            0.14,
            0.04,
            '#314e6d',
          );
          box(
            group,
            b.x + b.w / 2 - 0.35,
            y,
            b.z + b.d / 2 + 0.065,
            0.08,
            0.06,
            0.02,
            palette.accent,
          );
        }
      }
    }
    for (const x of [-17, 17]) {
      const mast = cylinder(group, x, 7, x < 0 ? -11 : 11, 0.13, 7, '#627e91');
      mast.name = 'antenna';
      const dish = new T.Mesh(
        new T.SphereGeometry(1.8, 20, 10, 0, Math.PI * 2, 0, 0.8),
        material('#e1edf0'),
      );
      dish.rotation.x = x < 0 ? -0.9 : 0.9;
      dish.position.set(x, 10, x < 0 ? -11 : 11);
      group.add(dish);
    }
    for (let n = 0; n < 12; n++) {
      const angle = (n / 12) * Math.PI * 2;
      const peak = new T.Mesh(
        new T.ConeGeometry(9 + (n % 4), 15 + (n % 5) * 3, 7),
        material(n % 2 ? '#9cb2c6' : '#c6d6df'),
      );
      peak.position.set(Math.sin(angle) * 65, 2, Math.cos(angle) * 65);
      group.add(peak);
    }
  }
  // Directional signs and edge strips are tied to the actual routes.
  label(
    group,
    'A',
    -map.width / 2 + 1.1,
    2,
    -5,
    0.9,
    map.id === 0 ? '#edc584' : '#c7ecff',
    Math.PI / 2,
  );
  label(
    group,
    'B',
    map.width / 2 - 1.1,
    2,
    5,
    0.9,
    map.id === 0 ? '#edc584' : '#c7ecff',
    -Math.PI / 2,
  );
  for (const b of map.blocks) {
    if (b.kind === 'step')
      box(
        group,
        b.x,
        b.y + b.h / 2 + 0.008,
        b.z - b.d / 2 + 0.07,
        b.w,
        0.015,
        0.09,
        map.id === 0 ? '#d5ad62' : '#bde5ef',
      );
  }
  // Merge static opaque meshes by material: dozens of surfaces become a few draw calls.
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  const remove: T.Object3D[] = [];
  group.traverse((o) => {
    if (o instanceof T.Mesh && o.material instanceof T.MeshLambertMaterial) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const list = batches.get(o.material) ?? [];
      list.push(g);
      batches.set(o.material, list);
      remove.push(o);
    }
  });
  for (const o of remove) {
    group.remove(o);
    if (
      o instanceof T.Mesh &&
      o.geometry !== cube &&
      o.geometry !== roundedCube
    )
      o.geometry.dispose();
  }
  for (const [m, geos] of batches) {
    const g = mergeGeometries(geos);
    if (g) {
      const mesh = new T.Mesh(g, m);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    geos.forEach((g) => g.dispose());
  }
  return group;
}
export function makeWeapon(index: number, firstPerson = true, finish = 0) {
  const g = new T.Group();
  const dark = finish === 4 ? '#18272c' : finish === 1 ? '#3f5e7b' : finish === 2 ? '#172331' : finish === 3 ? '#261e39' : '#233032',
    metal = finish === 4 ? '#748489' : finish === 1 ? '#bacbdc' : finish === 2 ? '#8e614d' : finish === 3 ? '#726494' : '#687b90',
    wood = finish === 4 ? '#2b3e43' : finish === 1 ? '#dce7ec' : finish === 2 ? '#e78851' : finish === 3 ? '#ac8cf5' : '#a6643f';
  if (index === 3) {
    armor(g, 0.01, 0, 0.05, 0.075, 0.09, 0.27, dark);
    armor(g, 0.01, 0.01, -0.1, 0.19, 0.045, 0.05, metal);
    const shape = new T.Shape();
    shape.moveTo(-0.05, 0);
    shape.lineTo(0.05, 0);
    shape.lineTo(0.045, 0.37);
    shape.lineTo(0, 0.54);
    shape.lineTo(-0.045, 0.37);
    shape.closePath();
    const blade = new T.Mesh(
      new T.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelSegments:1, steps:1, bevelSize:0.004, bevelThickness:0.004 }),
      material('#b8d0ca'),
    );
    blade.rotation.x = -Math.PI / 2;
    blade.position.set(0.01, 0, -0.12);
    g.add(blade);
  } else {
    armor(
      g,
      0,
      0,
      0,
      index === 2 ? 0.18 : 0.125,
      0.145,
      index === 0 ? 0.35 : 0.48,
      dark,
    );
    armor(
      g,
      0,
      -0.09,
      0.11,
      0.09,
      0.22,
      0.1,
      index === 2 ? wood : dark,
    ).rotation.x = -0.22;
    armor(
      g,
      0,
      -0.01,
      0.3,
      0.12,
      0.13,
      0.3,
      index === 1 || index === 2 ? wood : metal,
    );
    if (index !== 2) {
      const mag = armor(
        g,
        0,
        -0.17,
        -0.03,
        0.085,
        0.28,
        0.13,
        index === 1 ? '#3b4949' : dark,
      );
      mag.name = 'magazine';
      mag.rotation.x = index === 1 ? -0.22 : 0;
      armor(g, 0, -0.32, -0.055, 0.088, 0.07, 0.12, dark).name =
        'magazine-extension';
    }
    armor(
      g,
      0,
      0.005,
      -0.32,
      index === 2 ? 0.19 : 0.12,
      0.12,
      0.25,
      index === 1 || index === 2 ? wood : metal,
    );
    const barrels = index === 2 ? [-0.055, 0.055] : [0];
    for (const x of barrels) {
      const b = cylinder(
        g,
        x,
        0.02,
        index === 0 ? -0.49 : -0.62,
        index === 2 ? 0.043 : 0.031,
        index === 0 ? 0.24 : 0.48,
        metal,
      );
      b.rotation.x = Math.PI / 2;
      const tip = cylinder(
        g,
        x,
        0.02,
        index === 0 ? -0.62 : -0.86,
        index === 2 ? 0.045 : 0.039,
        0.055,
        dark,
      );
      tip.rotation.x = Math.PI / 2;
    }
    armor(g, 0, 0.107, 0.08, 0.08, 0.04, 0.09, dark);
    armor(g, -0.035, 0.147, 0.1, 0.015, 0.055, 0.025, metal);
    armor(g, 0.035, 0.147, 0.1, 0.015, 0.055, 0.025, metal);
    armor(g, 0, 0.085, -0.56, 0.035, 0.09, 0.05, metal);
    armor(g, 0, 0.146, -0.56, 0.013, 0.065, 0.03, dark);
    armor(g, 0, 0.184, -0.56, 0.012, 0.009, 0.018, '#d9e8b0');
    armor(g, 0.07, 0.02, -0.04, 0.02, 0.06, 0.17, '#69807d');
    if (index === 0)
      armor(g, -0.065, -0.005, -0.16, 0.009, 0.032, 0.13, '#ef7548');
  }
  if (index !== 3) {
    // Receiver rail, a dark muzzle bore and serial plate add readable depth.
    armor(g, 0, 0.083, -0.035, 0.07, 0.012, 0.25, '#7c8ea1');
    armor(g, 0.069, -0.024, 0.12, 0.008, 0.028, 0.07, '#c5d3df');
    for (let z = -0.13; z <= 0.06; z += 0.038)
      armor(g, 0, 0.091, z, 0.073, 0.009, 0.01, '#263549');
    for (const x of index === 2 ? [-0.055, 0.055] : [0]) {
      const bore = cylinder(
        g,
        x,
        0.02,
        index === 0 ? -0.65 : -0.89,
        index === 2 ? 0.031 : 0.023,
        0.003,
        '#080f19',
        20,
      );
      bore.rotation.x = Math.PI / 2;
    }
    // Trigger guard, ejection port, receiver pins, ribbing and tactile grips.
    const guard = new T.Mesh(
      new T.TorusGeometry(0.07, 0.012, 6, 16, Math.PI * 1.65),
      material(metal),
    );
    guard.position.set(0, -0.14, 0.01);
    guard.rotation.y = Math.PI / 2;
    g.add(guard);
    armor(g, 0.069, 0.02, -0.025, 0.009, 0.043, 0.11, '#111b23');
    for (const z of [-0.12, 0.04, 0.17]) {
      const pin = cylinder(g, 0.073, 0.008, z, 0.011, 0.012, '#95a4a8');
      pin.rotation.z = Math.PI / 2;
    }
    for (let z = -0.42; z < -0.23; z += 0.032)
      armor(
        g,
        0,
        -0.004,
        z,
        index === 2 ? 0.198 : 0.133,
        0.127,
        0.01,
        index === 1 ? '#734323' : '#354854',
      );
    for (let y = -0.2; y < -0.05; y += 0.035)
      armor(g, 0, y, 0.165, 0.095, 0.008, 0.014, '#1a242a');
    if (index === 0) {
      // Compact receiver, cooling slots and folding-stock hardware.
      armor(g,0,.083,-.03,.105,.035,.27,metal);
      for(const side of [-1,1]) {
        for(let i=0;i<4;i++)armor(g,side*.065,.018,-.31+i*.037,.008,.038,.019,dark);
        armor(g,side*.055,-.015,.31,.018,.065,.24,dark);
      }
      armor(g,0,-.018,.445,.125,.155,.024,dark);
      armor(g,-.078,.032,.07,.035,.023,.06,metal);
    }
    if (index === 2) {
      armor(g,0,.081,.085,.025,.028,.105,metal);
      for(const side of [-1,1]) {
        armor(g,side*.065,.081,.105,.019,.035,.047,dark).rotation.x=-.25;
        armor(g,side*.085,.006,.06,.014,.09,.18,metal);
      }
      armor(g,0,-.01,.455,.128,.15,.03,dark);
    }
    if (index === 1) {
      // Receiver cover, gas tube, safety and stock pad define the rifle silhouette.
      armor(g, 0, 0.074, 0.035, 0.11, 0.045, 0.35, metal);
      const gas = cylinder(g, 0, 0.065, -0.48, 0.022, 0.33, dark, 8);
      gas.rotation.x = Math.PI / 2;
      armor(g, 0.069, 0.005, 0.08, 0.012, 0.022, 0.16, metal).rotation.x = -0.15;
      armor(g, 0, -0.01, 0.455, 0.125, 0.145, 0.025, dark);
      // Continuous curved magazine rather than a stack of rectangular blocks.
      for(const child of g.children.filter(c=>c.name.startsWith('magazine'))){disposeObject(child);g.remove(child);}
      const profile=new T.Shape();profile.moveTo(-.025,-.08);profile.lineTo(.075,-.08);profile.quadraticCurveTo(.085,-.24,.19,-.40);profile.lineTo(.07,-.43);profile.quadraticCurveTo(-.01,-.28,-.025,-.08);
      const mag=new T.Mesh(new T.ExtrudeGeometry(profile,{depth:.077,steps:1,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:2,curveSegments:6}),material('#35413e'));
      mag.rotation.y=Math.PI/2;mag.position.x=-.0385;mag.name='magazine';g.add(mag);
      for(const side of [-1,1])for(let i=0;i<3;i++){const rib=armor(g,side*.043,-.17-i*.075,-.025-i*.04,.008,.065,.015,metal);rib.rotation.x=-.22-i*.12;rib.name='magazine-extension';}
      const cover=cylinder(g,0,.064,.01,.061,.34,metal,12);cover.rotation.x=Math.PI/2;cover.scale.x=.82;

    }
    if (index === 2) {
      armor(g, 0.055, -0.02, -0.3, 0.075, 0.13, 0.3, wood);
      armor(g, -0.055, -0.02, -0.3, 0.075, 0.13, 0.3, wood);
    }
    const bolt = armor(g, 0.083, 0.025, 0.025, 0.024, 0.025, 0.08, '#889296');
    bolt.name = 'bolt';
  }
  if(index===0){
    for(let i=0;i<6;i++)armor(g,0,0.095,-0.22+i*0.055,0.11,0.023,0.021,dark);
    armor(g,0.069,0.018,-0.075,0.008,0.06,0.15,'#111b22');
    armor(g,0.081,0.025,-0.01,0.028,0.025,0.06,metal);
    for(const side of [-1,1])armor(g,side*0.054,0.015,0.27,0.021,0.035,0.3,dark);
    armor(g,0,-0.025,0.46,0.115,0.18,0.04,dark);
  }else if(index===1){
    const cover=cylinder(g,0,0.055,0,0.059,0.37,metal,10);cover.rotation.x=Math.PI/2;
    for(const side of [-1,1])for(const z of [-0.12,0.08]){const pin=cylinder(g,side*0.066,-0.014,z,0.009,0.008,'#a7b0ad',6);pin.rotation.z=Math.PI/2;}
    armor(g,0.075,-0.01,0.07,0.015,0.019,0.16,dark).rotation.x=-0.16;
  }else if(index===2){
    for(const side of [-1,1]){
      armor(g,side*0.096,0,0,0.018,0.115,0.22,metal);
      for(let i=0;i<3;i++)armor(g,side*0.108,0.025-i*0.025,-0.03+i*0.025,0.006,0.006,0.055,'#bdac7f');
    }
    armor(g,0,0.076,0.075,0.018,0.026,0.12,metal).rotation.y=0.25;
  }
  if(finish===4&&index<3){
    const accent=['#85d9cf','#d8b68a','#b4a0dc'][index];
    for(const side of [-1,1]){
      armor(g,side*.077,.043,-.09,.009,.013,.2,accent);
      for(let n=0;n<3;n++)armor(g,side*.079,.016-n*.02,-.01+n*.018,.008,.007,.035,accent);
    }
  }
  if (firstPerson) {
    const hands = new T.Group();
    hands.name = 'support-hand';
    g.add(hands);
    armor(g, 0.04, -0.15, 0.12, 0.12, 0.11, 0.17, '#293b39');
    for(let i=0;i<3;i++)armor(g,.097,-.17+i*.025,.085,.024,.02,.07,'#465650');
    armor(g,.038,-.205,.19,.13,.018,.055,'#182b2d');
    armor(g, 0.05, -0.22, 0.3, 0.14, 0.15, 0.35, '#56625e');
    if (index !== 3) {
      armor(hands, -0.07, -0.12, -0.35, 0.11, 0.11, 0.17, '#293b39');
      for(let i=0;i<3;i++)armor(hands,-.025,-.1,-.4+i*.04,.07,.024,.023,'#465650');
      const arm = armor(hands, -0.18, -0.24, -0.2, 0.14, 0.15, 0.36, '#56625e');
      arm.rotation.y = -0.55;
    }
  }
  if (index === 2) {
    const hinge = new T.Group();
    hinge.name = 'barrel-hinge';
    hinge.position.z = -0.18;
    for (const child of g.children.slice())
      if (child instanceof T.Mesh && child.position.z < -0.22) {
        child.position.z += 0.18;
        hinge.add(child);
      }
    g.add(hinge);
    for (const x of [-0.055, 0.055]) {
      const shell = cylinder(hinge, x, 0.02, -0.015, 0.028, 0.09, '#af654a', 8);
      shell.rotation.x = Math.PI / 2;
      shell.name = x < 0 ? 'shell-left' : 'shell-right';
      const rim=cylinder(hinge,x,0.02,0.032,0.03,0.012,'#c3a464',8);rim.rotation.x=Math.PI/2;
    }
  }
  const magParts = g.children.filter(
    (part) => part.name === 'magazine' || part.name === 'magazine-extension',
  );
  if (magParts.length) {
    const magazine = new T.Group();
    magazine.name = 'reload-magazine';
    g.add(magazine);
    for (const part of magParts) {
      part.name = '';
      magazine.add(part);
    }
  }
  batchPart(g);
  g.userData.weapon = index;
  return g;
}
export const RIG_POINTS = [
  [0, 1.66, 0],
  [0, 1.43, 0],
  [0, 0.86, 0],
  [-0.31, 1.39, 0],
  [-0.18, 1.1, -0.25],
  [0.15, 1.02, -0.53],
  [0.31, 1.39, 0],
  [0.4, 1.13, 0.03],
  [0.23, 1.02, -0.23],
  [-0.15, 0.86, 0],
  [-0.15, 0.46, 0],
  [-0.15, 0.08, 0],
  [0.15, 0.86, 0],
  [0.15, 0.46, 0],
  [0.15, 0.08, 0],
];
export const RIG_LINKS = [
  [1, 0],
  [2, 1],
  [4, 3],
  [5, 4],
  [7, 6],
  [8, 7],
  [10, 9],
  [11, 10],
  [13, 12],
  [14, 13],
];
export type Avatar = {
  group: T.Group;
  parts: T.Group[];
  joints: T.Vector3[];
  legs: T.Group[];
  arms: T.Group[];
  head: T.Group;
  shadow: T.Mesh;
  ring: T.Mesh;
  weapon: T.Group;
  gunId: number;
  finish: number;
};
/** Batch each independently animated part into one vertex-colored draw. */
const rigMaterial = new T.MeshPhongMaterial({
  vertexColors: true,
  map: surfaceGrain,
  shininess: 18,
  specular: '#45515b',
});
export function batchPart(group: T.Group) {
  for (const child of group.children)
    if (child instanceof T.Group) batchPart(child);
  const meshes = group.children.filter(
    (c): c is T.Mesh =>
      c instanceof T.Mesh &&
      (c.material instanceof T.MeshPhongMaterial ||
        c.material instanceof T.MeshLambertMaterial) &&
      !c.name,
  );
  if (!meshes.length) return;
  const geometries = meshes.map((mesh) => {
    mesh.updateMatrix();
    const g = (
      mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    ).applyMatrix4(mesh.matrix);
    const colors = new Float32Array(g.attributes.position.count * 3);
    const color = (mesh.material as T.MeshPhongMaterial).color;
    for (let i = 0; i < colors.length; i += 3)
      colors.set([color.r, color.g, color.b], i);
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    if (!g.getAttribute('uv'))
      g.setAttribute(
        'uv',
        new T.BufferAttribute(
          new Float32Array(g.attributes.position.count * 2),
          2,
        ),
      );
    mesh.removeFromParent();
    if (mesh.geometry !== cube && mesh.geometry !== roundedCube)
      mesh.geometry.dispose();
    return g;
  });
  const geometry = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  if (geometry) {
    const mesh = new T.Mesh(geometry, rigMaterial);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
}
const poseFacing = new T.Vector3(),
  poseY = new T.Vector3(),
  poseX = new T.Vector3(),
  poseZ = new T.Vector3(),
  poseMatrix = new T.Matrix4();
export function poseAvatar(model: Avatar, points: T.Vector3[], yaw = 0) {
  poseFacing.set(Math.sin(yaw), 0, Math.cos(yaw));
  for (let i = 0; i < RIG_LINKS.length; i++) {
    const [a, b] = RIG_LINKS[i],
      part = model.parts[i];
    poseY.subVectors(points[b], points[a]);
    const length = poseY.length();
    poseY.normalize();
    poseX.crossVectors(poseY, poseFacing).normalize();
    if (poseX.lengthSq() < 0.1) poseX.set(1, 0, 0);
    poseZ.crossVectors(poseX, poseY).normalize();
    part.position.copy(points[a]).lerp(points[b], 0.5);
    part.quaternion.setFromRotationMatrix(
      poseMatrix.makeBasis(poseX, poseY, poseZ),
    );
    part.scale.y = length / part.userData.length;
  }
  if (points !== model.joints)
    for (let i = 0; i < points.length; i++) model.joints[i].copy(points[i]);
}
const characterMaterial=new T.MeshPhongMaterial({vertexColors:true,shininess:12,specular:'#30383b'});
export function avatar(color: string, variant = 0, finish = 0): Avatar {
  const group = new T.Group();
  group.userData.operator = variant;
  const points = RIG_POINTS.map(p=>new T.Vector3(...p));
  const parts = RIG_LINKS.map(([a,b],i)=>{
    const part=new T.Group();part.userData.length=points[a].distanceTo(points[b]);group.add(part);
    const [packed,triangles]=CHARACTER_MESHES[Math.max(0,Math.min(2,variant))][i];
    const raw=Uint8Array.from(atob(packed),c=>c.charCodeAt(0)),view=new DataView(raw.buffer),count=raw.length/12;
    const position=new Float32Array(count*3),normal=new Float32Array(count*3),colors=new Float32Array(count*3);
    for(let n=0;n<count;n++)for(let axis=0;axis<3;axis++){
      position[n*3+axis]=view.getInt16(n*12+axis*2,true)/10000;
      normal[n*3+axis]=view.getInt8(n*12+6+axis)/127;
      colors[n*3+axis]=view.getUint8(n*12+9+axis)/255;
    }
    const bytes=Uint8Array.from(atob(triangles),c=>c.charCodeAt(0)),iv=new DataView(bytes.buffer),index=new Uint16Array(bytes.length/2);
    for(let n=0;n<index.length;n++)index[n]=iv.getUint16(n*2,true);
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(position,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setIndex(new T.BufferAttribute(index,1));
    const mesh=new T.Mesh(geometry,characterMaterial);mesh.castShadow=mesh.receiveShadow=true;part.add(mesh);
    if(i===1){armor(part,0,.12,-.174,.20,.035,.012,color);armor(part,0,.12,.173,.20,.035,.012,color);}
    return part;
  });
  const gun = makeWeapon(1, false, finish);
  gun.scale.setScalar(0.65);
  gun.position.set(0.2, 1.1, -0.3);
  group.add(gun);
  const shadow = new T.Mesh(
    new T.CircleGeometry(0.5, 16),
    new T.MeshBasicMaterial({
      color: '#101820',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  group.add(shadow);
  const ring = new T.Mesh(
    new T.TorusGeometry(0.56, 0.013, 3, 24),
    new T.MeshBasicMaterial({
      color: '#d3e2ce',
      transparent: true,
      opacity: 0.7,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);
  const model = {
    group,
    parts,
    joints: points,
    head: parts[0],
    arms: [parts[2], parts[4]],
    legs: [parts[6], parts[8]],
    shadow,
    ring,
    weapon: gun,
    gunId: 1,
    finish,
  };
  poseAvatar(model, points);
  return model;
}
/** Death copies transforms and shares the already-uploaded render assets. */
export function cloneAvatar(source: Avatar): Avatar {
  const group = source.group.clone(true);
  delete group.userData.locomotion;
  group.traverse((part) => {
    part.userData.borrowed = true;
  });
  const match = <TPart extends T.Object3D>(part: TPart) =>
    group.children[source.group.children.indexOf(part)] as TPart;
  return {
    group,
    parts: source.parts.map(match),
    joints: source.joints.map((p) => p.clone()),
    head: match(source.head),
    legs: source.legs.map(match),
    arms: source.arms.map(match),
    shadow: match(source.shadow),
    ring: match(source.ring),
    weapon: match(source.weapon),
    gunId: source.gunId,
    finish: source.finish,
  };
}
export function animateAvatar(model: Avatar, a: Actor, time: number, frameDt = 1 / 60) {
  model.group.position.copy(a.pos);
  model.group.rotation.y = a.yaw;
  model.group.visible = a.alive;
  const state = motionState(a);
  model.group.userData.motion = state;
  const speed = state === 'slide' ? 0 : Math.hypot(a.vel.x, a.vel.z),
    stance = a.stanceBlend ?? Math.max(0, Math.min(1, (1.67 - a.viewHeight) / 0.73));
  const points = model.joints;
  for (let i = 0; i < RIG_POINTS.length; i++)
    points[i].set(RIG_POINTS[i][0], RIG_POINTS[i][1], RIG_POINTS[i][2]);
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12])
    points[i].y -= stance * (i === 2 || i === 9 || i === 12 ? 0.48 : 0.65);
  points[0].z -= Math.sin(a.pitch) * 0.09;
  const memory = model.group.userData.locomotion ??= {
    time, spawn: a.spawnId, velocity: new T.Vector3(), lean: new T.Vector3(),
    feet: [new T.Vector3(),new T.Vector3()], planted: [false,false], air: 0,
    footTargets: [new T.Vector3(-0.15,0.08,0),new T.Vector3(0.15,0.08,0)],
    scratch: new T.Vector3(), jointVelocity: points.map(() => new T.Vector3()), previousJoints: points.map(p => p.clone()),
  };
  const dt = Math.max(0.001, Math.min(0.05, frameDt));
  if (memory.spawn !== a.spawnId || time-memory.time > 0.25) {
    memory.planted.fill(false); memory.velocity.copy(a.vel); memory.lean.set(0,0,0);
  }
  memory.spawn=a.spawnId; memory.time=time;
  const ax=(a.vel.x-memory.velocity.x)/dt, az=(a.vel.z-memory.velocity.z)/dt;
  const blend=1-Math.exp(-dt*12);
  memory.lean.x += (Math.max(-0.045,Math.min(0.045,-ax*0.0015))-memory.lean.x)*blend;
  memory.lean.z += (Math.max(-0.045,Math.min(0.045,-az*0.0015))-memory.lean.z)*blend;
  memory.velocity.copy(a.vel);
  const leanX=Math.cos(a.yaw)*memory.lean.x-Math.sin(a.yaw)*memory.lean.z;
  const leanZ=Math.sin(a.yaw)*memory.lean.x+Math.cos(a.yaw)*memory.lean.z;
  memory.air += ((a.grounded ? 0 : 1) - memory.air) * blend;
  const compression=(a.landingCompression??0)*0.13;
  const air=a.grounded?0:Math.max(0,Math.min(1,(a.vel.y+9)/18));
  for (const i of [0,1,2,3,4,5,6,7,8,9,12]) {
    points[i].y-=compression + 0.06 * (1-stance);
    points[i].x+=leanX*(i===0?1:0.6);
    points[i].z+=leanZ*(i===0?1:0.6);
  }
  for (const [hip,knee,foot,offset,index] of [[9,10,11,0,0],[12,13,14,Math.PI,1]]) {
    const phase=(a.stride*3.5+offset)%(Math.PI*2);
    const lateral=speed>0.1?(Math.cos(a.yaw)*a.vel.x-Math.sin(a.yaw)*a.vel.z)/speed:0;
    const forward=speed>0.1?(Math.sin(a.yaw)*a.vel.x+Math.cos(a.yaw)*a.vel.z)/speed:0;
    const stride=Math.sin(phase)*Math.min(0.26,speed*0.043);
    const target=points[foot];
    target.x+=stride*lateral;target.z+=stride*forward;
    target.y+=(1-memory.air)*Math.max(0,Math.sin(phase))*Math.min(0.14,speed*0.024)+memory.air*(0.08+air*0.12);
    target.z+=(a.slideBlend??0)*0.22;
    const planted=a.grounded && speed>0.3 && a.slide<=0 && phase>=Math.PI;
    if(planted){
      if(!memory.planted[index]) memory.feet[index].copy(target).applyAxisAngle(new T.Vector3(0,1,0),a.yaw).add(a.pos);
      target.copy(memory.feet[index]).sub(a.pos).applyAxisAngle(new T.Vector3(0,1,0),-a.yaw);
      // Release a plant if a turn or correction would overextend the leg.
      if(target.distanceTo(points[hip])>0.775) { memory.planted[index]=false; target.set(RIG_POINTS[foot][0],0.08,0); }
      else memory.planted[index]=true;
    } else {
      memory.planted[index]=false;
      target.copy(memory.footTargets[index].lerp(target,1-Math.exp(-dt*24)));
    }
    const solved=solveLimb(points[hip],target,0.4,0.38,{x:0,y:0,z:-1});
    points[knee].copy(solved.joint);target.copy(solved.end);
    memory.footTargets[index].copy(target);
  }
  const breath = Math.sin(time * 2) * 0.006;
  const flinch = a.hp < 100 ? Math.max(0, 1 - (time - a.lastDamage) * 9) : 0;
  points[0].z += flinch * 0.07;
  points[1].z += flinch * 0.045;
  points[0].y += breath;
  points[1].y += breath;
  const reload = weaponPose(a).lower;
  const aimLift = Math.sin(a.pitch) * 0.22;
  points[8].y += aimLift;
  points[7].y += aimLift * 0.5;
  points[5].set(
    0.15 - reload * 0.12,
    1.02 - stance * 0.65 - compression - 0.06 * (1-stance) - reload * 0.22 + aimLift,
    -0.53 + reload * 0.35,
  );
  const edgeSpec=EDGE_ATTACKS[a.edgeAttack ?? 'slash'];
  const edgePhase=a.weapon===3&&a.fired>0 ? Math.max(0,1-a.fired/edgeSpec.duration) : 0;
  const edgeContact=edgeSpec.contact/edgeSpec.duration;
  const edgeSwing=edgePhase<edgeContact ? Math.sin(edgePhase/edgeContact*Math.PI/2) : Math.pow(1-(edgePhase-edgeContact)/(1-edgeContact),2);
  const edgeAmount=a.weapon===3&&a.fired>0?edgeSwing:0;
  const edgeSide=a.edgeSide||1;
  points[8].z-=edgeAmount*(a.edgeAttack==='stab'?0.35:0.12);
  points[8].x+=a.edgeAttack==='stab'?0:edgeAmount*edgeSide*0.28;
  for (const [shoulder,elbow,hand] of [[3,4,5],[6,7,8]]) {
    const solved=solveLimb(points[shoulder],points[hand],0.405,0.435,{x:shoulder===3?-1:1,y:-0.4,z:0});
    points[elbow].copy(solved.joint);points[hand].copy(solved.end);
  }
  for (let i=0;i<points.length;i++) {
    const velocity=memory.scratch.copy(points[i]).sub(memory.previousJoints[i]).multiplyScalar(1/dt).clampLength(0,2.5);
    memory.jointVelocity[i].lerp(velocity,blend);
    memory.previousJoints[i].copy(points[i]);
  }
  poseAvatar(model, points);
  model.shadow.visible = a.pos.y < 0.1;
  model.ring.visible = a.shield > 0;
  if (model.gunId !== a.weapon) {
    disposeObject(model.weapon);
    model.weapon = makeWeapon(a.weapon, false, model.finish);
    model.weapon.scale.setScalar(0.65);
    model.group.add(model.weapon);
    model.gunId = a.weapon;
  }
  model.weapon.position.set(0.2, 1.1 - stance * 0.65 - compression - 0.06 * (1-stance) + breath + aimLift * 0.5, -0.3 + a.fired * 0.2);
  model.weapon.rotation.set(a.pitch * 0.7 - reload * 0.4, 0, -reload * 0.3);
  if(a.weapon===3){model.weapon.position.z-=edgeAmount*(a.edgeAttack==='stab'?0.35:0.12);model.weapon.position.x+=a.edgeAttack==='stab'?0:edgeAmount*edgeSide*0.28;model.weapon.rotation.z+=a.edgeAttack==='stab'?0:edgeAmount*edgeSide*1.1;}

}
/** Lobby-only carry pose: hands follow actual weapon grip locations. */
export function poseLobbyAvatar(model:Avatar,time:number){
 const gun=model.weapon,female=(model.group.userData.operator??0)%2===1,breath=Math.sin(time*1.5)*.006;
 gun.position.set(.08,1.04+breath,-.17);gun.rotation.set(-.08,female?-1.35:-1.15,.06);
 const points=model.joints;
 for(const i of [0,1,2,3,6,9,10,11,12,13,14])points[i].set(...RIG_POINTS[i] as [number,number,number]);
 for(const [shoulder,elbow,hand,grip] of [[3,4,5,[-.065,-.11,-.35]],[6,7,8,[.04,-.14,.1]]] as const){
   const target=new T.Vector3(...grip).multiplyScalar(.65).applyEuler(gun.rotation).add(gun.position);
   const upper=new T.Vector3(...RIG_POINTS[shoulder]).distanceTo(new T.Vector3(...RIG_POINTS[elbow]));
   const lower=new T.Vector3(...RIG_POINTS[elbow]).distanceTo(new T.Vector3(...RIG_POINTS[hand]));
   const solved=solveLimb(points[shoulder],target,upper,lower,{x:shoulder===3?-.35:.35,y:-.25,z:-.1});
   points[elbow].copy(solved.joint);points[hand].copy(solved.end);
 }
 poseAvatar(model,points);
}
export function disposeObject(o: T.Object3D) {
  if (o.userData.borrowed) {
    o.removeFromParent();
    return;
  }
  o.traverse((n) => {
    if (n instanceof T.Mesh) {
      if (n.geometry !== cube && n.geometry !== roundedCube)
        n.geometry.dispose();
      if (n.material instanceof T.MeshBasicMaterial) {
        n.material.map?.dispose();
        n.material.dispose();
      }
    }
  });
  o.removeFromParent();
}
export function disposeMaterials() {
  materials.forEach((m) => m.dispose());
  materials.clear();
  finishes.forEach((m) => m.dispose());
  finishes.clear();
  rigMaterial.dispose();
}

export function modelVariant(actor: Actor, mode: number, localVariant = 0) {
  return actor.operator ?? (mode >= 2 ? actor.team : actor.id === 0 ? localVariant : actor.id % 2);
}
