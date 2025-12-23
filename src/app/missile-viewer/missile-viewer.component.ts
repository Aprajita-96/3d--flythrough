import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import * as THREE from 'three';

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
  missile!: THREE.Mesh;

  path: THREE.Vector3[] = [];

  currentSegment = 0;
  segmentProgress = 0;
  speed = 0.003;

  // Camera follow tuning
  cameraDistance = 0.6;
  cameraHeight = 0.25;
  cameraLerp = 0.08;

  ngAfterViewInit(): void {
    this.initScene();
    this.loadTrajectory();
    this.animate();
  }

  /* ================= SCENE ================= */

  initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      100
    );

    // Initial camera (will be overridden by follow logic)
    this.camera.position.set(3, 2, 3);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.nativeElement.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x888888));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(5, 3, 5);
    this.scene.add(dir);

    this.createStars();
    this.createEarth();
    this.createEarthGrid();
    this.createMissile();
  }

  /* ================= STARS ================= */

  createStars(): void {
    const starCount = 4000;
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];

    for (let i = 0; i < starCount; i++) {
      positions.push(
        THREE.MathUtils.randFloatSpread(80),
        THREE.MathUtils.randFloatSpread(80),
        THREE.MathUtils.randFloatSpread(80)
      );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
    this.scene.add(new THREE.Points(geometry, material));
  }

  /* ================= EARTH ================= */

  createEarth(): void {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const tex = new THREE.TextureLoader().load('assets/earth/earth.jpg');
    const mat = new THREE.MeshStandardMaterial({ map: tex });
    this.earth = new THREE.Mesh(geo, mat);
    this.scene.add(this.earth);
  }

  createEarthGrid(): void {
    const gridGeo = new THREE.SphereGeometry(1.01, 32, 32);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x00ff99,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    this.scene.add(new THREE.Mesh(gridGeo, gridMat));
  }

  /* ================= MISSILE ================= */

  createMissile(): void {
    const geo = new THREE.ConeGeometry(0.06, 0.18, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    this.missile = new THREE.Mesh(geo, mat);
    this.missile.rotateX(Math.PI / 2);
    this.scene.add(this.missile);
  }

  /* ================= TRAJECTORY ================= */

  loadTrajectory(): void {
    fetch('assets/path/trajectory.json')
      .then(res => res.json())
      .then(data => {

        const EARTH_RADIUS = 1;
        const SURFACE_OFFSET = 0.01;
        const MAX_ARC_HEIGHT = 0.35;

        const total = data.length;

        this.path = data.map((p: any, i: number) => {
          const t = i / (total - 1);
          const arc = Math.sin(Math.PI * t);
          const radius = EARTH_RADIUS + SURFACE_OFFSET + arc * MAX_ARC_HEIGHT;
          return this.latLonToVector(p.lat, p.lon, radius);
        });

        const lineGeo = new THREE.BufferGeometry().setFromPoints(this.path);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00 });
        this.scene.add(new THREE.Line(lineGeo, lineMat));

        this.missile.position.copy(this.path[0]);
      });
  }

  latLonToVector(lat: number, lon: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;

    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* ================= ANIMATION ================= */

  animate = () => {
    requestAnimationFrame(this.animate);

    if (this.path.length > 1) {
      const start = this.path[this.currentSegment];
      const end = this.path[this.currentSegment + 1];

      this.segmentProgress += this.speed;

      if (this.segmentProgress >= 1) {
        this.segmentProgress = 0;
        this.currentSegment++;
        if (this.currentSegment >= this.path.length - 1) {
          this.currentSegment = 0;
        }
      }

      // Missile position
      const pos = start.clone().lerp(end, this.segmentProgress);
      this.missile.position.copy(pos);
      this.missile.lookAt(end);

      // ================= CAMERA FOLLOW =================

      const direction = end.clone().sub(pos).normalize();
      const behind = direction.clone().multiplyScalar(-this.cameraDistance);

      const up = pos.clone().normalize().multiplyScalar(this.cameraHeight);
      const desiredCameraPos = pos.clone().add(behind).add(up);

      this.camera.position.lerp(desiredCameraPos, this.cameraLerp);

      const lookAhead = pos.clone().add(direction.multiplyScalar(0.5));
      this.camera.lookAt(lookAhead);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
