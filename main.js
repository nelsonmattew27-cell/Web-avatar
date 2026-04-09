import * as THREE from '[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js)';
import { GLTFLoader } from '[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js)';
import { VRMLoaderPlugin } from '[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@2.0.7/lib/three-vrm.module.js)';
import * as poseDetection from '[cdn.jsdelivr.net](https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.0/dist/pose-detection.min.js)';
import '@tensorflow/tfjs-backend-webgl';

// ===== RENDERER SETUP =====
const canvas = document.getElementById('vrm-canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(canvas.width, canvas.height);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 1000);
camera.position.set(0, 1.4, 3);

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(0, 1, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// ===== VRM LOADER =====
let currentVrm = null;

async function loadVRM(url) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  loader.load(
    url,
    (gltf) => {
      const vrm = gltf.userData.vrm;
      if (currentVrm) scene.remove(currentVrm.scene);
      currentVrm = vrm;
      scene.add(vrm.scene);
      vrm.scene.position.set(0, 0, 0);
      console.log("VRM loaded successfully");
    },
    (progress) => console.log('Loading VRM...', (progress.loaded / progress.total * 100).toFixed(1) + '%'),
    (error) => console.error('VRM load error:', error)
  );
}

// ===== FILE UPLOAD =====
document.getElementById('vrm-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadVRM(url);
});

// ===== ANIMATION LOOP =====
function animate() {
  requestAnimationFrame(animate);
  if (currentVrm) currentVrm.update(0.016);
  renderer.render(scene, camera);
}
animate();

// ===== WEBCAM + POSE DETECTION =====
const video = document.getElementById('webcam');

(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 320, height: 240 },
      audio: false
    });
    video.srcObject = stream;
    await new Promise((res) => (video.onloadedmetadata = res));

    const detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet
    );

    async function poseLoop() {
      const poses = await detector.estimatePoses(video);
      if (poses[0] && currentVrm) {
        const kp = poses[0].keypoints;
        const hips = currentVrm.humanoid.getBoneNode('hips');
        if (hips && kp[11] && kp[12]) {
          const dx = (kp[12].x - kp[11].x) / video.videoWidth;
          hips.position.x = dx * 2;
        }
      }
      requestAnimationFrame(poseLoop);
    }
    poseLoop();

  } catch (err) {
    console.error("Camera error:", err);
  }
})();

// ===== LOAD DEFAULT VRM =====
loadVRM('AliciaSolid.vrm');
