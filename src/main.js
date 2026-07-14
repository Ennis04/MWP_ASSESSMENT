import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

const isIndexPage = document.getElementById('index-page') !== null;
const isMemberPage = document.getElementById('member-page') !== null;

// ==========================================
// 1. SCENE SETUP
// ==========================================
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
const maxRenderPixelRatio = 1.75;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRenderPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'fixed';
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.left = '0';
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '50';
document.body.appendChild(cssRenderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffd0a0, 0.6);
fillLight.position.set(-10, 5, -5);
scene.add(fillLight);

// The orbiting group carries the bone without casting a purple point light.
const orbitingLight = new THREE.Group();
if (isIndexPage) scene.add(orbitingLight);

// Cartoon bone orbiting the dog on the landing page.
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

// Stars
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

// Shared Base Material
const baseMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8, metalness: 0.2 });

// ==========================================
// GLOBALS FOR INDEX PAGE
// ==========================================
let planetGroup, dogModel, dogMixer;
let carouselGroup, cuboids = [];
let dogDragActive = false, dogSpinVelocity = 0, dogHitBox = null;
const indexModelMixers = [];
const indexModelAnimationClock = new THREE.Clock();
const memberCount = 4;

// Member information
const indexMemberData = [
  { name: "Ennis Lam Si Hoong", role: "Software Engineer", link: "ennis.html", image: "/members/ennis.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "UI/UX, Web Development, IoT", asp: "Create immersive worlds", ach: "ROBOCON MALAYSIA 2025 – Champion & Best Engineering Award", cert: "Anugerah Insan Terbilang Negeri Sembilan", model: "/ennis/bananacat.glb", modelName: "Banana Cat", modelDescription: "Banana Cat is a famous meme in the Intenet. The reason I choose it as my model is that it is cute and always positve and energetic." },
  { name: "Liew Choon Pang", role: "Graphics and Multimedia Software", link: "liew.html", image: "/members/liew.png", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "Python, Java, Node.js, Power BI, Three.js, Unity", asp: "Interested in scalable database management. Hopes to become a Cloud Architect.", ach: "Participated in National University Hackathon 2023", cert: "AWS Cloud Practitioner", model: "/liew/panda_head_meme.glb", modelName: "Panda Head Meme", modelDescription: "A 3D panda meme model featured in Liew's portfolio." },
  { name: "Chua Lin Wei", role: "Data Analytics", link: "chua.html", image: "/members/fifi.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "Data Analytics, Scrum Master", asp: "Become a Chief Technology Officer", ach: "i-CPROM 2023", cert: "Certification of Contribution Penang Heritage Trust", model: "/chuamedia/minion.glb", modelName: "Minion", modelDescription: "Minions are a movie character who loves bananas. They talk in a funny and gibberish language making them cute and simple." },
  { name: "Tai Yi Tian", role: "Graphics and Multimedia Software", link: "tai.html", image: "/members/tai.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", int: "Vue.js, C++, Python, Java, Unity, Power BI", asp: "Interested in Image Processing and AI. Aspires to be a Software Developer.", ach: "CGPA 3.93", cert: "—", model: "/tai/oiiaioooooiai_cat.glb", modelName: "Oiia Cat", modelDescription: "Tai's animated Oiia cat model with its original sound effect." }
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

  // Calculate a centered object-fit: cover crop before creating the texture.
  // All cards therefore receive pixels with exactly the same dimensions.
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

  // A restrained edge vignette gives the portraits more depth without
  // obscuring faces or changing the original colours.
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
  // Dog landing model replacing the previous Saturn scene.
  planetGroup = new THREE.Group();
  planetGroup.position.set(10, 0, 0);
  scene.add(planetGroup);

  const textureLoader = new THREE.TextureLoader();
  const indexModelLoader = new GLTFLoader();
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

  indexModelLoader.load(
    '/baby-dog/source/baby%20dog.glb',
    (gltf) => {
      dogModel = gltf.scene;
      dogModel.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(dogModel, true);
      const size = bounds.getSize(new THREE.Vector3());
      const centre = bounds.getCenter(new THREE.Vector3());
      const scale = 20 / Math.max(size.x, size.y, size.z, 1);
      dogModel.scale.setScalar(scale);
      dogModel.position.set(-centre.x * scale, -centre.y * scale, -centre.z * scale);
      dogModel.rotation.y = -0.2;

      dogModel.traverse((node) => {
        if (!node.isMesh) return;
        node.material = dogMaterial;
      });
      planetGroup.add(dogModel);
      // dog is a skinned mesh, so precise raycasting against its posed
      // geometry is unreliable - a padded bounding box works fine instead
      dogHitBox = new THREE.Box3().setFromObject(dogModel).expandByScalar(1.5);

      const standingClip = gltf.animations.find((clip) => /standing|idle/i.test(clip.name))
        || gltf.animations[0];
      if (standingClip) {
        dogMixer = new THREE.AnimationMixer(dogModel);
        dogMixer.clipAction(standingClip).setLoop(THREE.LoopRepeat, Infinity).play();
      }
    },
    undefined,
    (error) => console.error('Unable to load the landing-page dog model.', error)
  );

  // Drag on the dog to spin it around; the canvas sits behind the page
  // content (z-index -1) so these listeners live on window like the other
  // model click handlers, not on the canvas itself.
  let dogDragLastX = 0;
  const dogDragPointer = new THREE.Vector2();
  const dogDragRaycaster = new THREE.Raycaster();
  const dogHitPoint = new THREE.Vector3();

  const pointerIsOnDog = (clientX, clientY) => {
    if (!dogModel || !dogHitBox) return false;
    dogDragPointer.x = (clientX / window.innerWidth) * 2 - 1;
    dogDragPointer.y = -(clientY / window.innerHeight) * 2 + 1;
    dogDragRaycaster.setFromCamera(dogDragPointer, camera);
    return dogDragRaycaster.ray.intersectBox(dogHitBox, dogHitPoint) !== null;
  };

  window.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button, input, textarea')) return;
    if (!pointerIsOnDog(event.clientX, event.clientY)) return;
    dogDragActive = true;
    dogDragLastX = event.clientX;
    dogSpinVelocity = 0;
    document.body.style.cursor = 'grabbing';
  });

  window.addEventListener('pointermove', (event) => {
    if (dogDragActive) {
      const deltaX = event.clientX - dogDragLastX;
      dogDragLastX = event.clientX;
      dogSpinVelocity = deltaX * 0.012;
      if (dogModel) dogModel.rotation.y += dogSpinVelocity;
      return;
    }
    if (event.target.closest('a, button, input, textarea')) return;
    document.body.style.cursor = pointerIsOnDog(event.clientX, event.clientY) ? 'grab' : '';
  });

  const releaseDogDrag = () => {
    if (!dogDragActive) return;
    dogDragActive = false;
    document.body.style.cursor = '';
  };
  window.addEventListener('pointerup', releaseDogDrag);
  window.addEventListener('pointerleave', releaseDogDrag);

  // Carousel
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
    // A small optical correction balances the visible frame because the
    // carousel is intentionally positioned to the left of the camera.
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

      indexModelLoader.load(
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
        undefined,
        (error) => console.error(`Unable to load index model: ${member.model}`, error)
      );
    }

    // If the configured image cannot be found, the initials texture remains visible.
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

  // Scroll Interaction
  function moveCamera() {
    const t = -window.scrollY;
    const vh = window.innerHeight;
    const progress = Math.min(Math.max(-t / vh, 0), 1);
    planetGroup.position.y = progress * 30;
    carouselGroup.position.y = -50 + (progress * 50);
    camera.position.z = 30 - (progress * 18); 
    carouselGroup.position.x = -7.5; 
    
    // Hide the bone when scrolling away from the landing page.
    satellite.visible = progress < 0.1;
  }
  window.addEventListener('scroll', moveCamera, { passive: true });
  moveCamera();

  // DOM Click Logic
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

