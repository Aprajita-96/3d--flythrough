import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild
} from '@angular/core';
import * as THREE from 'three';
import { OBJLoader, MTLLoader } from 'three-stdlib';

@Component({
  selector: 'app-missile-viewer',
  standalone: true,
  templateUrl: './missile-viewer.component.html',
  styleUrls: ['./missile-viewer.component.css']
})
export class MissileViewerComponent implements AfterViewInit {

  @ViewChild('container', { static: true })
  container!: ElementRef<HTMLDivElement>;

  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  earth!: THREE.Mesh;
  missile!: THREE.Object3D;
  exhaust!: THREE.Mesh;

  path: THREE.Vector3[] = [];
  currentSegment = 0;
  segmentProgress = 0;
  speed = 0.003;
  impacted = false;

  cameraMode: 'STATIC' | 'CHASE' = 'CHASE';

  /* ================= INIT ================= */

  ngAfterViewInit(): void {
    this.initScene();
    this.loadTrajectory();
    this.animate();
  }

  /* ================= CAMERA MODE ================= */

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'c') {
      this.cameraMode = this.cameraMode === 'CHASE' ? 'STATIC' : 'CHASE';
    }
  }

  /* ================= SCENE ================= */

  initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      200
    );
    this.camera.position.set(3, 2, 3);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.nativeElement.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x888888));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 3, 5);
    this.scene.add(dir);

    this.createStars();
    this.createEarth();
    this.createGrid();
    this.loadMissile();
  }

  /* ================= STARS ================= */

  createStars() {
    const geo = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (let i = 0; i < 4000; i++) {
      pts.push(
        THREE.MathUtils.randFloatSpread(80),
        THREE.MathUtils.randFloatSpread(80),
        THREE.MathUtils.randFloatSpread(80)
      );
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })
      )
    );
  }

  /* ================= EARTH ================= */

  createEarth() {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const tex = new THREE.TextureLoader().load('assets/earth/earth.jpg');
    this.earth = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: tex })
    );
    this.scene.add(this.earth);
  }

  createGrid() {
    const geo = new THREE.SphereGeometry(1.01, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      wireframe: true,
      color: 0x00ff99,
      transparent: true,
      opacity: 0.25
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  /* ================= MISSILE LOADING ================= */

  loadMissile() {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath('assets/models/');

    mtlLoader.load(
      'missile.mtl',
      materials => {
        materials.preload();

        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath('assets/models/');

        objLoader.load(
          'missile.obj',
          obj => this.prepareMissile(obj),
          undefined,
          () => this.createFallbackMissile()
        );
      },
      undefined,
      () => this.loadOBJWithoutMTL()
    );
  }

  loadOBJWithoutMTL() {
    const loader = new OBJLoader();
    loader.setPath('assets/models/');
    loader.load(
      'missile.obj',
      obj => this.prepareMissile(obj),
      undefined,
      () => this.createFallbackMissile()
    );
  }

  prepareMissile(object: THREE.Object3D) {
    this.missile = object;

    this.missile.traverse(child => {
      if ((child as any).isMesh) {
        const m = child as THREE.Mesh;
        (m.material as any).side = THREE.DoubleSide;
      }
    });

    // OBJ normalization
    this.missile.scale.setScalar(0.01);
    this.missile.rotation.set(Math.PI / 2, 0, 0);

    this.scene.add(this.missile);
    this.createExhaust();

    if (this.path.length) {
      this.missile.position.copy(this.path[0]);
    }

    console.log('MISSILE LOADED');
  }

  createFallbackMissile() {
    const geo = new THREE.ConeGeometry(0.06, 0.18, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    this.missile = new THREE.Mesh(geo, mat);
    this.missile.rotateX(Math.PI / 2);
    this.scene.add(this.missile);
    this.createExhaust();
  }

  createExhaust() {
    const geo = new THREE.ConeGeometry(0.04, 0.15, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8
    });
    this.exhaust = new THREE.Mesh(geo, mat);
    this.exhaust.rotateX(-Math.PI / 2);
    this.scene.add(this.exhaust);
  }

  /* ================= TRAJECTORY ================= */

  loadTrajectory() {
    fetch('assets/path/trajectory.json')
      .then(r => r.json())
      .then(data => {
        const total = data.length;
        this.path = data.map((p: any, i: number) => {
          const t = i / (total - 1);
          const arc = Math.sin(Math.PI * t);
          return this.latLonToVector(
            p.lat,
            p.lon,
            1.01 + arc * 0.35
          );
        });

        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(this.path),
          new THREE.LineBasicMaterial({ color: 0xffff00 })
        );
        this.scene.add(line);

        if (this.missile) {
          this.missile.position.copy(this.path[0]);
        }
      });
  }

  latLonToVector(lat: number, lon: number, r: number) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* ================= IMPACT ================= */

  createImpactFlash(pos: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.05, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(pos);
    this.scene.add(flash);

    let scale = 1;
    const animateFlash = () => {
      scale += 0.15;
      flash.scale.setScalar(scale);
      mat.opacity = Math.max(0, 1 - scale / 3);
      if (scale < 3) requestAnimationFrame(animateFlash);
      else this.scene.remove(flash);
    };
    animateFlash();
  }

  /* ================= ANIMATION ================= */

  animate = () => {
    requestAnimationFrame(this.animate);

    if (this.path.length > 1 && this.missile && !this.impacted) {
      const start = this.path[this.currentSegment];
      const end = this.path[this.currentSegment + 1];

      this.segmentProgress += this.speed;
      if (this.segmentProgress >= 1) {
        this.segmentProgress = 0;
        this.currentSegment++;
        if (this.currentSegment >= this.path.length - 1) {
          this.impacted = true;
          this.createImpactFlash(end);
          return;
        }
      }

      const pos = start.clone().lerp(end, this.segmentProgress);
      this.missile.position.copy(pos);
      this.missile.lookAt(end);

      this.exhaust.position.copy(pos);
      this.exhaust.lookAt(start);

      if (this.cameraMode === 'CHASE') {
        const dir = end.clone().sub(pos).normalize();
        const camPos = pos.clone()
          .add(dir.clone().multiplyScalar(-0.6))
          .add(pos.clone().normalize().multiplyScalar(0.25));
        this.camera.position.lerp(camPos, 0.08);
        this.camera.lookAt(pos.clone().add(dir));
      } else {
        this.camera.position.lerp(new THREE.Vector3(3, 2, 3), 0.02);
        this.camera.lookAt(0, 0, 0);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
