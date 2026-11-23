import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EquirectangularReflectionMapping,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Mesh as ThreeMesh,
  type ColorSpace,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import type { WorldGoal, WorldObstacle, WorldProfile, WorldStep } from '@/lib/validation/world';

export type CameraMode = 'top' | 'chase' | 'firstPerson';

type WorldData = {
  profile: WorldProfile;
  goals: WorldGoal[];
  obstacles: WorldObstacle[];
  steps: WorldStep[];
  moodKey: string | null;
};

export type WorldEngine = {
  update: (data: WorldData, camera: CameraMode, selectedGoalId: string | null) => void;
  selectAt: (clientX: number, clientY: number) => string | null;
  dispose: () => void;
};

type Placement = { x: number; z: number; scale: number; rotation: number };

const ASSET_ROOT = '/world/assets';
const GOAL_WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [6, 1],
  [-7, 12],
  [8, 10],
  [17, -1],
  [8, -17],
  [-8, -18],
  [-18, -4],
  [-15, 14],
];

export function createWorldEngine(
  canvas: HTMLCanvasElement,
  initialData: WorldData,
  initialCamera: CameraMode,
  initialGoalId: string | null,
  onSelectGoal: (goalId: string) => void,
  onUnavailable: () => void,
  onReady: () => void,
): WorldEngine | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.error('Unable to initialize the World of Growth renderer.', error);
    onUnavailable();
    return null;
  }

  const isMobile = window.matchMedia('(max-width: 720px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new Scene();
  scene.background = new Color('#aeb6a6');
  scene.fog = new Fog('#aeb6a6', 70, 190);

  const camera = new PerspectiveCamera(43, 1, 0.1, 260);
  const lookAtTarget = new Vector3(0, 3, 0);
  const directionLight = new DirectionalLight('#ffe9c3', 3.2);
  directionLight.position.set(-32, 54, 28);
  directionLight.castShadow = true;
  directionLight.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  directionLight.shadow.camera.left = -55;
  directionLight.shadow.camera.right = 55;
  directionLight.shadow.camera.top = 55;
  directionLight.shadow.camera.bottom = -55;
  directionLight.shadow.camera.near = 1;
  directionLight.shadow.camera.far = 130;
  directionLight.shadow.bias = -0.00015;
  scene.add(directionLight);

  const ambientLight = new AmbientLight('#d9e2d5', 1.25);
  scene.add(ambientLight);

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.15 : 1.65));

  const contentGroup = new Group();
  scene.add(contentGroup);

  const markerGeometry = new IcosahedronGeometry(0.55, 2);
  const markerMaterial = new MeshStandardMaterial({ color: '#b7ad94', roughness: 0.92 });
  const selectedMarkerMaterial = new MeshStandardMaterial({ color: '#9eae91', roughness: 0.8 });
  const obstacleMaterial = new MeshStandardMaterial({ color: '#857e6b', roughness: 0.96 });
  const brassMaterial = new MeshStandardMaterial({ color: '#b7a16e', roughness: 0.55, metalness: 0.45 });
  const bridgeMaterial = new MeshStandardMaterial({ color: '#73604a', roughness: 0.9 });
  const bridgePlankGeometry = new BoxGeometry(0.62, 0.13, 2.3);
  const sharedAssets = new Group();
  sharedAssets.visible = false;
  scene.add(sharedAssets);
  sharedAssets.add(createTrophy(brassMaterial));
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const goalTargets: Mesh[] = [];
  const goalMarkers = new Map<string, Mesh>();
  const goalPositions = new Map<string, Vector3>();
  const activePointers = new Map<number, Vector2>();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  const loader = new GLTFLoader();
  const textureLoader = new TextureLoader();
  const pendingTextures: Texture[] = [];
  const pendingModels: Object3D[] = [];

  let data = initialData;
  let cameraMode = initialCamera;
  let selectedGoalId = initialGoalId;
  let disposed = false;
  let ready = false;
  let frame = 0;
  let lastFrameTime = 0;
  let width = 0;
  let height = 0;
  let zoomFactor = 1;
  let yaw = 0.08;
  let orbitOffset = 0;
  let baseTreeScale = 2.7;
  let targetTreeScale = 2.7;
  let growthTree: Group | null = null;
  let riverSurface: Mesh | null = null;
  let riverBasePositions: Float32Array | null = null;
  let rockTemplate: Group | null = null;
  let environmentTexture: Texture | null = null;
  let pmremGenerator: PMREMGenerator | null = null;
  let environmentTarget: ReturnType<PMREMGenerator['fromEquirectangular']> | null = null;
  let pointerStart: { id: number; x: number; y: number; moved: boolean } | null = null;
  let pinchDistance: number | null = null;
  const previousTouchAction = canvas.style.touchAction;

  const getModeDistance = () => {
    const distance = cameraMode === 'top' ? 43 : cameraMode === 'chase' ? 31 : 9;
    return MathUtils.clamp(distance * zoomFactor, cameraMode === 'firstPerson' ? 4 : 15, 96);
  };

  const getModePitch = () => {
    const pitch = cameraMode === 'top' ? 0.88 : cameraMode === 'chase' ? 0.37 : 0.09;
    return MathUtils.clamp(pitch + orbitOffset, -0.02, 1.28);
  };

  const getLookTarget = () => {
    if (selectedGoalId) {
      const location = goalPositions.get(selectedGoalId);
      if (location) return new Vector3(location.x, location.y + 1.2, location.z);
    }
    return new Vector3(0, heightAt(1, -4) + 2.5, -4);
  };

  const getCameraPosition = (target: Vector3) => {
    const pitch = getModePitch();
    const distance = getModeDistance();
    const horizontal = distance * Math.cos(pitch);
    return new Vector3(
      target.x + Math.sin(yaw) * horizontal,
      target.y + distance * Math.sin(pitch),
      target.z + Math.cos(yaw) * horizontal,
    );
  };

  const updateGrowthTarget = () => {
    const completedSteps = data.steps.filter((step) => step.completed_at !== null).length;
    const overcomeObstacles = data.obstacles.filter((obstacle) => obstacle.status === 'overcome').length;
    const completedActions = completedSteps + overcomeObstacles;
    targetTreeScale = baseTreeScale * (1 + 0.1 * (1 - Math.exp(-completedActions / 10)));
  };

  const applyMood = () => {
    const subdued =
      data.moodKey === 'tired' ||
      data.moodKey === 'anxious' ||
      data.moodKey === 'sad' ||
      data.moodKey === 'angry' ||
      data.moodKey === 'lonely';
    directionLight.intensity = subdued ? 2.65 : 3.2;
    ambientLight.intensity = subdued ? 1.45 : 1.25;
    renderer.toneMappingExposure = subdued ? 0.98 : 1.05;
  };

  function resize() {
    if (disposed) return;
    const ratio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.15 : 1.65);
    const nextWidth = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const nextHeight = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    renderer.setPixelRatio(ratio);
    renderer.setSize(nextWidth / ratio, nextHeight / ratio, false);
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    scheduleRender();
  }

  function renderFrame(timestamp = performance.now()) {
    frame = 0;
    if (disposed || !ready) return;
    if (!reducedMotion.matches && timestamp - lastFrameTime < 40) {
      frame = window.requestAnimationFrame(renderFrame);
      return;
    }
    lastFrameTime = timestamp;

    const nextLookTarget = getLookTarget();
    const nextCameraPosition = getCameraPosition(nextLookTarget);
    const blend = reducedMotion.matches ? 1 : 0.14;
    camera.position.lerp(nextCameraPosition, blend);
    lookAtTarget.lerp(nextLookTarget, blend);
    camera.lookAt(lookAtTarget);

    if (growthTree) {
      const scale = MathUtils.lerp(growthTree.scale.x, targetTreeScale, blend);
      growthTree.scale.setScalar(scale);
    }
    if (riverSurface && riverBasePositions && !reducedMotion.matches) {
      const positions = riverSurface.geometry.getAttribute('position') as BufferAttribute;
      const time = timestamp * 0.0017;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getZ(index);
        const baseY = riverBasePositions[index * 3 + 1];
        positions.setY(index, baseY + Math.sin(time + z * 0.52 + x * 0.35) * 0.022);
      }
      positions.needsUpdate = true;
      riverSurface.geometry.computeVertexNormals();
    }

    renderer.render(scene, camera);
    const cameraMoving =
      camera.position.distanceToSquared(nextCameraPosition) > 0.015 ||
      lookAtTarget.distanceToSquared(nextLookTarget) > 0.015;
    const treeMoving = growthTree && Math.abs(growthTree.scale.x - targetTreeScale) > 0.001;
    if (!reducedMotion.matches && (cameraMoving || treeMoving || riverSurface)) {
      frame = window.requestAnimationFrame(renderFrame);
    }
  }

  function scheduleRender() {
    if (disposed || !ready) return;
    if (reducedMotion.matches) {
      if (frame) window.cancelAnimationFrame(frame);
      renderFrame();
      return;
    }
    if (!frame) frame = window.requestAnimationFrame(renderFrame);
  }

  function refreshGoalMarkers() {
    contentGroup.clear();
    goalMarkers.clear();
    goalPositions.clear();
    goalTargets.length = 0;

    data.goals.forEach((goal, index) => {
      const location = getGoalPosition(index, data.goals.length);
      const point = new Vector3(location.x, heightAt(location.x, location.z), location.z);
      goalPositions.set(goal.id, point);

      const marker = new Mesh(markerGeometry, goal.id === selectedGoalId ? selectedMarkerMaterial : markerMaterial);
      marker.position.set(point.x, point.y + 0.22, point.z);
      marker.scale.set(0.82, 0.44, 0.82);
      marker.userData.goalId = goal.id;
      marker.castShadow = true;
      contentGroup.add(marker);
      goalTargets.push(marker);
      goalMarkers.set(goal.id, marker);

      const related = data.obstacles.filter((obstacle) => obstacle.goal_id === goal.id);
      related.forEach((obstacle, obstacleIndex) => {
        addObstacleMarker(obstacle, point, obstacleIndex);
      });
    });

    const unlinked = data.obstacles.filter((obstacle) => obstacle.goal_id === null);
    unlinked.forEach((obstacle, index) => {
      const point = new Vector3(-23 + (index % 4) * 2.2, 0, 15 + Math.floor(index / 4) * 2.2);
      point.y = heightAt(point.x, point.z);
      addObstacleMarker(obstacle, point, index);
    });

    addBridgeForSelectedGoal();
    scheduleRender();
  }

  function addObstacleMarker(obstacle: WorldObstacle, goalPoint: Vector3, index: number) {
    const angle = index * 2.4 + 0.8;
    const radius = 1.6 + (index % 2) * 0.5;
    const x = goalPoint.x + Math.cos(angle) * radius;
    const z = goalPoint.z + Math.sin(angle) * radius;
    if (obstacle.status === 'overcome') {
      const trophy = sharedAssets.children[0].clone(true);
      trophy.visible = true;
      trophy.position.set(x, heightAt(x, z) + 0.04, z);
      contentGroup.add(trophy);
      return;
    }
    const rock = rockTemplate?.clone(true);
    if (rock) {
      rock.position.set(x, heightAt(x, z), z);
      rock.rotation.y = angle;
      rock.scale.setScalar(0.45 + (index % 3) * 0.08);
      contentGroup.add(rock);
      return;
    }
    const stone = new Mesh(markerGeometry, obstacleMaterial);
    stone.position.set(x, heightAt(x, z) + 0.12, z);
    stone.scale.set(0.65, 0.4, 0.58);
    contentGroup.add(stone);
  }

  function addBridgeForSelectedGoal() {
    if (!selectedGoalId) return;
    const obstacle = data.obstacles.find(
      (item) => item.goal_id === selectedGoalId && item.status === 'open',
    );
    if (!obstacle) return;
    const completed = Math.min(
      5,
      data.steps.filter((step) => step.obstacle_id === obstacle.id && step.completed_at !== null).length,
    );
    const bridgeX = -11.2;
    const bridgeZ = 4;
    for (let index = 0; index < completed; index += 1) {
      const x = bridgeX + (index - (completed - 1) / 2) * 0.66;
      const plank = new Mesh(bridgePlankGeometry, bridgeMaterial);
      plank.position.set(x, heightAt(bridgeX, bridgeZ) + 0.48, bridgeZ);
      plank.castShadow = true;
      plank.receiveShadow = true;
      contentGroup.add(plank);
    }
  }

  function selectAt(clientX: number, clientY: number) {
    if (!ready || !goalTargets.length) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const selected = raycaster.intersectObjects(goalTargets, false)[0]?.object;
    const goalId = typeof selected?.userData.goalId === 'string' ? selected.userData.goalId : null;
    if (goalId) onSelectGoal(goalId);
    return goalId;
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    activePointers.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    canvas.setPointerCapture(event.pointerId);
    if (activePointers.size === 1) {
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      return;
    }
    if (activePointers.size === 2) {
      pointerStart = null;
      const [first, second] = Array.from(activePointers.values());
      pinchDistance = first.distanceTo(second);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const activePointer = activePointers.get(event.pointerId);
    if (!activePointer) return;
    activePointer.set(event.clientX, event.clientY);
    if (activePointers.size === 2) {
      const [first, second] = Array.from(activePointers.values());
      const nextDistance = first.distanceTo(second);
      if (pinchDistance && nextDistance > 0) {
        zoomFactor = MathUtils.clamp(zoomFactor * (pinchDistance / nextDistance), 0.5, 2.3);
      }
      pinchDistance = nextDistance;
      scheduleRender();
      return;
    }
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) pointerStart.moved = true;
    yaw -= dx * 0.0045;
    orbitOffset = MathUtils.clamp(orbitOffset + dy * 0.003, -0.42, 0.42);
    pointerStart.x = event.clientX;
    pointerStart.y = event.clientY;
    scheduleRender();
  };

  const onPointerUp = (event: PointerEvent) => {
    const wasActive = activePointers.delete(event.pointerId);
    if (!wasActive) return;
    if (pointerStart?.id === event.pointerId) {
      if (!pointerStart.moved) selectAt(event.clientX, event.clientY);
      pointerStart = null;
    }
    if (activePointers.size < 2) pinchDistance = null;
    if (activePointers.size === 1) {
      const [id, point] = Array.from(activePointers.entries())[0];
      pointerStart = { id, x: point.x, y: point.y, moved: true };
    }
  };

  const onPointerCancel = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    pointerStart = null;
    pinchDistance = null;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    zoomFactor = MathUtils.clamp(zoomFactor * Math.exp(event.deltaY * 0.001), 0.5, 2.3);
    scheduleRender();
  };

  const onMotionChange = () => scheduleRender();
  const onContextLost = (event: Event) => {
    event.preventDefault();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (!disposed) onUnavailable();
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('webglcontextlost', onContextLost);
  reducedMotion.addEventListener('change', onMotionChange);
  resizeObserver?.observe(canvas);
  resize();
  applyMood();

  const engine: WorldEngine = {
    update(nextData, nextCamera, nextGoalId) {
      const previousMode = cameraMode;
      const goalSelectionChanged = selectedGoalId !== nextGoalId;
      const markersChanged =
        data.goals !== nextData.goals ||
        data.obstacles !== nextData.obstacles ||
        data.steps !== nextData.steps;
      data = nextData;
      cameraMode = nextCamera;
      selectedGoalId = nextGoalId;
      if (previousMode !== nextCamera) zoomFactor = 1;
      applyMood();
      updateGrowthTarget();
      if (ready && (markersChanged || goalSelectionChanged)) refreshGoalMarkers();
      else if (ready) {
        const marker = selectedGoalId ? goalMarkers.get(selectedGoalId) : null;
        if (marker) marker.material = selectedMarkerMaterial;
        goalMarkers.forEach((item, id) => {
          if (id !== selectedGoalId) item.material = markerMaterial;
        });
      }
      scheduleRender();
    },
    selectAt,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.style.touchAction = previousTouchAction;
      reducedMotion.removeEventListener('change', onMotionChange);
      disposeSceneResources(scene);
      environmentTarget?.dispose();
      pmremGenerator?.dispose();
      environmentTexture?.dispose();
      markerGeometry.dispose();
      bridgePlankGeometry.dispose();
      markerMaterial.dispose();
      selectedMarkerMaterial.dispose();
      obstacleMaterial.dispose();
      brassMaterial.dispose();
      bridgeMaterial.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };

  void loadEnvironment();
  return engine;

  async function loadEnvironment() {
    try {
      const trackTexture = (request: Promise<Texture>) =>
        request.then((texture) => {
          pendingTextures.push(texture);
          return texture;
        });
      const trackModel = <T extends { scene: Object3D }>(request: Promise<T>) =>
        request.then((model) => {
          pendingModels.push(model.scene);
          return model;
        });
      const [
        hdr,
        grassColor,
        grassNormal,
        grassArm,
        pathColor,
        pathNormal,
        pathArm,
        tree,
        shrub,
        rocks,
      ] = await Promise.all([
        trackTexture(new RGBELoader().loadAsync(`${ASSET_ROOT}/autumn_forest_03_2k.hdr`)),
        trackTexture(textureLoader.loadAsync(`${ASSET_ROOT}/textures/grass_ground/diffuse_1k.jpg`)),
        trackTexture(textureLoader.loadAsync(`${ASSET_ROOT}/textures/grass_ground/nor_gl_1k.jpg`)),
        trackTexture(textureLoader.loadAsync(`${ASSET_ROOT}/textures/grass_ground/arm_1k.jpg`)),
        trackTexture(textureLoader.loadAsync(`${ASSET_ROOT}/textures/forrest_ground_01/diffuse_1k.jpg`)),
        trackTexture(textureLoader.loadAsync(`${ASSET_ROOT}/textures/forrest_ground_01/nor_gl_1k.jpg`)),
        trackTexture(textureLoader.loadAsync(`${ASSET_ROOT}/textures/forrest_ground_01/arm_1k.jpg`)),
        trackModel(loader.loadAsync(`${ASSET_ROOT}/models/pachira_aquatica_01/pachira_aquatica_01.gltf`)),
        trackModel(loader.loadAsync(`${ASSET_ROOT}/models/shrub_02/shrub_02.gltf`)),
        trackModel(loader.loadAsync(`${ASSET_ROOT}/models/rock_moss_set_01/rock_moss_set_01.gltf`)),
      ]).catch((error: unknown) => {
        disposeLoadedAssets(pendingModels, pendingTextures);
        throw error;
      });

      if (disposed) {
        disposeLoadedAssets(pendingModels, pendingTextures);
        return;
      }

      environmentTexture = hdr;
      environmentTexture.mapping = EquirectangularReflectionMapping;
      pmremGenerator = new PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      environmentTarget = pmremGenerator.fromEquirectangular(hdr);
      scene.background = hdr;
      scene.environment = environmentTarget.texture;

      configureTexture(grassColor, 36, 36, SRGBColorSpace);
      configureTexture(grassNormal, 36, 36, NoColorSpace);
      configureTexture(grassArm, 36, 36, NoColorSpace);
      configureTexture(pathColor, 2.5, 28, SRGBColorSpace);
      configureTexture(pathNormal, 2.5, 28, NoColorSpace);
      configureTexture(pathArm, 2.5, 28, NoColorSpace);

      const terrainMaterial = new MeshStandardMaterial({
        map: grassColor,
        normalMap: grassNormal,
        aoMap: grassArm,
        roughnessMap: grassArm,
        metalnessMap: grassArm,
        roughness: 0.94,
        metalness: 0.03,
      });
      const terrain = new Mesh(createTerrainGeometry(isMobile ? 112 : 176, 220), terrainMaterial);
      terrain.receiveShadow = true;
      terrain.frustumCulled = false;
      scene.add(terrain);

      const pathMaterial = new MeshStandardMaterial({
        map: pathColor,
        normalMap: pathNormal,
        aoMap: pathArm,
        roughnessMap: pathArm,
        metalnessMap: pathArm,
        roughness: 0.96,
        metalness: 0.01,
      });
      const path = new Mesh(createPathGeometry(), pathMaterial);
      path.position.y = 0.035;
      path.receiveShadow = true;
      scene.add(path);
      riverSurface = createRiver();
      riverBasePositions = new Float32Array(
        (riverSurface.geometry.getAttribute('position') as BufferAttribute).array,
      );
      scene.add(riverSurface);
      scene.add(createWaterfall());

      const treeRoot = tree.scene;
      treeRoot.updateMatrixWorld(true);
      rockTemplate = rocks.scene;
      growthTree = treeRoot.clone(true);
      growthTree.position.set(1, heightAt(1, -4), -4);
      growthTree.scale.setScalar(2.7);
      growthTree.traverse((object) => {
        if (object instanceof Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      scene.add(growthTree);

      const treePlacements = getForestPlacements(isMobile);
      scene.add(createInstancedAsset(treeRoot, treePlacements));
      scene.add(createInstancedAsset(shrub.scene, getShrubPlacements(isMobile)));
      scene.add(createInstancedAsset(rocks.scene, getRockPlacements(isMobile)));

      baseTreeScale = 2.7;
      updateGrowthTarget();
      growthTree.scale.setScalar(targetTreeScale);
      refreshGoalMarkers();
      ready = true;
      onReady();
      resize();
      scheduleRender();
    } catch (error) {
      if (disposed) return;
      console.error('Unable to load the local World of Growth environment assets.', error);
      onUnavailable();
    }
  }
}

function configureTexture(texture: Texture, repeatX: number, repeatY: number, colorSpace: ColorSpace) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
}

function createTerrainGeometry(segments: number, size: number) {
  const geometry = new PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, heightAt(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute('uv2', geometry.attributes.uv.clone());
  return geometry;
}

function createPathGeometry() {
  const points = [
    new Vector3(3.2, 0, 31),
    new Vector3(2.4, 0, 22),
    new Vector3(-1, 0, 12),
    new Vector3(1, 0, 4),
    new Vector3(3, 0, -4),
    new Vector3(9, 0, -12),
    new Vector3(14, 0, -22),
    new Vector3(12, 0, -36),
  ];
  const path = new CatmullRomCurve3(points, false, 'centripetal');
  const segments = 180;
  const halfWidth = 1.55;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = path.getPointAt(t);
    const tangent = path.getTangentAt(t);
    const normal = new Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(halfWidth);
    const leftX = point.x + normal.x;
    const leftZ = point.z + normal.z;
    const rightX = point.x - normal.x;
    const rightZ = point.z - normal.z;
    vertices.push(leftX, heightAt(leftX, leftZ) + 0.045, leftZ);
    vertices.push(rightX, heightAt(rightX, rightZ) + 0.045, rightZ);
    uvs.push(0, t * 32, 1, t * 32);
    if (index < segments) {
      const start = index * 2;
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRiver() {
  const segments = 180;
  const points = Array.from({ length: 10 }, (_, index) => {
    const z = 36 - index * 8;
    const x = -11.5 + Math.sin(index * 0.8) * 2.2;
    return new Vector3(x, heightAt(x, z), z);
  });
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(1.65);
    for (const sign of [-1, 1]) {
      const x = point.x + side.x * sign;
      const z = point.z + side.z * sign;
      vertices.push(x, heightAt(point.x, point.z) - 0.13, z);
      uvs.push(sign === -1 ? 0 : 1, t * 14);
    }
    if (index < segments) {
      const start = index * 2;
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new MeshPhysicalMaterial({
    color: '#76908a',
    roughness: 0.2,
    metalness: 0.12,
    clearcoat: 0.86,
    clearcoatRoughness: 0.18,
    side: DoubleSide,
  });
  const river = new Mesh(geometry, material);
  river.receiveShadow = true;
  return river;
}

function createWaterfall() {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const columns = 18;
  const rows = 12;
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = -13 + u * 2.8 + Math.sin(v * 6 + u * 5) * 0.08;
      const y = 0.75 - v * 1.35;
      const z = -11.6 + Math.sin(u * 7) * 0.15;
      vertices.push(x, y, z);
      uvs.push(u, v * 4);
      if (row < rows && column < columns) {
        const start = row * (columns + 1) + column;
        indices.push(start, start + columns + 1, start + 1, start + 1, start + columns + 1, start + columns + 2);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new MeshPhysicalMaterial({
    color: '#b5c5bf',
    roughness: 0.22,
    metalness: 0.08,
    transmission: 0.2,
    transparent: true,
    opacity: 0.78,
    side: DoubleSide,
  });
  return new Mesh(geometry, material);
}

function createInstancedAsset(root: Group, placements: Placement[]) {
  const group = new Group();
  root.updateMatrixWorld(true);
  const sourceMeshes: ThreeMesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) sourceMeshes.push(object);
  });
  const dummy = new Object3D();

  sourceMeshes.forEach((source) => {
    const instances = new InstancedMesh(source.geometry, source.material, placements.length);
    instances.castShadow = false;
    instances.receiveShadow = true;
    placements.forEach((placement, index) => {
      dummy.position.set(placement.x, heightAt(placement.x, placement.z), placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.setScalar(placement.scale);
      dummy.updateMatrix();
      dummy.matrix.multiply(source.matrixWorld);
      instances.setMatrixAt(index, dummy.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    group.add(instances);
  });
  return group;
}

function getForestPlacements(isMobile: boolean): Placement[] {
  const positions: ReadonlyArray<readonly [number, number, number]> = [
    [-31, -3, 1.65],
    [-30, -24, 1.35],
    [-22, -39, 1.5],
    [-10, -48, 1.22],
    [6, -55, 1.45],
    [20, -44, 1.58],
    [31, -28, 1.3],
    [34, -8, 1.45],
    [28, 13, 1.52],
    [-27, 17, 1.35],
    [-36, 5, 1.25],
    [15, 24, 1.2],
  ];
  return positions.slice(0, isMobile ? 7 : positions.length).map(([x, z, scale], index) => ({
    x,
    z,
    scale,
    rotation: index * 1.17,
  }));
}

function getShrubPlacements(isMobile: boolean): Placement[] {
  const placements: Placement[] = [];
  for (let row = -4; row <= 4; row += 1) {
    for (let column = -4; column <= 4; column += 1) {
      const x = column * 7 + (row % 2) * 2.3;
      const z = row * 8 - 3;
      if (Math.hypot(x - 1, z + 4) < 7 || Math.abs(x + 11) < 2.7) continue;
      if (Math.abs(x - (2 + (z * 0.1))) < 2.8) continue;
      placements.push({
        x,
        z,
        scale: 0.75 + ((row * row + column * column) % 4) * 0.16,
        rotation: (row * 17 + column * 9) * 0.19,
      });
    }
  }
  return placements.filter((_, index) => !isMobile || index % 2 === 0);
}

function getRockPlacements(isMobile: boolean): Placement[] {
  const positions: ReadonlyArray<readonly [number, number]> = [
    [-20, 7],
    [-17, -11],
    [-21, -28],
    [-4, -35],
    [19, -31],
    [24, -14],
    [22, 4],
    [18, 19],
    [-21, 21],
  ];
  return positions.slice(0, isMobile ? 5 : positions.length).map(([x, z], index) => ({
    x,
    z,
    scale: 0.65 + (index % 3) * 0.18,
    rotation: index * 0.82,
  }));
}

function getGoalPosition(index: number, count: number) {
  const waypoint = GOAL_WAYPOINTS[index % GOAL_WAYPOINTS.length];
  const cycle = Math.floor(index / GOAL_WAYPOINTS.length);
  const spread = count > GOAL_WAYPOINTS.length ? 1 + cycle * 0.8 : 1;
  const x = waypoint[0] * spread;
  const z = waypoint[1] * spread;
  return { x, y: heightAt(x, z), z };
}

function createTrophy(material: MeshStandardMaterial) {
  const trophy = new Group();
  const foot = new Mesh(new CylinderGeometry(0.2, 0.23, 0.11, 12), material);
  foot.position.y = 0.06;
  const stem = new Mesh(new CylinderGeometry(0.055, 0.07, 0.24, 10), material);
  stem.position.y = 0.23;
  const cup = new Mesh(new CylinderGeometry(0.12, 0.2, 0.27, 14, 1, true), material);
  cup.position.y = 0.48;
  const leftHandle = new Mesh(new TorusGeometry(0.13, 0.025, 6, 14, Math.PI), material);
  leftHandle.position.set(-0.15, 0.5, 0);
  leftHandle.rotation.z = Math.PI / 2;
  const rightHandle = leftHandle.clone();
  rightHandle.position.x = 0.15;
  rightHandle.rotation.z = -Math.PI / 2;
  trophy.add(foot, stem, cup, leftHandle, rightHandle);
  trophy.scale.setScalar(0.72);
  return trophy;
}

function heightAt(x: number, z: number) {
  const meadow =
    Math.sin(x * 0.037 + z * 0.021) * 0.34 +
    Math.sin(z * 0.071 - x * 0.031) * 0.2 +
    Math.cos(x * 0.052 + z * 0.043) * 0.16;
  const riverBasin = Math.exp(-((x + 11.5) * (x + 11.5)) / 18) * 0.75;
  const ridges = [
    [-42, -68, 13, 21],
    [-16, -75, 15, 25],
    [18, -68, 13, 22],
    [49, -74, 16, 25],
  ].reduce((sum, [peakX, peakZ, height, radius]) => {
    const distance = ((x - peakX) ** 2 + (z - peakZ) ** 2) / (radius * radius);
    return sum + height * Math.exp(-distance);
  }, 0);
  return meadow - riverBasin + ridges;
}

function disposeSceneResources(scene: Scene) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  scene.traverse((object) => {
    if (object instanceof Mesh || object instanceof InstancedMesh) geometries.add(object.geometry);
    const material = (object as Mesh).material;
    if (!material) return;
    for (const item of Array.isArray(material) ? material : [material]) {
      materials.add(item);
      Object.values(item).forEach((value) => {
        if (value instanceof Texture) textures.add(value);
      });
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function disposeLoadedAssets(roots: Object3D[], textures: Texture[]) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const foundTextures = new Set<Texture>(textures);
  roots.forEach((root) => {
    root.traverse((object) => {
      if (object instanceof Mesh) geometries.add(object.geometry);
      if (!(object instanceof Mesh) || !object.material) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof Texture) foundTextures.add(value);
        });
      }
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  foundTextures.forEach((texture) => texture.dispose());
}
