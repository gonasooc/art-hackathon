import * as THREE from '../vendor/three/three.module.js';
import { WORLD, clamp } from './config.js';
import { HandheldMotion } from './handheld.js';

export class GalleryWorld {
  constructor(canvas) {
    this.handheld=new HandheldMotion();this.handheldEnabled=true;
    this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x171d1b);
    this.scene.fog=new THREE.Fog(0x171d1b,12,43);
    this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.05,80);
    this.scene.add(new THREE.HemisphereLight(0xf3e8d4,0x313b35,2.2));
    const light=new THREE.DirectionalLight(0xffead0,2.1);light.position.set(-3,8,4);this.scene.add(light);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(8.8,31),new THREE.MeshStandardMaterial({color:0x777a6e,roughness:.96}));
    ground.rotation.x=-Math.PI/2;ground.position.z=-11;this.scene.add(ground);
    const sideMaterial=new THREE.LineBasicMaterial({color:0xb9ba9d,transparent:true,opacity:.42});
    for (const x of [-WORLD.halfWidth,WORLD.halfWidth]) this.line([[x,.012,4],[x,.012,-24]],sideMaterial);
    const seamMaterial=new THREE.LineBasicMaterial({color:0x292e29,transparent:true,opacity:.28});
    for (let z=2;z>=-24;z-=2) this.line([[-4,.009,z],[4,.009,z]],seamMaterial);
    this.screens={};
    for (const [id,x] of [['left',-2.2],['right',2.2]]) {
      const frame=new THREE.Mesh(new THREE.BoxGeometry(3.6,2.1,.13),new THREE.MeshStandardMaterial({color:0x222a25,roughness:.8}));
      frame.position.set(x,2,-22);this.scene.add(frame);
      const screen=new THREE.Mesh(new THREE.PlaneGeometry(3.4,3.4*9/16),new THREE.MeshBasicMaterial({color:0x7b8071,toneMapped:false}));
      screen.position.set(x,2,-21.925);this.scene.add(screen);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(.07,1,.08),new THREE.MeshStandardMaterial({color:0x424a3e}));
      foot.position.set(x,.5,-22);this.scene.add(foot);
      this.screens[id]=screen;
    }
    this.reset(); this.resize();
  }
  line(points,material) {
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),material));
  }
  resize() {this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
  reset() {
    this.handheld.reset();
    this.texture?.dispose();this.texture=null;
    for (const screen of Object.values(this.screens)) {screen.material.map=null;screen.material.color.set(0x7b8071);screen.material.needsUpdate=true;}
    this.camera.position.set(0,WORLD.eyeHeight,1.5);this.camera.rotation.set(0,0,0,'YXZ');this.alignment=null;
  }
  walk(state,dt=0) {
    const motion=this.handheld.sample(dt,state.moving,this.handheldEnabled&&!this.motionPreference.matches);
    this.camera.position.set(clamp(state.x+motion.x,-WORLD.halfWidth,WORLD.halfWidth),WORLD.eyeHeight+motion.y,-state.z);
    this.camera.rotation.set(clamp(state.pitch+motion.pitch,-WORLD.pitchLimit,WORLD.pitchLimit),clamp(-state.yaw+motion.yaw,-WORLD.yawLimit,WORLD.yawLimit),0,'YXZ');
  }
  align(id) {
    const position=new THREE.Vector3(this.screens[id].position.x,WORLD.eyeHeight,-18.65);
    const target=this.camera.clone();target.position.copy(position);target.lookAt(this.screens[id].position);
    this.alignment={fromPosition:this.camera.position.clone(),fromQuaternion:this.camera.quaternion.clone(),position,quaternion:target.quaternion.clone()};
    this.handheld.reset();
  }
  alignProgress(t) {
    if (!this.alignment) return;
    const a=this.alignment,s=t*t*(3-2*t);
    this.camera.position.lerpVectors(a.fromPosition,a.position,s);
    this.camera.quaternion.slerpQuaternions(a.fromQuaternion,a.quaternion,s);
  }
  showFilm(id,video) {
    this.texture?.dispose();this.texture=new THREE.VideoTexture(video);this.texture.colorSpace=THREE.SRGBColorSpace;
    const material=this.screens[id].material;material.map=this.texture;material.color.set(0xffffff);material.needsUpdate=true;
  }
  render() {this.renderer.render(this.scene,this.camera);}
}