// ==========================================
// GLOBALS FOR MEMBER PAGE
// ==========================================
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
const skillsAnimationClock = new THREE.Clock();
const skillsRaycaster = new THREE.Raycaster();
const skillsPointer = new THREE.Vector2();
let projectsGroup, projectCuboids = [];
let projectCount = 0;

if (isMemberPage && window.MEMBER_DATA) {
  const mData = window.MEMBER_DATA;

  // Update header automatically
  const nameEl = document.getElementById('detail-name');
  if(nameEl) nameEl.innerText = mData.name;
  
  const roleEl = document.getElementById('detail-role');
  if(roleEl) roleEl.innerText = mData.role;

  // Skills Scene
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
    const modelLoader = new GLTFLoader();
    modelLoader.load(
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

        // Centre the animated geometry itself, not the potentially offset GLB origin.
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
      undefined,
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

    // second click while it's already going stops it instead of restarting
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
    new GLTFLoader().load(
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
      undefined,
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

  // Projects Scene
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

// Open the visitor's email app with the contact form details pre-filled.
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

// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  const frameTime = performance.now();

  const indexAnimationDelta = Math.min(indexModelAnimationClock.getDelta(), 0.05);
  indexModelMixers.forEach((mixer) => mixer.update(indexAnimationDelta));
  if (dogMixer) dogMixer.update(indexAnimationDelta);
  const animationDelta = Math.min(skillsAnimationClock.getDelta(), 0.05);
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

  // Bone orbit around the landing-page dog.
  const time = frameTime * 0.0015;
  orbitingLight.position.x = 10 + Math.cos(time) * 16; 
  orbitingLight.position.z = Math.sin(time) * 16; 
  orbitingLight.position.y = Math.sin(time * 0.5) * 6;
  
  // Make the bone slowly tumble.
  satellite.rotation.x += 0.01;
  satellite.rotation.y += 0.015;
  satellite.rotation.z += 0.005;

  if (isIndexPage && planetGroup && carouselGroup) {
    carouselGroup.position.y += Math.sin(frameTime * 0.001) * 0.01;

    if (dogModel && !dogDragActive && Math.abs(dogSpinVelocity) > 0.0005) {
      dogModel.rotation.y += dogSpinVelocity;
      dogSpinVelocity *= 0.95;
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
  cssRenderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRenderPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
});
