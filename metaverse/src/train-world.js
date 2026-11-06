import * as THREE from '../vendor/three/three.module.js';
import { TRAIN, WORLD, clamp } from './config.js';
import { MemoryObjects, buildHospital } from './memory-objects.js';
import { HandheldMotion } from './handheld.js';
import { box, boxes, tube, archGeometry, buildTrain, buildInterior, plaque } from './train-geometry.js';

const smooth = value => value * value * (3 - 2 * value);

export class TrainWorld {
  constructor(canvas) {
    this.canvas=canvas;this.handheld=new HandheldMotion();this.handheldEnabled=true;
    this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xe2b4a4);
    this.scene.fog=new THREE.Fog(0xe6b6a2,35,115);
    this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.04,180);
    this.hemi=new THREE.HemisphereLight(0xffead5,0x5f3c35,2);this.scene.add(this.hemi);
    const sun=new THREE.DirectionalLight(0xffeed3,2.6);sun.position.set(4,15,10);this.scene.add(sun);this.sun=sun;
    const rim=new THREE.DirectionalLight(0xe4bdc5,1.6);rim.position.set(-12,7,-20);this.scene.add(rim);this.rim=rim;
    this.materials={
      navy:new THREE.MeshStandardMaterial({color:0x10293f,metalness:.5,roughness:.28}),
      gold:new THREE.MeshStandardMaterial({color:0xc39b5b,metalness:.62,roughness:.31}),
      silver:new THREE.MeshStandardMaterial({color:0xa9acae,metalness:.65,roughness:.35,side:THREE.DoubleSide}),
      iron:new THREE.MeshStandardMaterial({color:0x292b2a,metalness:.58,roughness:.65}),
      wood:new THREE.MeshStandardMaterial({color:0x684331,roughness:.6}),
      velvet:new THREE.MeshStandardMaterial({color:0x875849,roughness:.95}),
      glass:new THREE.MeshStandardMaterial({color:0xf0bf90,roughness:.18,metalness:.1,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false,forceSinglePass:true}),
      lamp:new THREE.MeshBasicMaterial({color:0xffdda3,toneMapped:false}),
    };
    const loader=new THREE.TextureLoader(),loads=[];
    const loadTexture=(file,repeat)=>{
      let resolve,reject;loads.push(new Promise((yes,no)=>{resolve=yes;reject=no;}));
      const texture=loader.load(new URL(`../assets/train/${file}`,import.meta.url).href,()=>resolve(),undefined,reject);
      texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(...repeat);texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
    this.membraneTexture=loadTexture('membrane.png',[4,2]);
    this.membraneTexture.wrapS=this.membraneTexture.wrapT=THREE.MirroredRepeatWrapping;
    this.groundTexture=loadTexture('ground.png',[1,1]);
    this.groundTexture.wrapS=this.groundTexture.wrapT=THREE.MirroredRepeatWrapping;
    this.interiorTexture=this.membraneTexture.clone();this.interiorTexture.repeat.set(2.8,1.2);
    this.buildEnvironment();
    const train=buildTrain(this.materials);this.train=train.group;this.wheels=train.wheels;this.scene.add(this.train);
    const interior=buildInterior(this.materials,this.interiorTexture);
    this.interior=interior.group;this.liningMaterial=interior.liningMaterial;this.lamps=interior.lamps;this.scene.add(this.interior);
    this.wombLights=[];
    for(const x of [-2.5,-7,-11.5]){
      const light=new THREE.PointLight(0xffc093,5,8,2);light.position.set(x,3.15,TRAIN.centerZ);this.scene.add(light);this.wombLights.push(light);
    }

    this.hospital=buildHospital();this.hospital.visible=false;this.scene.add(this.hospital);
    this.objects=new MemoryObjects(this.scene);
    this.ready=Promise.all(loads).then(()=>{
      this.interiorTexture.needsUpdate=true;
      const environment=this.membraneTexture.clone();environment.repeat.set(1,1);
      environment.mapping=THREE.EquirectangularReflectionMapping;environment.needsUpdate=true;
      const generator=new THREE.PMREMGenerator(this.renderer);
      this.environmentTarget=generator.fromEquirectangular(environment);
      this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.65;
      generator.dispose();environment.dispose();
      this.needsRender=true;
      this.canvas.dataset.assets='ready';
    });
    this.ready.catch(()=>{this.canvas.dataset.assets='error';});
    this.reset();this.resize();
  }

  buildEnvironment() {
    const {iron}=this.materials;
    const groundGeometry=new THREE.PlaneGeometry(180,100,36,20).toNonIndexed();
    const uv=groundGeometry.attributes.uv,positions=groundGeometry.attributes.position;
    for(let base=0;base<positions.count;base+=6){
      const xs=Array.from({length:6},(_,i)=>positions.getX(base+i)),ys=Array.from({length:6},(_,i)=>positions.getY(base+i));
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const cell=Math.floor(base/6),mirrorX=cell%36%2,mirrorY=Math.floor(cell/36)%2;
      for(let i=0;i<6;i++){
        let u=(positions.getX(base+i)-minX)/(maxX-minX),v=(positions.getY(base+i)-minY)/(maxY-minY);
        if(mirrorX)u=1-u;if(mirrorY)v=1-v;
        uv.setXY(base+i,u,.14+v*.84);
      }
    }
    const ground=new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({map:this.groundTexture,color:0xc8a181,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.set(0,-.08,TRAIN.centerZ);
    this.ground=ground;this.scene.add(ground);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;
    const shadowContext=shadowCanvas.getContext('2d');shadowContext.scale(1,.5);
    const shadowGradient=shadowContext.createRadialGradient(128,128,32,128,128,128);
    shadowGradient.addColorStop(0,'rgba(28,17,13,.6)');shadowGradient.addColorStop(1,'rgba(28,17,13,0)');
    shadowContext.fillStyle=shadowGradient;shadowContext.fillRect(0,0,256,256);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(30,5.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.set(-1.8,-.06,TRAIN.centerZ);this.scene.add(shadow);
    for(const z of [TRAIN.centerZ-1.43,TRAIN.centerZ+1.43])box(this.scene,[180,.12,.095],[0,.15,z],iron);
    this.sleepers=new THREE.Group();
    const sleepers=[];
    for(let x=-90;x<=90;x+=.72)sleepers.push([[.22,.15,3.4],[x,.01,TRAIN.centerZ]]);
    boxes(this.sleepers,sleepers,new THREE.MeshStandardMaterial({color:0x796455,roughness:.98}));this.scene.add(this.sleepers);
    const shellMaterial=new THREE.MeshBasicMaterial({map:this.membraneTexture,color:0xffe1d1,side:THREE.BackSide,toneMapped:false});
    this.shell=new THREE.Mesh(archGeometry(-95,95,6,TRAIN.centerZ,16,19,{organic:true,full:true,segments:84}),shellMaterial);
    this.shell.name='surrounding-womb-space';this.scene.add(this.shell);
    const seamMaterial=new THREE.MeshBasicMaterial({color:0xffead4,transparent:true,opacity:.1,depthWrite:false});
    for(let i=0;i<6;i++){
      const angle=.18+i*.5;
      const points=Array.from({length:42},(_,j)=>{
        const x=-85+j*4.15,ripple=1+.06*Math.sin(x*.14+angle*4);
        return[x,6+Math.sin(angle)*15*ripple,TRAIN.centerZ+Math.cos(angle)*18*ripple];
      });
      tube(this.scene,points,.035,seamMaterial);
    }
    const approachMaterial=new THREE.LineBasicMaterial({color:0xf3ddba,transparent:true,opacity:.55});
    for(const side of [-1,1]){
      const points=Array.from({length:25},(_,i)=>{
        const z=TRAIN.approachLength*i/24,t=clamp((z/TRAIN.approachLength-.25)/.65,0,1);
        const width=TRAIN.approachHalfWidth+(TRAIN.doorHalfWidth-TRAIN.approachHalfWidth)*smooth(t);
        return new THREE.Vector3(side*(width+.15),.012,TRAIN.exteriorStartZ-z);
      });
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),approachMaterial));
    }
    this.passingLights=new THREE.Group();
    const beacons=[];
    for(let x=-80;x<=80;x+=6)for(const z of [TRAIN.centerZ-5,TRAIN.centerZ+5])beacons.push([[.055,2.7,.055],[x,1.3,z]]);
    boxes(this.passingLights,beacons,new THREE.MeshBasicMaterial({color:0xffdec0,transparent:true,opacity:.22}));
    this.scene.add(this.passingLights);
    const particles=new Float32Array(300*3);
    for(let i=0;i<300;i++){
      particles[i*3]=((i*37.71)%120)-60;particles[i*3+1]=1+(i*1.37)%10;
      particles[i*3+2]=TRAIN.centerZ+((i%2?1:-1)*(4+(i*.63)%12));
    }
    const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(particles,3));
    this.dust=new THREE.Points(particleGeometry,new THREE.PointsMaterial({color:0xffe4c0,size:.045,transparent:true,opacity:.45,depthWrite:false}));this.scene.add(this.dust);
  }

  setCar(id) {
    this.activeCar=id;this.hemi.intensity=id==='01'?.8:2;this.sun.intensity=id==='01'?.5:2.6;this.rim.intensity=id==='01'?.2:1.6;this.scene.environmentIntensity=id==='01'?.25:.65;for(const light of this.wombLights)light.visible=id==='00';this.interior.visible=id==='00';this.hospital.visible=id==='01';
    this.objects?.setCar(id);this.needsRender=true;
    this.canvas.dataset.carriage=id;
  }
  resize() {this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.needsRender=true;}

  reset() {
    this.handheld.reset();
    this.objects?.reset();this.setCar('00');

    this.boarded=false;this.rideTime=0;this.transition=null;this.alignment=null;
    this.sleepers.position.x=0;this.passingLights.position.x=0;this.dust.position.x=0;
    this.ground.position.x=0;this.groundTexture.offset.set(0,0);this.membraneTexture.offset.set(0,0);
    for(const wheel of this.wheels)wheel.rotation.z=0;
    for(const lamp of this.lamps)lamp.rotation.z=0;
    this.liningMaterial.opacity=.8;this.needsRender=true;
    this.camera.position.set(5.5,2.6,16);this.camera.lookAt(-1,2,-7.1);
    this.canvas.dataset.trainMoving='false';this.canvas.dataset.carriage='';this.canvas.dataset.journeyStage='platform';this.canvas.dataset.sceneryDistance='0';
  }

  platformPosition(state) {
    const rise=smooth(clamp((state.z-TRAIN.stairStart)/(TRAIN.approachLength-TRAIN.stairStart),0,1));
    return new THREE.Vector3(state.x,WORLD.eyeHeight+TRAIN.floorY*rise,TRAIN.exteriorStartZ-state.z);
  }

  walk(state,dt=0) {
    this.needsRender=true;
    const motion=this.handheld.sample(dt,state.moving,this.handheldEnabled&&!this.motionPreference.matches);
    if(state.stage==='carriage'){
      this.camera.position.set(TRAIN.interiorStartX-state.z,WORLD.eyeHeight+TRAIN.floorY+motion.y,TRAIN.centerZ-state.x-motion.x);
      this.camera.rotation.set(clamp(state.pitch+motion.pitch,-WORLD.pitchLimit,WORLD.pitchLimit),Math.PI/2-state.yaw+motion.yaw,0,'YXZ');
    }else{
      this.camera.position.copy(this.platformPosition(state));this.camera.position.x+=motion.x;this.camera.position.y+=motion.y;
      this.camera.rotation.set(clamp(state.pitch+motion.pitch,-WORLD.pitchLimit,WORLD.pitchLimit),-state.yaw+motion.yaw,0,'YXZ');
    }
    this.canvas.dataset.journeyStage=state.stage||'platform';
  }

  startBoarding() {
    this.boarded=true;this.canvas.dataset.trainMoving='true';this.canvas.dataset.journeyStage='boarding';
    const destination=new THREE.Vector3(TRAIN.interiorStartX,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ);
    const target=this.camera.clone();target.position.copy(destination);target.rotation.set(0,Math.PI/2,0,'YXZ');
    this.transition={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),destination,rotation:target.quaternion.clone()};
    this.handheld.reset();
  }

  boardingProgress(progress) {
    this.needsRender=true;
    const t=smooth(clamp(progress,0,1)),transition=this.transition;
    if(!transition)return;
    this.camera.position.lerpVectors(transition.position,transition.destination,t);this.camera.quaternion.slerpQuaternions(transition.quaternion,transition.rotation,t);
    if(progress>=1){this.canvas.dataset.carriage='00';this.canvas.dataset.journeyStage='carriage';}
  }

  align(id) {
    const position=new THREE.Vector3(TRAIN.interiorStartX-TRAIN.interiorLength,WORLD.eyeHeight+TRAIN.floorY,TRAIN.centerZ);
    const target=this.camera.clone();target.position.copy(position);target.lookAt(new THREE.Vector3(-9,2,TRAIN.centerZ));
    this.alignment={fromPosition:this.camera.position.clone(),fromQuaternion:this.camera.quaternion.clone(),position,quaternion:target.quaternion.clone()};this.handheld.reset();
  }
  alignProgress(t) {
    if(!this.alignment)return;
    this.needsRender=true;
    const a=this.alignment,s=smooth(t);this.camera.position.lerpVectors(a.fromPosition,a.position,s);this.camera.quaternion.slerpQuaternions(a.fromQuaternion,a.quaternion,s);
  }
  render(dt=0) {
    this.objects?.update(dt,this.motionPreference.matches);
    if(this.objects)this.canvas.dataset.objectState=JSON.stringify(this.objects.targets.map(t=>({id:t.id,progress:t.progress,gone:t.gone})));
    if(this.objects?.targets.some(t=>t.progress!==null))this.needsRender=true;
    const animate=this.boarded&&!this.motionPreference.matches&&dt>0;

    if(!this.needsRender&&!animate)return;
    if(animate){
      this.rideTime+=Math.min(dt,.08);const distance=this.rideTime*TRAIN.scenerySpeed;
      this.canvas.dataset.sceneryDistance=distance.toFixed(3);
      this.sleepers.position.x=-(distance%.72);this.passingLights.position.x=-(distance%6);this.dust.position.x=-(distance%20);
      this.ground.position.x=-(distance%10);this.membraneTexture.offset.x=distance/160;
      for(const wheel of this.wheels)wheel.rotation.z=-distance/.38;
      for(let i=0;i<this.lamps.length;i++)this.lamps[i].rotation.z=Math.sin(this.rideTime*.8+i*.6)*.012;
      this.liningMaterial.opacity=.8+Math.sin(this.rideTime*1.1)*.008;
    }
    this.renderer.render(this.scene,this.camera);
    this.needsRender=false;
  }
  dispose() {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    this.scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
    for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
    geometries.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());this.environmentTarget?.dispose();this.renderer.dispose();
  }
}
