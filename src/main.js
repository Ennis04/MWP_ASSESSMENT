import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import gsap from 'gsap';

THREE.Cache.enabled = true;

const isIndexPage = document.getElementById('index-page') !== null;
const isMemberPage = document.getElementById('member-page') !== null;
const indexCarouselContainer = document.querySelector('.carousel-container');

const canvas = document.querySelector('#bg');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 30;

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});
const maxRenderPixelRatio = 1.5;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRenderPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);

let cssRenderer = null;
if (isMemberPage) {
  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(cssRenderer.domElement.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    pointerEvents: 'none',
    zIndex: '50'
  });
  document.body.appendChild(cssRenderer.domElement);
}

const sharedGLTFLoader = new GLTFLoader();
const sharedGLTFPromises = new Map();
const scheduleIdle = window.requestIdleCallback
  ? (callback) => window.requestIdleCallback(callback, { timeout: 1500 })
  : (callback) => window.setTimeout(callback, 250);

function loadModel(path, onLoad, onError) {
  if (!sharedGLTFPromises.has(path)) {
    sharedGLTFPromises.set(path, new Promise((resolve, reject) => {
      sharedGLTFLoader.load(path, resolve, undefined, reject);
    }));
  }

  sharedGLTFPromises.get(path)
    .then((source) => onLoad({ ...source, scene: cloneSkeleton(source.scene) }))
    .catch(onError);
}

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffd0a0, 0.6);
fillLight.position.set(-10, 5, -5);
scene.add(fillLight);

const orbitingLight = new THREE.Group();
if (isIndexPage) scene.add(orbitingLight);

const satellite = new THREE.Group();
const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
const boneShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 16), boneMaterial);
boneShaft.rotation.z = Math.PI / 2;
satellite.add(boneShaft);

const boneEndGeometry = new THREE.SphereGeometry(0.5, 16, 16);
[
  [1.1, 0.3], [1.1, -0.3], [-1.1, 0.3], [-1.1, -0.3]
].forEach(([x, y]) => {
  const boneEnd = new THREE.Mesh(boneEndGeometry, boneMaterial);
  boneEnd.position.set(x, y, 0);
  satellite.add(boneEnd);
});

orbitingLight.add(satellite);

const starsGeo = new THREE.BufferGeometry();
const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.8 });
const starCount = 1000;
const positions = new Float32Array(starCount * 3);
for(let i = 0; i < starCount * 3; i++) {
  positions[i] = THREE.MathUtils.randFloatSpread(200);
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

const baseMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8, metalness: 0.2 });

let planetGroup, dogModel, dogMixer;
let carouselGroup, cuboids = [];
const landingPortraitModels = [];
let landingGroupDragActive = false;
let landingGroupSpinVelocity = 0;
let updateIndexLandingLayout = null;
const indexModelMixers = [];
const animationTimer = new THREE.Timer();
const memberCount = 4;

