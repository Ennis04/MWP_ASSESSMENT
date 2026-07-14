import './style.css';
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

const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.style.position = 'fixed';
cssRenderer.domElement.style.top = '0';
cssRenderer.domElement.style.left = '0';
cssRenderer.domElement.style.pointerEvents = 'none';
cssRenderer.domElement.style.zIndex = '50';
document.body.appendChild(cssRenderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffd0a0, 0.6);
fillLight.position.set(-10, 5, -5);
scene.add(fillLight);

// The orbiting light is now just a group to hold the bone, so it doesn't cast purple light
const orbitingLight = new THREE.Group();
if (isIndexPage) scene.add(orbitingLight);

// Add a cute cartoon bone instead of a satellite
const satellite = new THREE.Group();
const boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });

// Shaft
const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 16), boneMat);
shaft.rotation.z = Math.PI / 2;
satellite.add(shaft);

// Ends
const endGeo = new THREE.SphereGeometry(0.5, 16, 16);
const end1 = new THREE.Mesh(endGeo, boneMat);
end1.position.set(1.1, 0.3, 0);
satellite.add(end1);

const end2 = new THREE.Mesh(endGeo, boneMat);
end2.position.set(1.1, -0.3, 0);
satellite.add(end2);

const end3 = new THREE.Mesh(endGeo, boneMat);
end3.position.set(-1.1, 0.3, 0);
satellite.add(end3);

const end4 = new THREE.Mesh(endGeo, boneMat);
end4.position.set(-1.1, -0.3, 0);
satellite.add(end4);


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
let dogGroup, dogMixer, dogBaseY = 0, scrollProgress = 0;
let targetRotationY = -0.8;
let isDragging = false;
let previousMouseX = 0;
const animationClock = new THREE.Clock();
let carouselGroup, cuboids = [];
const memberCount = 4;

