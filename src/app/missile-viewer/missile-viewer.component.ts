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

  ngAfterViewInit(): void {
    this.initScene();
    this.loadTrajectory();
    this.animate();
  }

  initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.01,
      50
    );

    // ✅ Corrected camera to see entire Earth + trajectory
    this.camera.position.set(3, 2, 3);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.nativeElement.appendChild(this.renderer.domElement);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);
    this.scene.add(new THREE.AmbientLight(0x666666));

    this.createEarth();
    this.createMissile();
  }

  createEarth(): void {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const tex = new THREE.TextureLoader().load('assets/earth/earth.jpg');
    const mat = new THREE.MeshStandardMaterial({ map: tex });
    this.earth = new THREE.Mesh(geo, mat);
    this.earth.position.set(0, 0, 0);
    this.scene.add(this.earth);
  }

  createMissile(): void {
    const geo = new THREE.ConeGeometry(0.05, 0.15, 24);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.missile = new THREE.Mesh(geo, mat);
    this.missile.rotateX(Math.PI / 2);
    this.scene.add(this.missile);
  }

  loadTrajectory(): void {
    fetch('assets/path/trajectory.json')
      .then(res => res.json())
      .then(data => {
        this.path = data.map((p: any) =>
          this.latLonToVector(p.lat, p.lon, 1.3 + p.alt * 0.2)
        );

        // Trajectory line
        const lineGeo = new THREE.BufferGeometry().setFromPoints(this.path);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const line = new THREE.Line(lineGeo, lineMat);
        this.scene.add(line);

        // Missile start
        if (this.path.length > 0) this.missile.position.copy(this.path[0]);
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

  animate = () => {
    requestAnimationFrame(this.animate);

    if (this.path.length > 1) {
      const start = this.path[this.currentSegment];
      const end = this.path[this.currentSegment + 1];

      this.segmentProgress += this.speed;

      if (this.segmentProgress >= 1) {
        this.segmentProgress = 0;
        this.currentSegment++;
        if (this.currentSegment >= this.path.length - 1) this.currentSegment = 0;
      }

      const pos = start.clone().lerp(end, this.segmentProgress);
      this.missile.position.copy(pos);
      this.missile.lookAt(end);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