const indexMemberData = [
  { name: "Ennis Lam Si Hoong", role: "Software Engineer", link: "ennis.html", image: "/members/ennis.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "UI/UX, Web Development, IoT", asp: "Create immersive worlds", ach: "ROBOCON MALAYSIA 2025 – Champion & Best Engineering Award", cert: "Anugerah Insan Terbilang Negeri Sembilan", model: "/ennis/bananacat.glb", modelName: "Banana Cat", modelDescription: "Banana Cat is a famous meme in the Intenet. The reason I choose it as my model is that it is cute and always positve and energetic." },
  { name: "Liew Choon Pang", role: "Graphics and Multimedia Software", link: "liew.html", image: "/members/liew.png", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "Python, Java, Node.js, Power BI, Three.js, Unity", asp: "Interested in UI/UX design, interactive web development and real-time computer graphics.", ach: "I'MMERSe 2026 - International Immersive Computing Symposium", cert: "Kaggle Data Visualisation Certification", model: "/liew/bubbles_the_powerpuff_girls.glb", modelName: "Bubble", modelDescription: "Bubble is the sweetest and most emotional member of the Powerpuff Girls superhero trio. Known as \"the joy and the laughter\" ." },
  { name: "Chua Lin Wei", role: "Data Analytics", link: "chua.html", image: "/members/fifi.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "Data Analytics, Scrum Master", asp: "Become a Chief Technology Officer", ach: "i-CPROM 2023", cert: "Certification of Contribution Penang Heritage Trust", model: "/chuamedia/minion.glb", modelName: "Minion", modelDescription: "An animated Minion model with banana-themed interaction and sound." },
  { name: "Tai Yi Tian", role: "Graphics and Multimedia Software", link: "tai.html", image: "/members/tai.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "Vue.js, C++, Python, Java, Unity, Power BI", asp: "Interested in Image Processing and AI. Aspires to be a Software Developer.", ach: "CGPA 3.93", cert: "—", model: "/tai/oiiaioooooiai_cat.glb", modelName: "Oiia Cat", modelDescription: "Oiia cat is a popular meme in the Internet. She is a rescued, blind, senior cat known for her hypnotic, spinning memes set to a catchy oiia oiia audio track." }
];

const memberPhotoCanvasWidth = 800;
const memberPhotoCanvasHeight = 1184;

function addRoundedRectanglePath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function createInitialsTexture(name, backgroundColor) {
  const canvas = document.createElement('canvas');
  canvas.width = memberPhotoCanvasWidth;
  canvas.height = memberPhotoCanvasHeight;
  const context = canvas.getContext('2d');
  const initials = name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  context.fillStyle = `#${backgroundColor.toString(16).padStart(6, '0')}`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255, 255, 255, 0.14)';
  context.beginPath();
  context.arc(canvas.width / 2, canvas.height * 0.42, 230, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = '700 190px Outfit, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(initials, canvas.width / 2, canvas.height * 0.42);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createCenteredPhotoTexture(image) {
  const canvas = document.createElement('canvas');
  canvas.width = memberPhotoCanvasWidth;
  canvas.height = memberPhotoCanvasHeight;
  const context = canvas.getContext('2d');
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const imageAspect = imageWidth / imageHeight;
  const targetAspect = canvas.width / canvas.height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = imageWidth;
  let sourceHeight = imageHeight;

  if (imageAspect > targetAspect) {
    sourceWidth = imageHeight * targetAspect;
    sourceX = (imageWidth - sourceWidth) / 2;
  } else {
    sourceHeight = imageWidth / targetAspect;
    sourceY = (imageHeight - sourceHeight) / 2;
  }

  context.save();
  addRoundedRectanglePath(context, 0, 0, canvas.width, canvas.height, 34);
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const vignette = context.createRadialGradient(
    canvas.width / 2,
    canvas.height * 0.42,
    canvas.width * 0.22,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.72, 'rgba(0, 0, 0, 0.02)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  addRoundedRectanglePath(context, 3, 3, canvas.width - 6, canvas.height - 6, 32);
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  context.lineWidth = 6;
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

if (isIndexPage) {
  planetGroup = new THREE.Group();
  planetGroup.position.set(10.5, 0, 0);
  scene.add(planetGroup);

  const textureLoader = new THREE.TextureLoader();

  const portraitPlatform = new THREE.Mesh(
    new THREE.CylinderGeometry(11.45, 12, 0.5, 64),
    new THREE.MeshStandardMaterial({
      color: 0x171426,
      roughness: 0.7,
      metalness: 0.25,
      transparent: true,
      opacity: 0.92
    })
  );
  portraitPlatform.position.set(0, -4.35, 0.15);
  portraitPlatform.scale.z = 0.44;
  planetGroup.add(portraitPlatform);

  const portraitRing = new THREE.Mesh(
    new THREE.TorusGeometry(10.9, 0.085, 12, 96),
    new THREE.MeshBasicMaterial({ color: 0x7c3cff, transparent: true, opacity: 0.8 })
  );
  portraitRing.position.set(0, -4.06, 0.15);
  portraitRing.rotation.x = Math.PI / 2;
  portraitRing.scale.z = 0.44;
  planetGroup.add(portraitRing);

  const portraitLight = new THREE.PointLight(0x8b5cf6, 24, 28, 2);
  portraitLight.position.set(0, 4, 6);
  planetGroup.add(portraitLight);

  const addLandingPortraitModel = (gltf, {
    position,
    targetSize,
    rotationY = 0,
    animate = true
  }) => {
    const model = gltf.scene;
    model.rotation.y = rotationY;
    model.updateMatrixWorld(true);

    const initialBounds = new THREE.Box3().setFromObject(model, true);
    const initialSize = initialBounds.getSize(new THREE.Vector3());
    const largestDimension = Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
    model.scale.setScalar(targetSize / largestDimension);
    model.updateMatrixWorld(true);

    const scaledBounds = new THREE.Box3().setFromObject(model, true);
    const centre = scaledBounds.getCenter(new THREE.Vector3());
    model.position.x -= centre.x;
    model.position.y -= scaledBounds.min.y;
    model.position.z -= centre.z;
    model.position.add(position);
    model.updateMatrixWorld(true);
    planetGroup.add(model);
    landingPortraitModels.push(model);

    if (animate && gltf.animations.length) {
      const portraitClip = gltf.animations.find((clip) => /idle|standing|(^|\|)h+i+$|wave/i.test(clip.name));
      if (portraitClip) {
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(portraitClip).setLoop(THREE.LoopRepeat, Infinity).play();
        indexModelMixers.push(mixer);
        mixer.update(0);
      }
    }

    return model;
  };

  const landingMembers = [
    { path: indexMemberData[0].model, position: new THREE.Vector3(-9.2, -4.06, -1.8), targetSize: 12.4, rotationY: 0.08 },
    { path: indexMemberData[1].model, position: new THREE.Vector3(-3, -4.06, -0.6), targetSize: 10.3, rotationY: 0.05 },
    { path: indexMemberData[2].model, position: new THREE.Vector3(4.8, -4.06, 0.25), targetSize: 11, rotationY: -0.06 },
    { path: indexMemberData[3].model, position: new THREE.Vector3(9.2, -4.06, -1.2), targetSize: 10.4, rotationY: -0.08 }
  ];

  landingMembers.forEach((config) => {
    loadModel(
      config.path,
      (gltf) => addLandingPortraitModel(gltf, config),
      (error) => console.error(`Unable to load landing portrait model: ${config.path}`, error)
    );
  });

  const dogTexture = textureLoader.load('/baby-dog/textures/gltf_embedded_0.png');
  const dogNormal = textureLoader.load('/baby-dog/textures/gltf_embedded_2.png');
  const dogAO = textureLoader.load('/baby-dog/textures/gltf_embedded_3@channels=R.png');
  dogTexture.colorSpace = THREE.SRGBColorSpace;
  dogTexture.flipY = true;
  dogNormal.flipY = true;
  dogAO.flipY = true;

  const dogMaterial = new THREE.MeshStandardMaterial({
    map: dogTexture,
    normalMap: dogNormal,
    aoMap: dogAO,
    roughness: 0.8,
    metalness: 0.1
  });

  loadModel(
    '/baby-dog/source/baby%20dog.glb',
    (gltf) => {
      gltf.scene.traverse((node) => {
        if (!node.isMesh) return;
        node.material = dogMaterial;
      });
      dogModel = addLandingPortraitModel(gltf, {
        position: new THREE.Vector3(0, -4.06, 1.5),
        targetSize: 9.6,
        rotationY: -0.15,
        animate: false
      });

      const standingClip = gltf.animations.find((clip) => /standing|idle/i.test(clip.name))
        || gltf.animations[0];
      if (standingClip) {
        dogMixer = new THREE.AnimationMixer(dogModel);
        dogMixer.clipAction(standingClip).setLoop(THREE.LoopRepeat, Infinity).play();
      }
    },
    (error) => console.error('Unable to load the landing-page dog model.', error)
  );

  let landingDragLastX = 0;
  let lastLandingHoverCheck = 0;
  const landingDragPointer = new THREE.Vector2();
  const landingDragRaycaster = new THREE.Raycaster();
  const landingHitBox = new THREE.Box3();

  const findLandingPortraitAtPointer = (clientX, clientY) => {
    landingDragPointer.x = (clientX / window.innerWidth) * 2 - 1;
    landingDragPointer.y = -(clientY / window.innerHeight) * 2 + 1;
    landingDragRaycaster.setFromCamera(landingDragPointer, camera);

    let closestModel = null;
    let closestDistance = Infinity;
    landingPortraitModels.forEach((model) => {
      landingHitBox.setFromObject(model, true).expandByScalar(0.35);
      const hitPoint = landingDragRaycaster.ray.intersectBox(landingHitBox, new THREE.Vector3());
      if (!hitPoint) return;
      const distance = landingDragRaycaster.ray.origin.distanceToSquared(hitPoint);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestModel = model;
      }
    });
    return closestModel;
  };

  window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button, input, textarea')) return;
    if (!findLandingPortraitAtPointer(event.clientX, event.clientY)) return;
    landingGroupDragActive = true;
    landingDragLastX = event.clientX;
    landingGroupSpinVelocity = 0;
    document.body.style.cursor = 'grabbing';
  });

  window.addEventListener('pointermove', (event) => {
    if (landingGroupDragActive) {
      const deltaX = event.clientX - landingDragLastX;
      landingDragLastX = event.clientX;
      landingGroupSpinVelocity = deltaX * 0.008;
      planetGroup.rotation.y += landingGroupSpinVelocity;
      return;
    }
    if (event.target.closest('a, button, input, textarea')) return;
    if (event.timeStamp - lastLandingHoverCheck < 32) return;
    lastLandingHoverCheck = event.timeStamp;
    document.body.style.cursor = findLandingPortraitAtPointer(event.clientX, event.clientY) ? 'grab' : '';
  });

  const releaseLandingPortrait = () => {
    if (!landingGroupDragActive) return;
    landingGroupDragActive = false;
    document.body.style.cursor = '';
  };
  window.addEventListener('pointerup', releaseLandingPortrait);
  window.addEventListener('pointerleave', releaseLandingPortrait);

  carouselGroup = new THREE.Group();
  carouselGroup.position.set(-10, -50, -10); 
  scene.add(carouselGroup);

  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.5, 32), baseMat);
  baseMesh.position.y = -5;
  carouselGroup.add(baseMesh);

  const ringMeshBase = new THREE.Mesh(new THREE.TorusGeometry(9, 0.1, 16, 100), new THREE.MeshBasicMaterial({ color: 0x6a11ff }));
  ringMeshBase.rotation.x = Math.PI / 2;
  ringMeshBase.position.y = -4.7;
  carouselGroup.add(ringMeshBase);

  const colors = [0xff0055, 0x00ffcc, 0xffcc00, 0xaa3bff];
  let currentMemberIndex = 0;
  for (let i = 0; i < memberCount; i++) {
    const member = indexMemberData[i];
    const card = new THREE.Group();
    const cardDepth = 0.32;

    const cardBody = new THREE.Mesh(
      new RoundedBoxGeometry(6.75, 9.75, cardDepth, 4, 0.24),
      new THREE.MeshStandardMaterial({
        color: colors[i],
        emissive: colors[i],
        emissiveIntensity: 0.14,
        roughness: 0.28,
        metalness: 0.42
      })
    );
    card.add(cardBody);

    const photoMaterial = new THREE.MeshBasicMaterial({
      map: createInitialsTexture(member.name, colors[i]),
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.02,
      toneMapped: false
    });
    const photoWidth = 6.25;
    const photoHeight = 9.25;
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(photoWidth, photoHeight), photoMaterial);
    photo.position.set(0.065, 0, (cardDepth / 2) + 0.012);
    card.add(photo);
    card.userData.memberPhoto = photo;

    if (member.model) {
      const modelBackdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(photoWidth, photoHeight),
        new THREE.MeshBasicMaterial({ color: 0x07070d, toneMapped: false })
      );
      modelBackdrop.position.set(0.065, 0, (cardDepth / 2) + 0.014);
      modelBackdrop.visible = false;
      card.add(modelBackdrop);

      const modelContainer = new THREE.Group();
      modelContainer.position.set(0.065, 0, (cardDepth / 2) + 0.45);
      modelContainer.visible = false;
      modelContainer.userData.ready = false;
      card.add(modelContainer);

      card.userData.modelBackdrop = modelBackdrop;
      card.userData.modelContainer = modelContainer;

      scheduleIdle(() => loadModel(
        member.model,
        (gltf) => {
          const model = gltf.scene;
          const displayClip = gltf.animations.find((clip) => /(^|\|)h+i+$/i.test(clip.name))
            || gltf.animations[0];

          if (displayClip) {
            const modelMixer = new THREE.AnimationMixer(model);
            const displayAction = modelMixer.clipAction(displayClip);
            displayAction.setLoop(THREE.LoopRepeat, Infinity).play();
            indexModelMixers.push(modelMixer);
            modelMixer.update(0);
          }

          model.updateMatrixWorld(true);
          const initialBounds = new THREE.Box3().setFromObject(model, true);
          const initialSize = initialBounds.getSize(new THREE.Vector3());
          const largestDimension = Math.max(initialSize.x, initialSize.y, initialSize.z);

          if (largestDimension > 0) model.scale.setScalar(6.4 / largestDimension);

          model.updateMatrixWorld(true);
          const scaledBounds = new THREE.Box3().setFromObject(model, true);
          const modelCentre = scaledBounds.getCenter(new THREE.Vector3());
          model.position.sub(modelCentre);
          model.updateMatrixWorld(true);
          modelContainer.add(model);
          modelContainer.userData.ready = true;
        },
        (error) => console.error(`Unable to load index model: ${member.model}`, error)
      ));
    }

    textureLoader.load(
      member.image,
      loadedTexture => {
        const centeredTexture = createCenteredPhotoTexture(loadedTexture.image);
        loadedTexture.dispose();
        photoMaterial.map?.dispose();
        photoMaterial.map = centeredTexture;
        photoMaterial.needsUpdate = true;
      },
      undefined,
      () => console.info(`Member photo not found: ${member.image}. Showing initials instead.`)
    );

    carouselGroup.add(card);
    cuboids.push(card);
  }

  function updateCarouselPositions(activeIndex, animate = false) {
    cuboids.forEach((mesh, i) => {
      const relativeIndex = (i - activeIndex + memberCount) % memberCount;
      let targetX = 0, targetZ = 0, targetRotY = 0, targetScale = 1;
      if (relativeIndex === 0) { targetX = 0; targetZ = 6; targetRotY = 0; targetScale = 1; }
      else if (relativeIndex === 1) { targetX = 8.5; targetZ = 0; targetRotY = -Math.PI / 6; targetScale = 0.8; }
      else if (relativeIndex === 3) { targetX = -8.5; targetZ = 0; targetRotY = Math.PI / 6; targetScale = 0.8; }
      else { targetX = 0; targetZ = -6; targetRotY = 0; targetScale = 0.6; }
      
      if (animate) {
        gsap.to(mesh.position, { x: targetX, z: targetZ, duration: 0.5, ease: "power2.out", overwrite: 'auto' });
        gsap.to(mesh.rotation, { y: targetRotY, duration: 0.5, ease: "power2.out", overwrite: 'auto' });
        gsap.to(mesh.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.5, ease: "power2.out", overwrite: 'auto' });
      } else {
        mesh.position.set(targetX, 0, targetZ);
        mesh.rotation.y = targetRotY;
        mesh.scale.set(targetScale, targetScale, targetScale);
      }
    });
  }
  updateCarouselPositions(0, false);

  function moveCamera() {
    const t = -window.scrollY;
    const vh = window.innerHeight;
    const progress = Math.min(Math.max(-t / vh, 0), 1);
    const phoneLayout = window.innerWidth < 600;
    const compactLayout = window.innerWidth < 900;
    planetGroup.position.x = phoneLayout ? 0 : compactLayout ? 5.5 : 10.5;
    planetGroup.position.y = (progress * 30) + (phoneLayout ? -7.5 : compactLayout ? 0.75 : 0);
    planetGroup.scale.setScalar(phoneLayout ? 0.48 : compactLayout ? 0.72 : 1);
    carouselGroup.position.y = -50 + (progress * 50);
    carouselGroup.position.x = phoneLayout ? 0 : compactLayout ? -2.5 : -7.5;
    carouselGroup.scale.setScalar(phoneLayout ? 0.72 : compactLayout ? 0.86 : 1);
    camera.position.z = 30 - (progress * (phoneLayout ? 12 : 18));
    
    satellite.visible = progress < 0.1;
  }
  updateIndexLandingLayout = moveCamera;
  window.addEventListener('scroll', moveCamera, { passive: true });
  moveCamera();

  const prevBtn = document.getElementById('prev-member');
  const nextBtn = document.getElementById('next-member');
  const dots = document.querySelectorAll('.dot');
  const detailBtn = document.getElementById('detail-btn');
  const detailItems = Array.from(document.querySelectorAll('.details-list li'));
  const detailLabels = ['Education:', 'Career Interests:', 'Aspirations:', 'Achievements:', 'Certifications:'];
  const memberInfoPanel = document.querySelector('.member-info');
  const flipHint = document.getElementById('member-flip-hint');
  const flipHintText = flipHint?.querySelector('.flip-hint-text');
  const indexCardRaycaster = new THREE.Raycaster();
  const indexCardPointer = new THREE.Vector2();
  let modelViewIndex = null;

  function updateMemberInfo(index) {
    const data = indexMemberData[index];
    const isModelView = modelViewIndex === index;

    memberInfoPanel?.classList.toggle('is-model-view', isModelView);
    flipHint?.classList.toggle('is-model-view', isModelView);
    if (flipHintText) {
      flipHintText.textContent = isModelView
        ? 'Click the frame to return to the portrait'
        : 'Click the frame to view the 3D model';
    }

    detailItems.forEach((item, itemIndex) => {
      item.hidden = false;
      const label = item.querySelector('strong');
      if (label) label.innerText = detailLabels[itemIndex];
    });
    if (detailBtn) {
      detailBtn.hidden = false;
    }

    if (isModelView) {
      if (memberInfoPanel?.dataset.profileHeight) {
        memberInfoPanel.style.minHeight = `${memberInfoPanel.dataset.profileHeight}px`;
      }
      document.getElementById('member-name').innerText = data.modelName;
      document.getElementById('member-role').innerText = '3D MODEL';
      document.getElementById('member-education').innerText = data.modelDescription;

      const descriptionLabel = detailItems[0]?.querySelector('strong');
      if (descriptionLabel) descriptionLabel.innerText = 'Model Description:';
      detailItems.slice(1).forEach(item => { item.hidden = true; });
      if (detailBtn) detailBtn.hidden = true;
    } else {
      if (memberInfoPanel) memberInfoPanel.style.minHeight = '';
      document.getElementById('member-name').innerText = data.name;
      document.getElementById('member-role').innerText = data.role;
      document.getElementById('member-education').innerText = data.ed;
      document.getElementById('member-interests').innerText = data.int;
      document.getElementById('member-aspirations').innerText = data.asp;
      document.getElementById('member-achievements').innerText = data.ach;
      document.getElementById('member-certs').innerText = data.cert;
    }
    
    dots.forEach((dot, i) => {
      if (i === index) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  }

  function setModelView(index, enabled) {
    const card = cuboids[index];
    const modelContainer = card?.userData.modelContainer;
    const modelBackdrop = card?.userData.modelBackdrop;
    const memberPhoto = card?.userData.memberPhoto;

    if (enabled && (!modelContainer || !modelContainer.userData.ready)) return;

    if (enabled && memberInfoPanel) {
      memberInfoPanel.dataset.profileHeight = memberInfoPanel.getBoundingClientRect().height;
    }

    modelViewIndex = enabled ? index : null;
    updateMemberInfo(index);
    if (memberPhoto) memberPhoto.visible = !enabled;
    if (modelBackdrop) modelBackdrop.visible = enabled;
    if (modelContainer) modelContainer.visible = enabled;
  }

  function closeModelView() {
    if (modelViewIndex !== null) setModelView(modelViewIndex, false);
  }

  function rotateCarousel(direction) {
    closeModelView();
    if (direction === 'next') currentMemberIndex = (currentMemberIndex + 1) % memberCount;
    else currentMemberIndex = (currentMemberIndex - 1 + memberCount) % memberCount;
    updateCarouselPositions(currentMemberIndex, true);
    updateMemberInfo(currentMemberIndex);
  }

  if(prevBtn) prevBtn.addEventListener('click', () => rotateCarousel('prev'));
  if(nextBtn) nextBtn.addEventListener('click', () => rotateCarousel('next'));
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      closeModelView();
      currentMemberIndex = index;
      updateCarouselPositions(currentMemberIndex, true);
      updateMemberInfo(currentMemberIndex);
    });
  });

  window.addEventListener('pointerup', (event) => {
    if (event.target.closest?.('.member-info, button, a, input, textarea, .dots')) return;

    const activeCard = cuboids[currentMemberIndex];
    if (!activeCard?.userData.modelContainer?.userData.ready) return;

    indexCardPointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    indexCardPointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    indexCardRaycaster.setFromCamera(indexCardPointer, camera);

    if (indexCardRaycaster.intersectObject(activeCard, true).length === 0) return;
    setModelView(currentMemberIndex, modelViewIndex !== currentMemberIndex);
  });

  if(detailBtn) {
    detailBtn.addEventListener('click', () => {
      window.location.href = indexMemberData[currentMemberIndex].link;
    });
  }
  
  updateMemberInfo(0);
}