// Member information used by the About Us carousel.
// To add your own photos:
// 1. Put the image files in public/members/.
// 2. Update each image path below. Square or portrait images work best.
const indexMemberData = [
  { name: "Ennis Lam Si Hoong", role: "Student", link: "ennis.html", image: "/members/ennis.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", asp: "Passionate about interactive web design. Aspires to build immersive 3D frontend applications.", ach: "Dean's List 2023, completed Advanced Web UI/UX Bootcamp." },
  { name: "Liew Choon Pang", role: "Student", link: "liew.html", image: "/members/liew.png", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", asp: "Interested in scalable database management. Hopes to become a Cloud Architect.", ach: "Participated in National University Hackathon 2023, AWS Cloud Practitioner." },
  { name: "Chua Lin Wei", role: "Student", link: "chua.html", image: "/members/fifi.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", asp: "Eager to learn user-centric design principles. Aims to create accessible and beautiful digital tools.", ach: "Top 10 in Campus Design Challenge, Google UX Design Certificate." },
  { name: "Tai Yi Tian", role: "Student", link: "tai.html", image: "/members/tai.jpeg", ed: "Bachelor of Computer Science (Graphics and Multimedia Software)", asp: "Interested in Image Processing and AI. Aspires to be a Software Developer.", ach: "CGPA with 3.93" }
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
  // Load the dog textures with correct orientation
  // The GLB uses the KHR_materials_pbrSpecularGlossiness extension so we manually
  // apply the embedded textures from the supplied texture folder.
  const textureLoader = new THREE.TextureLoader();

  const dogTexture = textureLoader.load('/baby-dog/textures/gltf_embedded_0.png');
  dogTexture.colorSpace = THREE.SRGBColorSpace;
  dogTexture.flipY = true;

  const dogNormal = textureLoader.load('/baby-dog/textures/gltf_embedded_2.png');
  dogNormal.flipY = true;

  const dogAO = textureLoader.load('/baby-dog/textures/gltf_embedded_3@channels=R.png');
  dogAO.flipY = true;

  const dogMaterial = new THREE.MeshStandardMaterial({
    map: dogTexture,
    normalMap: dogNormal,
    aoMap: dogAO,
    roughness: 0.8,
    metalness: 0.1
  });

  const dogLoader = new GLTFLoader();
  dogLoader.load(
    '/baby-dog/source/baby%20dog.glb',
    (gltf) => {
      dogGroup = gltf.scene;
      dogGroup.position.set(0, 0, 0);

      // Normalise any model dimensions so different exports sit consistently in the scene.
      const bounds = new THREE.Box3().setFromObject(dogGroup);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      // Make the dog bigger and center it on the right side of the viewport.
      // Scale 22 fills the right panel nicely; x=11 places it at the right-half centre.
      const scale = 22 / Math.max(size.x, size.y, size.z);
      dogGroup.scale.setScalar(scale);
      // Center horizontally at x=11 (right side), vertically centre the model in view
      const modelHeight = size.y * scale;
      dogGroup.position.set(11 - center.x * scale, -center.y * scale, -center.z * scale);
      dogGroup.rotation.y = targetRotationY;
      dogBaseY = dogGroup.position.y;

      dogGroup.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
        node.material = dogMaterial;
      });

      scene.add(dogGroup);

      // Play the standing skeletal animation
      if (gltf.animations && gltf.animations.length > 0) {
        dogMixer = new THREE.AnimationMixer(dogGroup);
        const standingClip = gltf.animations.find(a => a.name === 'standing') || gltf.animations[0];
        const action = dogMixer.clipAction(standingClip);
        action.play();
      }
    },
    undefined,
    () => {
      // Keep the lightweight in-scene fallback visible during local development if
      // the asset has not been copied into public yet.
      console.warn('Dog model not found: check public/baby-dog/source/baby dog.glb.');
    }
  );

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
        gsap.to(mesh.position, { x: targetX, z: targetZ, duration: 0.8, ease: "power2.out" });
        gsap.to(mesh.rotation, { y: targetRotY, duration: 0.8, ease: "power2.out" });
        gsap.to(mesh.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.8, ease: "power2.out" });
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
    const t = document.body.getBoundingClientRect().top;
    const vh = window.innerHeight;
    const progress = Math.min(Math.max(-t / vh, 0), 1);
    scrollProgress = progress;
    if (dogGroup) dogGroup.position.y = dogBaseY + progress * 30;
    carouselGroup.position.y = -50 + (progress * 50);
    camera.position.z = 30 - (progress * 18); 
    carouselGroup.position.x = -7.5; 
    
    // Hide the bone when scrolling away from Landing Page
    satellite.visible = progress < 0.1; 
  }
  document.body.onscroll = moveCamera;
  moveCamera();

  // DOM Click Logic
  const prevBtn = document.getElementById('prev-member');
  const nextBtn = document.getElementById('next-member');
  const dots = document.querySelectorAll('.dot');
  const detailBtn = document.getElementById('detail-btn');

  function updateMemberInfo(index) {
    const data = indexMemberData[index];
    document.getElementById('member-name').innerText = data.name;
    document.getElementById('member-role').innerText = data.role;
    document.getElementById('member-education').innerText = data.ed;
    document.getElementById('member-aspirations').innerText = data.asp;
    document.getElementById('member-achievements').innerText = data.ach;
    
    dots.forEach((dot, i) => {
      if (i === index) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  }

  function rotateCarousel(direction) {
    if (direction === 'next') currentMemberIndex = (currentMemberIndex + 1) % memberCount;
    else currentMemberIndex = (currentMemberIndex - 1 + memberCount) % memberCount;
    updateCarouselPositions(currentMemberIndex, true);
    setTimeout(() => updateMemberInfo(currentMemberIndex), 300);
  }

  if(prevBtn) prevBtn.addEventListener('click', () => rotateCarousel('prev'));
  if(nextBtn) nextBtn.addEventListener('click', () => rotateCarousel('next'));
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      currentMemberIndex = index;
      updateCarouselPositions(currentMemberIndex, true);
      updateMemberInfo(currentMemberIndex);
    });
  });

  if(detailBtn) {
    detailBtn.addEventListener('click', () => {
      window.location.href = indexMemberData[currentMemberIndex].link;
    });
  }
  
  updateMemberInfo(0);

  // --- Dog 360-degree Drag Rotation Controls ---
  window.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMouseX = e.clientX;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !dogGroup) return;
    const deltaX = e.clientX - previousMouseX;
    previousMouseX = e.clientX;
    targetRotationY += deltaX * 0.007;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  window.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  // Touch controls for mobile support
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      isDragging = true;
      previousMouseX = e.touches[0].clientX;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging || !dogGroup || e.touches.length === 0) return;
    const deltaX = e.touches[0].clientX - previousMouseX;
    previousMouseX = e.touches[0].clientX;
    targetRotationY += deltaX * 0.007;
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// ==========================================
// GLOBALS FOR MEMBER PAGE
// ==========================================
let skillsGroup, globe, skillObjects = [];
let memberModelGroup = null, memberModelMixer = null;
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

  // If this member page supplies a custom GLB model, load it in place of the globe.
  if (mData.model) {
    const memberLoader = new GLTFLoader();
    memberLoader.load(
      mData.model,
      (gltf) => {
        memberModelGroup = gltf.scene;

        // Auto-scale so the tallest axis fits within ~36 units
        const mBounds = new THREE.Box3().setFromObject(memberModelGroup);
        const mSize   = mBounds.getSize(new THREE.Vector3());
        const mCenter = mBounds.getCenter(new THREE.Vector3());
        const mScale  = 36 / Math.max(mSize.x, mSize.y, mSize.z);
        memberModelGroup.scale.setScalar(mScale);
        // Centre the model at the origin of skillsGroup
        memberModelGroup.position.set(-mCenter.x * mScale, -mCenter.y * mScale, -mCenter.z * mScale);

        skillsGroup.add(memberModelGroup);

        // Setup audio listener and load the meme sound
        const listener = new THREE.AudioListener();
        camera.add(listener);
        const sound = new THREE.Audio(listener);
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('/oiia-oiia-sound.mp3', function(buffer) {
          sound.setBuffer(buffer);
          sound.setLoop(false); // Don't loop, so it can auto-stop
          sound.setVolume(0.8);
        });

        // Initialize embedded animations in a stopped state (default pose)
        let actions = [];
        if (gltf.animations && gltf.animations.length > 0) {
          memberModelMixer = new THREE.AnimationMixer(memberModelGroup);
          gltf.animations.forEach(clip => {
            const action = memberModelMixer.clipAction(clip);
            actions.push(action);
          });
        }
        
        // Raycaster for click detection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        window.isModelActive = false;
        
        window.addEventListener('click', (event) => {
          if (!memberModelGroup) return;
          // Normalize mouse coordinates
          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          
          const intersects = raycaster.intersectObject(memberModelGroup, true);
          if (intersects.length > 0) {
            window.isModelActive = !window.isModelActive; // Toggle state
            
            if (window.isModelActive) {
              // Start embedded animations
              actions.forEach(action => action.play());
              
              // Start sound and setup auto-stop
              if (sound.buffer) {
                if (sound.isPlaying) sound.stop();
                sound.play();
                
                if (sound.source) {
                  sound.source.onended = () => {
                    window.isModelActive = false;
                    actions.forEach(action => action.stop()); // Resets to default pose
                  };
                }
              }
            } else {
              // Stop everything and reset to default pose
              actions.forEach(action => action.stop());
              if (sound.buffer && sound.isPlaying) sound.stop();
            }
          }
        });
      },
      undefined,
      (err) => console.warn('Member model failed to load:', err)
    );
    // Invisible placeholder so the skills lines still have a centre reference
    globe = new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({ visible: false }));
    skillsGroup.add(globe);
  } else {
    globe = new THREE.Mesh(new THREE.IcosahedronGeometry(7.5, 2), new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true }));
    skillsGroup.add(globe);
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
      <div class="project-card-media">
        ${data.image ? `<img src="${data.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" alt="${data.title}" />` : `<span>🖼️</span>`}
      </div>
      <div class="project-card-text">
        <h3>${data.title}</h3>
        <p>${data.desc}</p>
        <button class="card-btn view-details-btn">VIEW DETAILS</button>
      </div>
    `;
    
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

      const mediaContainer = document.querySelector('.modal-left');
      if (data.video) {
        mediaContainer.innerHTML = `<video src="${data.video}" controls autoplay style="width: 100%; height: 100%; border-radius: 15px; object-fit: cover; background: #000;"></video>`;
      } else if (data.image) {
        mediaContainer.innerHTML = `<img src="${data.image}" style="width: 100%; height: 100%; border-radius: 15px; object-fit: cover;" alt="${data.title}" />`;
      } else {
        mediaContainer.innerHTML = `<div class="modal-media-placeholder"><span class="play-icon">▶</span></div>`;
      }

      const githubBtn = document.getElementById('modal-github-btn');
      if (githubBtn) {
        githubBtn.href = data.github ? data.github : '#';
        githubBtn.style.display = 'inline-block';
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
        gsap.to(mesh.position, { x: targetX, z: targetZ, duration: 0.8, ease: "power2.out" });
        gsap.to(mesh.rotation, { y: targetRotY, duration: 0.8, ease: "power2.out" });
        gsap.to(mesh.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.8, ease: "power2.out" });
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
    const video = modal.querySelector('video');
    if (video) video.pause();
  });
}

// ==========================================
// ANIMATION LOOP
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(animationClock.getDelta(), 0.05);

  stars.rotation.y += 0.0005;
  stars.rotation.x += 0.0002;

  // Orbiting satellite light
  const time = Date.now() * 0.0015;
  orbitingLight.position.x = 10 + Math.cos(time) * 16; 
  orbitingLight.position.z = Math.sin(time) * 16; 
  orbitingLight.position.y = Math.sin(time * 0.5) * 6;
  
  // Make the satellite slowly tumble
  satellite.rotation.x += 0.01;
  satellite.rotation.y += 0.015;
  satellite.rotation.z += 0.005;

  if (isIndexPage && carouselGroup) {
    carouselGroup.position.y += Math.sin(Date.now() * 0.001) * 0.01;

    if (dogGroup) {
      // Gentle idle breathing motion
      const dogTime = animationClock.elapsedTime;
      dogGroup.position.y = dogBaseY + scrollProgress * 30 + Math.sin(dogTime * 1.2) * 0.06;

      // Smoothly lerp rotation toward the target set by mouse drag
      dogGroup.rotation.y += (targetRotationY - dogGroup.rotation.y) * 0.08;
    }
  }

  // Update the skeletal animation mixer
  if (dogMixer) dogMixer.update(delta);

  // Update member page custom model mixer (e.g. Maxwell the cat)
  if (memberModelMixer) memberModelMixer.update(delta);

  if (isMemberPage && skillsGroup && projectsGroup) {
    const rect = document.getElementById('member-skills').getBoundingClientRect();
    const viewportCenter = window.innerHeight / 2;
    const spacerCenter = rect.top + (rect.height / 2) - 40; 
    const unitPerPixel = (2 * 30 * Math.tan(THREE.MathUtils.degToRad(75 / 2))) / window.innerHeight;
    
    skillsGroup.position.y = (viewportCenter - spacerCenter) * unitPerPixel;

    // Animate the centre model: spin + gentle bob (lowered base Y position)
    if (memberModelGroup) {
      if (window.isModelActive) {
        memberModelGroup.rotation.y += 0.08; // Fast spin when active
        const bobTime = animationClock.elapsedTime;
        memberModelGroup.position.y = -4.5 + Math.sin(bobTime * 4.0) * 0.8; // Fast bob
      } else {
        memberModelGroup.rotation.y += 0.005; // Gentle idle rotation
        memberModelGroup.position.y = -4.5; // Stay still when inactive
      }
    } else {
      globe.rotation.y += 0.005;
      globe.rotation.x += 0.002;
    }
    
    skillObjects.forEach((obj, i) => {
      obj.mesh.position.y = obj.baseY + Math.sin(Date.now() * 0.002 + i) * 0.5;
      const vector = obj.mesh.position.clone();
      vector.applyMatrix4(skillsGroup.matrixWorld);
      vector.project(camera);
      const x = (vector.x * .5 + .5) * window.innerWidth;
      const y = (vector.y * -.5 + .5) * window.innerHeight;
      obj.labelEl.style.left = `${x}px`;
      obj.labelEl.style.top = `${y}px`;
    });

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
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
});