let skillsGroup, globe, skillObjects = [];
let skillsModelMixer = null;
let keepSkillsModelUpright = false;
let skillsModelRoot = null;
let skillsIdleAction = null;
let skillsWalkAction = null;
let skillsModelIsWalking = false;
let skillsWalkSound = null;
let skillsBubbleEl = null;
const decorativeModels = [];
const skillsRaycaster = new THREE.Raycaster();
const skillsPointer = new THREE.Vector2();
let projectsGroup, projectCuboids = [];
let projectCount = 0;

if (isMemberPage && window.MEMBER_DATA) {
  const mData = window.MEMBER_DATA;

  const nameEl = document.getElementById('detail-name');
  if(nameEl) nameEl.innerText = mData.name;
  
  const roleEl = document.getElementById('detail-role');
  if(roleEl) roleEl.innerText = mData.role;

const portraitCard = document.querySelector('.portrait-card');

if (portraitCard) {
  const maxTilt = 20;

  let currentTiltX = 0;
  let currentTiltY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;

  let animationFrame = null;
  let isPortraitDragging = false;
  let portraitBounds = null;

  portraitCard.style.cursor = 'grab';
  portraitCard.style.touchAction = 'none';
  portraitCard.style.userSelect = 'none';
  portraitCard.style.willChange = 'transform';
  portraitCard.style.transformStyle = 'preserve-3d';

  function animatePortraitTilt() {
    currentTiltX += (targetTiltX - currentTiltX) * 0.14;
    currentTiltY += (targetTiltY - currentTiltY) * 0.14;

    const tiltAmount = Math.min(
      (Math.abs(currentTiltX) + Math.abs(currentTiltY)) / maxTilt,
      1
    );

    const scale = 1 + tiltAmount * 0.025;

    portraitCard.style.transform = `
      perspective(1100px)
      rotateX(${currentTiltX}deg)
      rotateY(${currentTiltY}deg)
      scale3d(${scale}, ${scale}, ${scale})
    `;

    const stillMoving =
      Math.abs(targetTiltX - currentTiltX) > 0.02 ||
      Math.abs(targetTiltY - currentTiltY) > 0.02;

    if (stillMoving) {
      animationFrame = requestAnimationFrame(animatePortraitTilt);
    } else {
      animationFrame = null;
    }
  }

  function startTiltAnimation() {
    if (animationFrame === null) {
      animationFrame = requestAnimationFrame(animatePortraitTilt);
    }
  }

  function updatePortraitTilt(event) {
    const rect =
      portraitBounds || portraitCard.getBoundingClientRect();

    const pointerX = Math.max(
      -1,
      Math.min(
        1,
        ((event.clientX - rect.left) / rect.width) * 2 - 1
      )
    );

    const pointerY = Math.max(
      -1,
      Math.min(
        1,
        ((event.clientY - rect.top) / rect.height) * 2 - 1
      )
    );

    targetTiltX = -pointerY * maxTilt;
    targetTiltY = pointerX * maxTilt;

    startTiltAnimation();
  }

  function resetPortraitTilt() {
    targetTiltX = 0;
    targetTiltY = 0;
    portraitCard.style.cursor = 'grab';

    startTiltAnimation();
  }

  portraitCard.addEventListener('pointerenter', (event) => {
    portraitBounds = portraitCard.getBoundingClientRect();
    updatePortraitTilt(event);
  });

  portraitCard.addEventListener('pointermove', (event) => {
    updatePortraitTilt(event);
  });

  portraitCard.addEventListener('pointerdown', (event) => {
    isPortraitDragging = true;
    portraitBounds =
      portraitBounds || portraitCard.getBoundingClientRect();

    portraitCard.style.cursor = 'grabbing';
    portraitCard.setPointerCapture(event.pointerId);

    updatePortraitTilt(event);
  });

  portraitCard.addEventListener('pointerup', (event) => {
    isPortraitDragging = false;
    portraitCard.style.cursor = 'grab';

    if (portraitCard.hasPointerCapture(event.pointerId)) {
      portraitCard.releasePointerCapture(event.pointerId);
    }

    const rect =
      portraitBounds || portraitCard.getBoundingClientRect();

    const pointerInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (event.pointerType !== 'mouse' || !pointerInside) {
      portraitBounds = null;
      resetPortraitTilt();
    }
  });

  portraitCard.addEventListener('pointerleave', () => {
    if (!isPortraitDragging) {
      portraitBounds = null;
      resetPortraitTilt();
    }
  });

  portraitCard.addEventListener('pointercancel', () => {
    isPortraitDragging = false;
    portraitBounds = null;
    resetPortraitTilt();
  });
}

  skillsGroup = new THREE.Group();
  scene.add(skillsGroup);

  globe = new THREE.Group();
  skillsGroup.add(globe);

  const addFallbackSphere = () => {
    keepSkillsModelUpright = false;
    const fallbackSphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7.5, 2),
      new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true })
    );
    globe.add(fallbackSphere);
  };

  const memberModelPath = mData.skillsModel || mData.model;
  const memberModelSound = mData.modelSound || mData.clickSound;

  if (mData.clickMessage) {
    skillsBubbleEl = document.createElement('div');
    skillsBubbleEl.className = 'minion-bubble visible';
    skillsBubbleEl.textContent = mData.clickMessage;
    document.getElementById('skills-labels')?.appendChild(skillsBubbleEl);
  }

  if (memberModelPath) {
    keepSkillsModelUpright = true;
    loadModel(
      memberModelPath,
      (gltf) => {
        const model = gltf.scene;
        const findConfiguredClip = (name) => name
          ? gltf.animations.find((clip) => clip.name.toLowerCase() === String(name).toLowerCase())
          : null;
        let idleClip = findConfiguredClip(mData.idleAnimation)
          || gltf.animations.find((clip) => /(^|\|)(idle|standing)$/i.test(clip.name));
        let interactionClip = findConfiguredClip(mData.interactionAnimation)
          || gltf.animations.find((clip) => /(^|\|)walk$/i.test(clip.name));

        if (!interactionClip && (memberModelSound || !idleClip)) {
          interactionClip = gltf.animations.find((clip) => clip !== idleClip) || gltf.animations[0];
        }
        if (interactionClip === idleClip && memberModelSound) idleClip = null;

        if (idleClip || interactionClip) {
          skillsModelMixer = new THREE.AnimationMixer(model);
          if (idleClip) {
            skillsIdleAction = skillsModelMixer.clipAction(idleClip);
            skillsIdleAction.setLoop(THREE.LoopRepeat, Infinity).play();
          }

          if (interactionClip) {
            skillsWalkAction = skillsModelMixer.clipAction(interactionClip);
            skillsWalkAction.setLoop(THREE.LoopOnce, 1);
            skillsWalkAction.clampWhenFinished = true;

            skillsModelMixer.addEventListener('finished', (event) => {
              if (event.action !== skillsWalkAction) return;
              skillsWalkAction.stop();
              skillsIdleAction?.reset().fadeIn(0.2).play();
              skillsModelIsWalking = false;
            });
          }

          skillsModelMixer.update(0);
        }

        model.updateMatrixWorld(true);
        const initialBounds = new THREE.Box3().setFromObject(model, true);
        const initialSize = initialBounds.getSize(new THREE.Vector3());
        const largestDimension = Math.max(initialSize.x, initialSize.y, initialSize.z);
        const targetSize = Number(mData.modelSize) || 12;

        if (largestDimension > 0) {
          model.scale.setScalar(targetSize / largestDimension);
        }

        model.updateMatrixWorld(true);
        const centredBounds = new THREE.Box3().setFromObject(model, true);
        const modelCentre = centredBounds.getCenter(new THREE.Vector3());
        model.position.sub(modelCentre);
        model.position.y += Number(mData.modelOffsetY ?? mData.modelYOffset ?? 0);
        model.rotation.y = Number(mData.modelRotationY) || 0;
        model.updateMatrixWorld(true);

        const finalBounds = new THREE.Box3().setFromObject(model, true);
        const bubbleAnchorWorld = new THREE.Vector3(
          (finalBounds.min.x + finalBounds.max.x) / 2,
          finalBounds.max.y + 0.6,
          (finalBounds.min.z + finalBounds.max.z) / 2
        );
        model.userData.bubbleAnchor = model.worldToLocal(bubbleAnchorWorld);

        // The pivot remains upright; only this outer group rotates around world Y.
        globe.rotation.set(0, 0, 0);
        globe.add(model);
        skillsModelRoot = model;
        if (memberModelSound) {
          skillsWalkSound = new Audio(memberModelSound);
          skillsWalkSound.loop = false;
          skillsWalkSound.preload = 'auto';
          skillsWalkSound.addEventListener('ended', () => {
            if (!skillsWalkAction) skillsModelIsWalking = false;
          });
        }
      },
      (error) => {
        console.error(`Unable to load skills model: ${memberModelPath}`, error);
        addFallbackSphere();
      }
    );
  } else {
    addFallbackSphere();
  }

  window.addEventListener('pointerup', (event) => {
    if (!skillsModelRoot || (!skillsWalkAction && !skillsWalkSound)) return;
    if (event.target.closest('a, button, input, textarea')) return;

    skillsPointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    skillsPointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    skillsRaycaster.setFromCamera(skillsPointer, camera);

    if (skillsRaycaster.intersectObject(skillsModelRoot, true).length === 0) return;

    if (skillsModelIsWalking) {
      if (skillsWalkSound) {
        skillsWalkSound.pause();
        skillsWalkSound.currentTime = 0;
      }
      if (skillsWalkAction) {
        skillsWalkAction.fadeOut(0.15);
        skillsIdleAction?.reset().fadeIn(0.15).play();
      }
      skillsModelIsWalking = false;
      return;
    }

    skillsModelIsWalking = true;
    if (skillsWalkAction) {
      skillsIdleAction?.fadeOut(0.15);
      skillsWalkAction.reset().fadeIn(0.15).play();
    }

    if (skillsWalkSound) {
      skillsWalkSound.pause();
      skillsWalkSound.currentTime = 0;
      skillsWalkSound.play().catch((error) => {
        skillsModelIsWalking = false;
        console.warn('Unable to play member model sound.', error);
      });
    }
  });

  if (mData.rainModel) {
    const rainGroup = new THREE.Group();
    scene.add(rainGroup);
    loadModel(
      mData.rainModel,
      (gltf) => {
        const template = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(template, true);
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 2.4 / Math.max(size.x, size.y, size.z, 1);
        const count = Math.min(Number(mData.rainCount) || 20, 40);

        for (let index = 0; index < count; index++) {
          const item = template.clone(true);
          const itemScale = scale * (0.7 + Math.random() * 0.6);
          item.scale.setScalar(itemScale);
          item.position.set(Math.random() * 50 - 25, Math.random() * 60 - 15, Math.random() * 20 - 15);
          item.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          item.userData.fallSpeed = 0.03 + Math.random() * 0.05;
          item.userData.spinSpeed = (Math.random() - 0.5) * 0.02;
          rainGroup.add(item);
          decorativeModels.push(item);
        }
      },
      (error) => console.warn(`Unable to load decorative model: ${mData.rainModel}`, error)
    );
  }

  const skillsBase = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.5, 32), baseMat);
  skillsBase.position.y = -10;
  skillsGroup.add(skillsBase);
  const skillsRing = new THREE.Mesh(new THREE.TorusGeometry(10, 0.1, 16, 100), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
  skillsRing.rotation.x = Math.PI / 2;
  skillsRing.position.y = -9.7;
  skillsGroup.add(skillsRing);

  const labelsContainer = document.getElementById('skills-labels');
  const skillsList = mData.skills || [];
  
  const hexPositions = [
    { x: -14, y: 4, z: 0 }, { x: -16, y: -1, z: 0 }, { x: -14, y: -6, z: 0 },
    { x: 14, y: 4, z: 0 }, { x: 16, y: -1, z: 0 }, { x: 14, y: -6, z: 0 }
  ];

  for (let i = 0; i < Math.min(skillsList.length, 6); i++) {
    const hexMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 }));
    hexMesh.rotation.x = Math.PI / 2;
    hexMesh.rotation.y = Math.PI / 6; 
    const pos = hexPositions[i];
    hexMesh.position.set(pos.x, pos.y, pos.z);
    skillsGroup.add(hexMesh);
    
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(pos.x, pos.y, pos.z)]);
    skillsGroup.add(new THREE.Line(lineGeo, lineMat));
    
    const labelEl = document.createElement('div');
    labelEl.className = 'skill-label';
    labelEl.innerText = skillsList[i];
    if(labelsContainer) labelsContainer.appendChild(labelEl);
    
    skillObjects.push({ mesh: hexMesh, labelEl: labelEl, baseY: pos.y });
  }

  projectsGroup = new THREE.Group();
  scene.add(projectsGroup);

  const projectsData = mData.projects || [];
  projectCount = projectsData.length;
  const projectColors = [0x1166ff, 0xff1166, 0x11ff66, 0xffaa11, 0xaa11ff];

  function openMediaLightbox(kind, src) {
    let overlay = document.getElementById('media-lightbox');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'media-lightbox';
      overlay.className = 'lightbox-overlay hidden';
      overlay.innerHTML = `
        <button class="lightbox-close" type="button" aria-label="Close full view">&times;</button>
        <div class="lightbox-inner"></div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeMediaLightbox();
      });
      overlay.querySelector('.lightbox-close').addEventListener('click', closeMediaLightbox);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMediaLightbox();
      });
    }
    overlay.querySelector('.lightbox-inner').innerHTML = kind === 'video'
      ? `<video src="${src}" controls autoplay playsinline></video>`
      : `<img src="${src}" alt="">`;
    overlay.classList.remove('hidden');
  }

  function closeMediaLightbox() {
    const overlay = document.getElementById('media-lightbox');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.querySelector('.lightbox-inner').innerHTML = '';
  }

  function renderProjectMedia(container, project, context = 'card') {
    if (!container) return;

    container.replaceChildren();
    container.classList.remove('has-media', 'has-gallery');
    let media = project.media || {};

    if (context === 'modal' && project.video) {
      media = { type: 'video', src: project.video, poster: project.thumbnail };
    } else if (context === 'card' && project.thumbnail) {
      media = { type: 'image', src: project.thumbnail, alt: `${project.title} thumbnail` };
    } else if ((!media.src && !media.items) && project.image) {
      media = { type: 'image', src: project.image, alt: `${project.title} preview` };
    }

    if (media.type === 'gallery' && Array.isArray(media.items) && media.items.length) {
      if (context === 'card') {
        media = { type: 'image', src: media.items[0], alt: `${project.title} gallery preview` };
      } else {
        const track = document.createElement('div');
        track.className = 'gallery-track';
        media.items.forEach((src, itemIndex) => {
          const image = document.createElement('img');
          image.src = src;
          image.alt = `${project.title} image ${itemIndex + 1}`;
          image.loading = 'lazy';
          image.addEventListener('click', () => openMediaLightbox('image', src));
          track.appendChild(image);
        });
        container.classList.add('has-media', 'has-gallery');
        container.appendChild(track);
        return;
      }
    }

    const hasSource = typeof media.src === 'string' && media.src.trim() !== '';

    if (!hasSource) {
      container.classList.remove('has-media', 'has-gallery');
      const placeholder = document.createElement('div');
      placeholder.className = 'project-media-empty';
      placeholder.innerHTML = `
        <span class="project-media-empty-icon" aria-hidden="true">＋</span>
        <strong>Add project media</strong>
        <small>Image or demo video</small>
      `;
      container.appendChild(placeholder);
      return;
    }

    if (context === 'modal') container.classList.add('has-media');

    if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.preload = context === 'modal' ? 'metadata' : 'none';
      video.playsInline = true;
      video.controls = context === 'modal';
      video.muted = context === 'card';
      if (media.poster) video.poster = media.poster;
      video.setAttribute('aria-label', media.alt || `${project.title} demo video`);
      container.appendChild(video);

      if (context === 'card') {
        const badge = document.createElement('span');
        badge.className = 'project-video-badge';
        badge.textContent = '▶ DEMO';
        container.appendChild(badge);
      }
      return;
    }

    const image = document.createElement('img');
    image.src = media.src;
    image.alt = media.alt || `${project.title} preview`;
    image.loading = 'lazy';
    if (context === 'modal') image.addEventListener('click', () => openMediaLightbox('image', media.src));
    container.appendChild(image);
  }

  const projectsBase = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 0.5, 32), baseMat);
  projectsBase.position.y = -5;
  projectsGroup.add(projectsBase);

  const projectsRing = new THREE.Mesh(new THREE.TorusGeometry(9, 0.1, 16, 100), new THREE.MeshBasicMaterial({ color: 0x6a11ff }));
  projectsRing.rotation.x = Math.PI / 2;
  projectsRing.position.y = -4.7;
  projectsGroup.add(projectsRing);

  for (let i = 0; i < projectCount; i++) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(6.75, 9.75, 0.6, 4, 0.3), new THREE.MeshStandardMaterial({ color: projectColors[i % projectColors.length], roughness: 0.2, metalness: 0.1 }));
    
    const cardContent = document.createElement('div');
    cardContent.className = 'project-card-css3d';
    cardContent.style.pointerEvents = 'auto';
    
    const data = projectsData[i];
    cardContent.innerHTML = `
      <div class="project-card-media"></div>
      <div class="project-card-text">
        <h3>${data.title}</h3>
        <p>${data.desc}</p>
        <button class="card-btn view-details-btn">VIEW DETAILS</button>
      </div>
    `;
    renderProjectMedia(cardContent.querySelector('.project-card-media'), data, 'card');

    const cssObject = new CSS3DObject(cardContent);
    cssObject.scale.set(0.021, 0.021, 0.021);
    cssObject.position.set(0, 0, 0.31);
    mesh.add(cssObject);

    const btn = cardContent.querySelector('.view-details-btn');
    btn.addEventListener('click', () => {
      document.getElementById('modal-title').innerText = data.title;
      document.getElementById('modal-desc').innerText = data.desc;
      const techContainer = document.getElementById('modal-tech');
      techContainer.innerHTML = '';
      data.tech.forEach(t => {
        const span = document.createElement('span');
        span.innerText = t;
        techContainer.appendChild(span);
      });
      const modalMedia = document.getElementById('modal-media')
        || document.querySelector('#project-modal .modal-media-placeholder');
      renderProjectMedia(modalMedia, data, 'modal');

      const demoLink = document.getElementById('modal-demo-link')
        || document.querySelector('#project-modal .modal-demo-btn');
      if (demoLink) {
        const demoUrl = data.demoUrl || data.video || data.demoVideo || '';
        const hasDemoUrl = typeof demoUrl === 'string' && demoUrl.trim() !== '';
        demoLink.hidden = !hasDemoUrl;
        if (demoLink instanceof HTMLAnchorElement) {
          demoLink.href = hasDemoUrl ? demoUrl : '#';
        } else {
          demoLink.onclick = hasDemoUrl
            ? () => openMediaLightbox('video', demoUrl)
            : null;
        }
      }
      document.getElementById('project-modal').classList.remove('hidden');
    });

    projectsGroup.add(mesh);
    projectCuboids.push(mesh);
  }

  function updateProjectsPositions(activeIndex, animate = false) {
    if(projectCount === 0) return;
    projectCuboids.forEach((mesh, i) => {
      const relativeIndex = (i - activeIndex + projectCount) % projectCount;
      let targetX = 0, targetZ = 0, targetRotY = 0, targetScale = 1;
      
      if (relativeIndex === 0) { targetX = 0; targetZ = 12; targetRotY = 0; targetScale = 1.6; } 
      else if (relativeIndex === 1) { targetX = 10; targetZ = 0; targetRotY = -Math.PI / 6; targetScale = 0.8; } 
      else if (relativeIndex === projectCount - 1) { targetX = -10; targetZ = 0; targetRotY = Math.PI / 6; targetScale = 0.8; } 
      else { targetX = 0; targetZ = -6; targetRotY = 0; targetScale = 0.6; }
      
      if (animate) {
        gsap.to(mesh.position, { x: targetX, z: targetZ, duration: 0.5, ease: "power2.out", overwrite: 'auto' });
        gsap.to(mesh.rotation, { y: targetRotY, duration: 0.5, ease: "power2.out", overwrite: 'auto' });
        gsap.to(mesh.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.5, ease: "power2.out", overwrite: 'auto' });
      } else {
        mesh.position.set(targetX, 0, targetZ);
        mesh.rotation.y = targetRotY;
        mesh.scale.set(targetScale, targetScale, targetScale);
      }
    });
  }
  updateProjectsPositions(0, false);

  let currentProjectIndex = 0;
  const prevProjBtn = document.getElementById('prev-project');
  const nextProjBtn = document.getElementById('next-project');

  function rotateProjects(direction) {
    if(projectCount === 0) return;
    if (direction === 'next') currentProjectIndex = (currentProjectIndex + 1) % projectCount;
    else currentProjectIndex = (currentProjectIndex - 1 + projectCount) % projectCount;
    updateProjectsPositions(currentProjectIndex, true);
  }

  if(prevProjBtn) prevProjBtn.addEventListener('click', () => rotateProjects('prev'));
  if(nextProjBtn) nextProjBtn.addEventListener('click', () => rotateProjects('next'));

  const modal = document.getElementById('project-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  if(closeModalBtn) closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    const activeVideo = document.querySelector('#project-modal video');
    if (activeVideo) activeVideo.pause();
  });
}

if (isMemberPage) {
  const contactForm = document.querySelector('.contact-form');
  const sendMessageButton = contactForm?.querySelector('.contact-submit');
  const recipientLink = document.querySelector('.contact-links a[href^="mailto:"]');
  const nameInput = contactForm?.querySelector('#contact-name');
  const emailInput = contactForm?.querySelector('#contact-email');
  const messageInput = contactForm?.querySelector('#contact-message');

  if (contactForm && sendMessageButton && recipientLink && nameInput && emailInput && messageInput) {
    nameInput.required = true;
    emailInput.required = true;
    messageInput.required = true;

    sendMessageButton.addEventListener('click', () => {
      if (!contactForm.reportValidity()) return;

      const recipient = recipientLink.getAttribute('href').replace(/^mailto:/i, '').split('?')[0];
      const senderName = nameInput.value.trim();
      const senderEmail = emailInput.value.trim();
      const memberName = window.MEMBER_DATA.name;
      const subject = `Portfolio enquiry for ${memberName} from ${senderName}`;
      const body = [
        `Hello ${memberName},`,
        '',
        messageInput.value.trim(),
        '',
        `From: ${senderName}`,
        `Reply email: ${senderEmail}`
      ].join('\n');

      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }
}

function updateResponsiveSceneLayout() {
  if (isMemberPage) {
    const width = window.innerWidth;
    const skillsScale = width < 600 ? 0.48 : width < 900 ? 0.78 : 1;
    const projectsScale = width < 600 ? 0.72 : width < 900 ? 0.86 : 1;
    skillsGroup?.scale.setScalar(skillsScale);
    projectsGroup?.scale.setScalar(projectsScale);
  }
  updateIndexLandingLayout?.();
}

function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const frameTime = performance.now();

  animationTimer.update();
  const animationDelta = Math.min(animationTimer.getDelta(), 0.05);
  indexModelMixers.forEach((mixer) => mixer.update(animationDelta));
  if (dogMixer) dogMixer.update(animationDelta);
  if (skillsModelMixer) skillsModelMixer.update(animationDelta);

  stars.rotation.y += 0.0005;
  stars.rotation.x += 0.0002;

  decorativeModels.forEach((item) => {
    item.position.y -= item.userData.fallSpeed;
    item.rotation.x += item.userData.spinSpeed;
    item.rotation.y += item.userData.spinSpeed * 1.4;
    if (item.position.y < -30) {
      item.position.set(Math.random() * 50 - 25, 30 + Math.random() * 10, Math.random() * 20 - 15);
    }
  });

  const time = frameTime * 0.0015;
  const portraitCentreX = planetGroup?.position.x ?? 10.5;
  orbitingLight.position.x = portraitCentreX + Math.cos(time) * 15;
  orbitingLight.position.z = Math.sin(time) * 15;
  orbitingLight.position.y = 1 + Math.sin(time * 0.5) * 5;
  
  satellite.rotation.x += 0.01;
  satellite.rotation.y += 0.015;
  satellite.rotation.z += 0.005;

  if (isIndexPage && planetGroup && carouselGroup) {
    if (indexCarouselContainer) {
      const carouselRect = indexCarouselContainer.getBoundingClientRect();
      const carouselCenter = carouselRect.top + (carouselRect.height / 2);
      const viewportCenter = window.innerHeight / 2;
      const distanceFromCamera = camera.position.z - carouselGroup.position.z;
      const unitsPerPixel = (
        2 * distanceFromCamera * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      ) / window.innerHeight;
      carouselGroup.position.y = (viewportCenter - carouselCenter) * unitsPerPixel;
    }

    if (!landingGroupDragActive && Math.abs(landingGroupSpinVelocity) > 0.0005) {
      planetGroup.rotation.y += landingGroupSpinVelocity;
      landingGroupSpinVelocity *= 0.95;
    }
  }

  if (isMemberPage && skillsGroup && projectsGroup) {
    const rect = document.getElementById('member-skills').getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const verticalFrameAdjustment = keepSkillsModelUpright ? 10 : -40;
    const spacerCenter = rect.top + (rect.height / 2) + verticalFrameAdjustment;
    const unitPerPixel = (2 * 30 * Math.tan(THREE.MathUtils.degToRad(75 / 2))) / window.innerHeight;
    
    skillsGroup.position.y = (viewportCenter - spacerCenter) * unitPerPixel;
    globe.rotation.y += keepSkillsModelUpright ? 0.002 : 0.005;
    if (keepSkillsModelUpright) {
      globe.rotation.x = 0;
      globe.rotation.z = 0;
    } else {
      globe.rotation.x += 0.002;
    }
    skillsGroup.updateMatrixWorld(true);

    skillObjects.forEach((obj, i) => {
      obj.mesh.position.y = obj.baseY + Math.sin(frameTime * 0.002 + i) * 0.5;
      const vector = obj.mesh.position.clone();
      vector.applyMatrix4(skillsGroup.matrixWorld);
      vector.project(camera);
      const x = (vector.x * .5 + .5) * window.innerWidth;
      const y = (vector.y * -.5 + .5) * window.innerHeight;
      obj.labelEl.style.left = `${x}px`;
      obj.labelEl.style.top = `${y}px`;
    });

    if (skillsBubbleEl && skillsModelRoot?.userData.bubbleAnchor) {
      const bubblePosition = skillsModelRoot.userData.bubbleAnchor
        .clone()
        .applyMatrix4(skillsModelRoot.matrixWorld)
        .project(camera);
      skillsBubbleEl.style.left = `${(bubblePosition.x * 0.5 + 0.5) * window.innerWidth}px`;
      skillsBubbleEl.style.top = `${(bubblePosition.y * -0.5 + 0.5) * window.innerHeight}px`;
    }

    const pRect = document.getElementById('projects-spacer').getBoundingClientRect();
    const pSpacerCenter = pRect.top + (pRect.height / 2); 
    projectsGroup.position.y = (viewportCenter - pSpacerCenter) * unitPerPixel;
  }

  renderer.render(scene, camera);
  cssRenderer?.render(scene, camera);
}
updateResponsiveSceneLayout();
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRenderPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer?.setSize(window.innerWidth, window.innerHeight);
  updateResponsiveSceneLayout();
});
