// Zombie Arena - Three.js FPS Game Prototype
// A simple browser-based zombie shooter with Three.js

// Global variables
let currentGunState = 0;
let buttonClicked = false;
let camera, scene, renderer;
let player, controls;
let zombies = [];
let rangedEnemies = []; // Array for ranged enemies
let bullets = [];
let projectiles = []; // Array for enemy projectiles
let floor, walls = [];
let raycaster;
let mouse = new THREE.Vector2();
let clock = new THREE.Clock();
let moveState;
let minimapCanvas, minimapCtx; // Minimap elements
let mapLayout; // Global map layout
let currentShootingElements = null;
let gunImages = [];
let gunImagesLoaded = false;
let backgroundMusic; // Background music audio element
let laserSound; // Laser sound effect
let hitSound; // Hit sound effect
let zombieSounds = []; // Array to store zombie sounds
let lastZombieSound = 0; // Track when the last zombie sound was played
let zombieSoundCooldown = 5000; // Minimum time between zombie sounds (5 seconds)
let dashSound; // Dash sound effect
let updraftSound; // Updraft sound effect
let settingsMenuVisible = false; // Track if settings menu is visible
let soundEffectsVolume = 0.5; // Default sound effects volume (50%)
let musicVolume = 0.1; // Default music volume (10%)
let showEscapeHint = true; // Track if we should show the escape hint
let escapeHintTimeout = null; // Timeout for the escape hint
let mouseSensitivity = 0.002; // Default mouse sensitivity
let crosshairStyle = 'default'; // Default crosshair style
let allMuted = false; // Track if all sounds are muted

// Game state
let gameState = {
  health: 100,
  score: 0,
  wave: 1,
  zombiesKilled: 0,
  zombiesInWave: 5, // Initial zombies in wave 1
  gameOver: false,
  lastShot: 0,
  shootCooldown: 130,
  moveSpeed: 0.2,
  jumpForce: 0.25,
  gravity: 0.02,
  isJumping: false,
  verticalVelocity: 0,
  isShooting: false,
  // Ability cooldowns and states
  abilities: {
    dash: {
      cooldown: 6000,
      lastUsed: 0,
      distance: 10,
      duration: 200
    },
    updraft: {
      cooldown: 8000,
      lastUsed: 0,
      force: 0.35
    }
  }
};

// DOM elements for UI
let healthDisplay, scoreDisplay, waveDisplay, gameOverDisplay, dashCooldownDisplay, updraftCooldownDisplay, gunImage, endScreenDisplay;

// Add this function to preload gun images
function preloadGunImages() {
  const imagePaths = [
    'textures/gun_shoot.png',
    'textures/gun_shoot2.png',
    'textures/gun_shoot3.png'
  ];
  
  let loadedCount = 0;
  
  imagePaths.forEach((path, index) => {
    const img = new Image();
    img.onload = () => {
      loadedCount++;
      if (loadedCount === imagePaths.length) {
        gunImagesLoaded = true;
        console.log('All gun images preloaded');
      }
    };
    img.src = path;
    gunImages[index] = img;
  });
}

// Initialize the game
function init() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a); // Very dark gray (almost black)

  // Setup background music
  setupBackgroundMusic();
  
  // Setup laser sound
  setupLaserSound();
  
  // Setup hit sound
  setupHitSound();
  
  // Setup zombie sounds
  setupZombieSounds();
  
  // Setup dash sound
  setupDashSound();
  
  // Setup updraft sound
  setupUpdraftSound();

  scene.fog = new THREE.Fog(0x88aacc, 0, 100);

  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = 1.6; // Player eye height
  
  // Set initial player position at attacker spawn point
  const spawnZ = Math.random() < 0.5 ? 45 : -45;
  camera.position.set(0, 1.6, spawnZ);
  camera.lookAt(0, 1.6, 0);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Add lighting
  setupLighting();
  
  // Create the environment
  createEnvironment();
  
  // Create the player controller
  setupPlayer();
  
  // Initialize raycaster for shooting
  raycaster = new THREE.Raycaster();
  
  // Create UI elements
  createUI();
  
  // Event listeners
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('mousedown', onMouseClick);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  
  // Add start button event listener
  document.getElementById('startButton').addEventListener('click', startGame);
  
  // Make sure start screen is visible
  document.getElementById('startScreen').style.display = 'flex';
  
  // Preload gun images
  preloadGunImages();
  
  // Start the game loop
  animate();
}

// Setup background music
function setupBackgroundMusic() {
  try {
    backgroundMusic = new Audio('sounds/education.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = musicVolume; // Use the global music volume
    
    // Add event listener to start music on first user interaction
    document.addEventListener('click', function startMusic() {
      try {
        backgroundMusic.play().catch(error => {
          console.log("Audio playback failed:", error);
        });
      } catch (error) {
        console.log("Error playing background music:", error);
      }
      // Remove the event listener after first click
      document.removeEventListener('click', startMusic);
    }, { once: true });
  } catch (error) {
    console.log("Error setting up background music:", error);
  }
}

// Set up scene lighting
function setupLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
  scene.add(ambientLight);
  
  // Directional light (sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
}

// Create the environment (floor and walls)
function createEnvironment() {
  // Create floor
  const textureLoader = new THREE.TextureLoader();

textureLoader.load('textures/ground.jpg', function (texture) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10); // Adjust to how tiled you want it
  texture.anisotropy = 16; // Improve texture clarity at angles

  // Optional: use this for soft blending edges (via alphaMap or custom shader)
  // texture.encoding = THREE.sRGBEncoding; // Uncomment if colors look off

  const floorGeometry = new THREE.PlaneGeometry(100, 100);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.8,
    transparent: true,
    side: THREE.DoubleSide
  });

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
});


  
  // Wall material
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 });
  
  // Create map structures using predefined layout
  createMapStructures();
  
  function createMapStructures() {
    // Helper function to create a wall
    function createWall(x, z, width, depth, height = 4) {
      const wallGeometry = new THREE.BoxGeometry(width, height, depth);
      const textureLoader = new THREE.TextureLoader();
    
      // Array of 6 texture paths (make sure these files exist in your textures folder)
      const texturePaths = [
        'textures/wall.jpg',
        'textures/wall2.jpg',
        'textures/wall3.jpg',
        'textures/wall4.jpg',
        'textures/wall5.jpg',
        'textures/wall6.jpg',
      ];
    
      // Load a random texture for each of the 6 faces
      const materials = Array(6).fill().map(() => {
        const texture = textureLoader.load(texturePaths[Math.floor(Math.random() * texturePaths.length)]);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      
        // Adjust the repeat values based on wall size or just a standard tiling
        texture.repeat.set(2, 2); // Repeat 2x2 for each face (you can tweak this)
      
        return new THREE.MeshStandardMaterial({ map: texture });
      });
    
      const wall = new THREE.Mesh(wallGeometry, materials);
      wall.position.set(x, height / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      walls.push(wall);
      scene.add(wall);
      return wall;
    }
    

    // Define map layout sections
    mapLayout = {
      // Outer perimeter walls - WHITE
      outerWalls: [
        { x: 0, z: 50, w: 100, d: 2 },   // North wall
        { x: 0, z: -50, w: 100, d: 2 },  // South wall
        { x: 50, z: 0, w: 2, d: 100 },   // East wall
        { x: -50, z: 0, w: 2, d: 100 }   // West wall
      ],
      
      // A Site area - RED
      aSite: [
        { x: 40, z: 37, w: 20, d: 25 },  // A Site structure
        { x: 20, z: 45, w: 20, d: 10 },
        { x: 37, z: 17, w: 4, d: 2 },
        { x: 43, z: 17, w: 5, d: 2 },

        { x: 20, z: -46, w: 20, d: 6 },
        { x: 40, z: -43, w: 20, d: 14 },
        { x: 45, z: -20, w: 8, d: 10 },        // Uncomment these to add them one by one:
        { x: 30, z: -6, w: 20, d: 4 },
        { x: 35, z: -12, w: 4, d: 15 }  
      ],
      
      // B Site area - BLUE
      bSite: [
         { x: -40, z: 37, w: 20, d: 25 }, // B Site structure
         { x: -20, z: 45, w: 20, d: 10 },
         { x: -40, z: -38, w: 20, d: 23 },
         { x: -25, z: -39, w: 10, d: 20 },
         { x: -15, z: -44, w: 10, d: 10 },
        { x: -47, z: 0, w: 5, d: 20 },
        { x: -47, z: -22, w: 5, d: 12 },
        { x: -35, z: -8, w: 7, d: 3 },
        // Uncomment these to add them one by one:
       

        // { x: -25, z: -30, w: 10, d: 10 }, // B LOBBY
        // { x: -15, z: 0, w: 10, d: 10 },   // B MARKET
        // { x: -30, z: 30, w: 10, d: 10 }   // B BOBA
      ],
      
      // Mid area - GREEN
      mid: [
        { x: 0, z: 30, w: 50, d: 10 },     // MID TILES
        { x: 4, z: 20, w: 30, d: 10 },
        { x: -19, z: 10, w: 6, d: 15 },
        { x: 16, z: 17, w: 15, d: 10 },
        { x: 20, z: 0, w: 3, d: 16 },
        { x: -10, z: 0, w: 6, d: 15 },

        { x: 20, z: -20, w: 10, d: 15 },
        { x: 15, z: -30, w: 40, d: 5 },
        { x: -20, z: -20, w: 30, d: 5 },
        { x: -20, z: -10, w: 3, d: 16 },

        { x: 5, z: 0, w: 7, d: 10 },
        { x: -25, z: 18, w: 18, d: 4 }, // B MAIN
        { x: -45, z: 18, w: 10, d: 4 },
        { x: -15, z: 5, w: 10, d: 5 },
        // Uncomment these to add them one by one:
        // { x: 0, z: 20, w: 10, d: 10 },    // MID TOP
        // { x: 0, z: 10, w: 10, d: 10 },    // MID COURTYARD
        // { x: 0, z: -10, w: 10, d: 10 },   // MID BOTTOM
        // { x: 0, z: 5, w: 10, d: 2 },      // Mid barrier 1
        // { x: -5, z: 15, w: 2, d: 10 },    // Mid barrier 2
        // { x: 5, z: -5, w: 2, d: 10 }      // Mid barrier 3
      ],
      
      // Connectors - YELLOW
      connectors: [
        // Uncomment these to add them one by one:
        // { x: 35, z: 7.5, w: 5, d: 15 },   // A MAIN to A site
        // { x: -35, z: 0, w: 5, d: 15 },    // B MAIN to B site
        // { x: 7.5, z: 7.5, w: 15, d: 5 },  // MID TILES to A LINK
        // { x: -7.5, z: 0, w: 15, d: 5 },   // MID TILES to B MARKET
        // { x: 35, z: -7.5, w: 5, d: 15 },  // A LOBBY to A MAIN
        // { x: -30, z: -22.5, w: 5, d: 15 } // B LOBBY to B MAIN
      ],
      
      // Spawn points
      spawnPoints: [
        { x: 0, z: 45, type: 'defender', color: 'GREEN' },  // Defender spawn (top)
        { x: 0, z: -45, type: 'attacker', color: 'RED' }   // Attacker spawn (bottom)
      ],
    };
    
    // Create walls from layout
    Object.values(mapLayout).forEach(section => {
      section.forEach(item => {
        if ('w' in item) { // It's a wall
          createWall(item.x, item.z, item.w, item.d, item.h || 4);
        }
      });
    });
    
    // // Function to create colored walls
    // function createColoredWall(x, z, width, depth, height, color) {
    //   const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    //   const wallMaterial = new THREE.MeshStandardMaterial({ color: color });
    //   const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    //   wall.position.set(x, height/2, z);
    //   wall.castShadow = true;
    //   wall.receiveShadow = true;
    //   walls.push(wall);
    //   scene.add(wall);
    //   return wall;
    // }
    
    // // Create colored map sections
    // function createColoredMap() {
    //   // Outer walls - Gray
    //   mapLayout.outerWalls.forEach(wall => {
    //     createColoredWall(wall.x, wall.z, wall.w, wall.d, wall.h || 4, 0x888888);
    //   });
      
    //   // A Site - Red
    //   mapLayout.aSite.forEach(wall => {
    //     createColoredWall(wall.x, wall.z, wall.w, wall.d, wall.h || 4, 0xff6666);
    //   });
      
    //   // B Site - Blue
    //   mapLayout.bSite.forEach(wall => {
    //     createColoredWall(wall.x, wall.z, wall.w, wall.d, wall.h || 4, 0x6666ff);
    //   });
      
    //   // Mid area - Green
    //   mapLayout.mid.forEach(wall => {
    //     createColoredWall(wall.x, wall.z, wall.w, wall.d, wall.h || 4, 0x66ff66);
    //   });
      
    //   // Connectors - Yellow
    //   mapLayout.connectors.forEach(wall => {
    //     createColoredWall(wall.x, wall.z, wall.w, wall.d, wall.h || 4, 0xffff66);
    //   });
    // }
    
    // // Create the colored map
    // createColoredMap();
    
    // Add site markers
    function createSiteMarker(x, z, letter) {
      const markerGeometry = new THREE.PlaneGeometry(5, 5);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: letter === 'A' ? 0xff0000 : 0x0000ff,
        transparent: true,
        opacity: 0.3
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, 0.1, z);
      scene.add(marker);
    }
    
    // Add site markers at A and B sites
    createSiteMarker(30, 0, 'A');
    createSiteMarker(-30, 0, 'B');
    
    // Add spawn markers
    function createSpawnMarker(x, z, type) {
      const markerGeometry = new THREE.PlaneGeometry(8, 8);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: type === 'defender' ? 0x00ff00 : 0xff0000,
        transparent: true,
        opacity: 1
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, 0.1, z);
      scene.add(marker);
    }
    
    // Add spawn markers
    createSpawnMarker(0, 45, 'defender');
    createSpawnMarker(0, -45, 'attacker');
    
    // Add colored site labels
    function createSiteLabel(x, z, letter, color) {
      // Create a larger, more visible marker
      const markerGeometry = new THREE.PlaneGeometry(10, 10);
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 1
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(x, 0.1, z);
      scene.add(marker);
      
      // Add text label
      const textGeometry = new THREE.PlaneGeometry(5, 5);
      const textMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 1
      });
      const text = new THREE.Mesh(textGeometry, textMaterial);
      text.rotation.x = -Math.PI / 2;
      text.position.set(x, 0.2, z);
      scene.add(text);
    }
    
    // Create colored site labels
    createSiteLabel(30, 0, 'A', 0xff0000); // Red for A site
    createSiteLabel(-30, 0, 'B', 0x0000ff);  // Blue for B site
  }
}

// Set up player and controls
function setupPlayer() {
  // Initialize PointerLockControls
  controls = new THREE.PointerLockControls(camera, document.body);
  controls.mouseSensitivity = mouseSensitivity; // Set initial mouse sensitivity
  
  // Movement state
  moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
  };
  
  // Add key controls for movement
  const onKeyDown = function(event) {
    if (gameState.gameOver) return;
    
    switch(event.code) {
      case 'KeyW':
        moveState.forward = true;
        break;
      case 'KeyS':
        moveState.backward = true;
        break;
      case 'KeyA':
        moveState.left = true;
        break;
      case 'KeyD':
        moveState.right = true;
        break;
      case 'Space':
        if (!gameState.isJumping) {
          gameState.verticalVelocity = gameState.jumpForce;
          gameState.isJumping = true;
        }
        break;
      case 'KeyE':
        useDash();
        break;
      case 'KeyQ':
        useUpdraft();
        break;
      case 'Tab':
        // Prevent default behavior (focus switching)
        event.preventDefault();
        break;
      case 'Escape':
        // Prevent default behavior
        event.preventDefault();
        toggleSettingsMenu();
        break;
    }
  };
  
  const onKeyUp = function(event) {
    switch(event.code) {
      case 'KeyW':
        moveState.forward = false;
        break;
      case 'KeyS':
        moveState.backward = false;
        break;
      case 'KeyA':
        moveState.left = false;
        break;
      case 'KeyD':
        moveState.right = false;
        break;
    }
  };
  
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  
  // Click event to start pointer lock - ONLY when the game is already started
  document.addEventListener('click', function() {
    if (!controls.isLocked && buttonClicked && !settingsMenuVisible) {
      controls.lock();
    }
  });
}

// Update movement based on current state
function updateMovement(moveState) {
  // Calculate movement direction
  let moveX = 0;
  let moveZ = 0;
  
  if (moveState.forward) moveZ -= 1;
  if (moveState.backward) moveZ += 1;
  if (moveState.left) moveX -= 1;
  if (moveState.right) moveX += 1;
  
  // Normalize diagonal movement
  if (moveX !== 0 && moveZ !== 0) {
    moveX *= 0.7071; // 1/√2
    moveZ *= 0.7071;
  }
  
  // Calculate potential new position
  const currentPos = camera.position.clone();
  const moveAmount = gameState.moveSpeed;
  
  // Apply movement with constant speed
  controls.moveRight(moveX * moveAmount);
  controls.moveForward(-moveZ * moveAmount);
  
  // Check if new position is outside the map boundaries
  if (Math.abs(camera.position.x) > 50 || Math.abs(camera.position.z) > 50) {
    // Reset to previous position
    camera.position.copy(currentPos);
  }
  
  // Check if new position is inside a wall
  if (!isPositionOutsideWalls(camera.position)) {
    // Reset to previous position
    camera.position.copy(currentPos);
  }
  
  // Apply jumping physics
  if (gameState.isJumping) {
    // Apply gravity
    gameState.verticalVelocity -= gameState.gravity;
    
    // Update vertical position
    camera.position.y += gameState.verticalVelocity;
    
    // Check if landed
    if (camera.position.y <= 1.6) { // Player eye height
      camera.position.y = 1.6;
      gameState.isJumping = false;
      gameState.verticalVelocity = 0;
    }
  }
  
  // Check for collisions with walls and obstacles
  checkCollisions();
  
  // Additional safety check to prevent falling through the map
  if (camera.position.y < 1.6) {
    camera.position.y = 1.6;
    gameState.verticalVelocity = 0;
    gameState.isJumping = false;
  }
}

// Check for collisions with walls and obstacles
function checkCollisions() {
  // Create a bounding box for the player
  const playerBB = new THREE.Box3().setFromCenterAndSize(
    camera.position,
    new THREE.Vector3(1, 3.2, 1)
  );
  
  // Check floor collision (prevent falling through the map)
  if (camera.position.y < 1.6) { // Player eye height
    camera.position.y = 1.6;
    gameState.verticalVelocity = 0;
    gameState.isJumping = false;
  }
  
  // Store previous position for collision detection
  const previousPosition = camera.position.clone();
  
  // Check collisions with all walls and obstacles
  for (const wall of walls) {
    const wallBB = new THREE.Box3().setFromObject(wall);
    
    if (playerBB.intersectsBox(wallBB)) {
      // Calculate collision response
      const overlap = new THREE.Vector3();
      
      // Calculate overlap in each axis
      overlap.x = Math.min(
        playerBB.max.x - wallBB.min.x,
        wallBB.max.x - playerBB.min.x
      );
      overlap.y = Math.min(
        playerBB.max.y - wallBB.min.y,
        wallBB.max.y - playerBB.min.y
      );
      overlap.z = Math.min(
        playerBB.max.z - wallBB.min.z,
        wallBB.max.z - playerBB.min.z
      );
      
      // Find the axis with the smallest overlap
      let minOverlap = Math.min(overlap.x, overlap.y, overlap.z);
      
      // Move the player out of the collision
      if (minOverlap === overlap.x) {
        // Collision on X axis
        if (camera.position.x < wall.position.x) {
          camera.position.x -= overlap.x + 0.1; // Add a small buffer
        } else {
          camera.position.x += overlap.x + 0.1; // Add a small buffer
        }
      } else if (minOverlap === overlap.y) {
        // Collision on Y axis
        if (camera.position.y < wall.position.y) {
          camera.position.y -= overlap.y + 0.1; // Add a small buffer
        } else {
          camera.position.y += overlap.y + 0.1; // Add a small buffer
        }
      } else {
        // Collision on Z axis
        if (camera.position.z < wall.position.z) {
          camera.position.z -= overlap.z + 0.1; // Add a small buffer
        } else {
          camera.position.z += overlap.z + 0.1; // Add a small buffer
        }
      }
      
      // Apply a stronger bounce effect to prevent sticking
      const bounceDirection = new THREE.Vector3()
        .subVectors(camera.position, wall.position)
        .normalize();
      
      // Apply a stronger bounce (0.3 units instead of 0.1)
      camera.position.add(bounceDirection.multiplyScalar(0.3));
      
      // Dampen vertical velocity when hitting a wall
      if (gameState.verticalVelocity !== 0) {
        gameState.verticalVelocity *= 0.5;
      }
    }
  }
  
  // If we're still colliding after the bounce, try to move back to the previous position
  // This prevents getting stuck in walls when moving very fast
  for (const wall of walls) {
    const newPlayerBB = new THREE.Box3().setFromCenterAndSize(
      camera.position,
      new THREE.Vector3(1, 3.2, 1)
    );
    const wallBB = new THREE.Box3().setFromObject(wall);
    
    if (newPlayerBB.intersectsBox(wallBB)) {
      // Move back to the previous position
      camera.position.copy(previousPosition);
      break;
    }
  }
}

// Create UI elements
function createUI() {
  // Create health display
  healthDisplay = document.createElement('div');
  healthDisplay.style.position = 'absolute';
  healthDisplay.style.top = '20px';
  healthDisplay.style.left = '20px';
  healthDisplay.style.color = '#00ff00';
  healthDisplay.style.fontSize = '28px';
  healthDisplay.style.fontFamily = '"Orbitron", sans-serif';
  healthDisplay.style.textShadow = '0px 0px 10px rgba(0, 255, 0, 0.8), 0px 0px 20px rgba(0, 255, 0, 0.6)';
  document.body.appendChild(healthDisplay);
  
  // Create health bar container
  const healthBarContainer = document.createElement('div');
  healthBarContainer.style.position = 'absolute';
  healthBarContainer.style.top = '60px';
  healthBarContainer.style.left = '20px';
  healthBarContainer.style.width = '220px';
  healthBarContainer.style.height = '25px';
  healthBarContainer.style.background = 'linear-gradient(45deg, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9))';
  healthBarContainer.style.border = '2px solid #00ff00';
  healthBarContainer.style.borderRadius = '12px';
  document.body.appendChild(healthBarContainer);
  
  // Create health bar
  const healthBar = document.createElement('div');
  healthBar.id = 'healthBar';
  healthBar.style.width = '100%';
  healthBar.style.height = '100%';
  healthBar.style.backgroundColor = '#00ff00';
  healthBar.style.borderRadius = '10px';
  healthBar.style.transition = 'width 0.3s, background-color 0.3s';
  healthBarContainer.appendChild(healthBar);
  
  // Create score display
  scoreDisplay = document.createElement('div');
  scoreDisplay.style.position = 'absolute';
  scoreDisplay.style.top = '20px';
  scoreDisplay.style.right = '20px';
  scoreDisplay.style.color = '#00ff00';
  scoreDisplay.style.fontSize = '28px';
  scoreDisplay.style.fontFamily = '"Orbitron", sans-serif';
  scoreDisplay.style.textShadow = '0px 0px 10px rgba(0, 255, 0, 0.8), 0px 0px 20px rgba(0, 255, 0, 0.6)';
  document.body.appendChild(scoreDisplay);
  
  // Create wave display
  waveDisplay = document.createElement('div');
  waveDisplay.style.position = 'absolute';
  waveDisplay.style.top = '20px';
  waveDisplay.style.left = '50%';
  waveDisplay.style.transform = 'translateX(-50%)';
  waveDisplay.style.color = '#00aaff';
  waveDisplay.style.fontSize = '28px';
  waveDisplay.style.fontFamily = '"Orbitron", sans-serif';
  waveDisplay.style.textShadow = '0px 0px 10px rgba(0, 170, 255, 0.8), 0px 0px 20px rgba(0, 170, 255, 0.6)';
  document.body.appendChild(waveDisplay);
  
  // Create wave progress bar container
  const waveProgressContainer = document.createElement('div');
  waveProgressContainer.style.position = 'absolute';
  waveProgressContainer.style.top = '60px';
  waveProgressContainer.style.left = '50%';
  waveProgressContainer.style.transform = 'translateX(-50%)';
  waveProgressContainer.style.width = '300px';
  waveProgressContainer.style.height = '20px';
  waveProgressContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  waveProgressContainer.style.border = '2px solid #00aaff';
  waveProgressContainer.style.borderRadius = '12px';
  document.body.appendChild(waveProgressContainer);
  
  // Create wave progress bar
  const waveProgressBar = document.createElement('div');
  waveProgressBar.id = 'waveProgressBar';
  waveProgressBar.style.width = '0%';
  waveProgressBar.style.height = '100%';
  waveProgressBar.style.backgroundColor = '#00aaff';
  waveProgressBar.style.borderRadius = '10px';
  waveProgressBar.style.transition = 'width 0.3s';
  waveProgressContainer.appendChild(waveProgressBar);
  
  // Create game over display
  gameOverDisplay = document.createElement('div');
  gameOverDisplay.style.position = 'absolute';
  gameOverDisplay.style.top = '50%';
  gameOverDisplay.style.left = '50%';
  gameOverDisplay.style.transform = 'translate(-50%, -50%)';
  gameOverDisplay.style.color = '#ff3333';
  gameOverDisplay.style.fontSize = '60px';
  gameOverDisplay.style.fontFamily = '"Orbitron", sans-serif';
  gameOverDisplay.style.textShadow = '0px 0px 10px rgba(255, 0, 0, 0.8), 0px 0px 20px rgba(255, 0, 0, 0.6)';
  gameOverDisplay.style.display = 'none';
  document.body.appendChild(gameOverDisplay);
  
  // Create end screen display
  endScreenDisplay = document.createElement('div');
  endScreenDisplay.style.position = 'absolute';
  endScreenDisplay.style.top = '50%';
  endScreenDisplay.style.left = '50%';
  endScreenDisplay.style.transform = 'translate(-50%, -50%)';
  endScreenDisplay.style.color = '#ffffff';
  endScreenDisplay.style.fontSize = '24px';
  endScreenDisplay.style.fontFamily = '"Orbitron", sans-serif';
  endScreenDisplay.style.textAlign = 'center';
  endScreenDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  endScreenDisplay.style.padding = '20px';
  endScreenDisplay.style.borderRadius = '10px';
  endScreenDisplay.style.display = 'none';
  document.body.appendChild(endScreenDisplay);
  
  // Create crosshair
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  crosshair.style.position = 'absolute';
  crosshair.style.top = '50%';
  crosshair.style.left = '50%';
  crosshair.style.transform = 'translate(-50%, -50%)';
  crosshair.style.pointerEvents = 'none';
  crosshair.style.zIndex = '1000';
  
  // Default crosshair style
  crosshair.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.8); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
    <div style="width: 20px; height: 20px; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
  `;
  
  document.body.appendChild(crosshair);
  
  // Create minimap
  createMinimap();

  // Create cooldown indicators
  dashCooldownDisplay = document.createElement('div');
  dashCooldownDisplay.id = 'dashCooldown';
  dashCooldownDisplay.className = 'cooldown-indicator';
  dashCooldownDisplay.innerHTML = 'E';
  document.body.appendChild(dashCooldownDisplay);

  updraftCooldownDisplay = document.createElement('div');
  updraftCooldownDisplay.id = 'updraftCooldown';
  updraftCooldownDisplay.className = 'cooldown-indicator';
  updraftCooldownDisplay.innerHTML = 'Q';
  document.body.appendChild(updraftCooldownDisplay);
  
  // Create gun image
  const gunImages = [
    'textures/gun.png',   // Idle state
    'textures/gun_shoot.png', // Shooting state
    'textures/gun_shoot2.png', //  state
    'textures/gun_shoot3.png' //  state
  ];

  const gunImage = document.createElement('img');
  gunImage.src = gunImages[0];
  gunImage.style.position = 'absolute';
  gunImage.style.bottom = '-22px';
  gunImage.style.right = '0';
  gunImage.style.width = '40vw';
  gunImage.style.pointerEvents = 'none';
  gunImage.style.userSelect = 'none';
  gunImage.style.zIndex = '999';
  document.body.appendChild(gunImage);
  
  // Create settings menu
  createSettingsMenu();
}

// Create minimap
function createMinimap() {
  // Create minimap container
  const minimapContainer = document.createElement('div');
  minimapContainer.style.position = 'absolute';
  minimapContainer.style.top = '100px';
  minimapContainer.style.left = '0px';
  minimapContainer.style.width = '200px';
  minimapContainer.style.height = '200px';
  minimapContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  minimapContainer.style.border = '2px solid white';
  minimapContainer.style.borderRadius = '5px';
  document.body.appendChild(minimapContainer);
  
  // Create minimap canvas
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = 200;
  minimapCanvas.height = 200;
  minimapContainer.appendChild(minimapCanvas);
  
  // Get minimap context
  minimapCtx = minimapCanvas.getContext('2d');
  
  // Add minimap title
  const minimapTitle = document.createElement('div');
  minimapTitle.style.top = '5px'; // Vertically center the text
minimapTitle.style.left = '50%'; // Horizontally center the text
  minimapTitle.style.position = 'absolute';
  minimapTitle.style.color = 'white';
  minimapTitle.style.fontSize = '12px';
  minimapTitle.style.fontFamily = 'Arial, sans-serif';
  minimapTitle.innerHTML = 'MINIMAP';
  minimapContainer.appendChild(minimapTitle);
}

// Update minimap
function updateMinimap() {
  // Clear minimap
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Set background
  minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Draw map boundaries (100x100 units)
  minimapCtx.strokeStyle = 'white';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Scale factor to convert game coordinates to minimap pixels
  const scale = 1.5;
  const offsetX = 50 * scale;
  const offsetZ = 50 * scale;
  
  // Helper function to convert game coordinates to minimap coordinates
  const toMinimapX = (x) => (x + offsetX) * scale;
  const toMinimapZ = (z) => (z + offsetZ) * scale;
  
  // Draw outer walls
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // WHITE - Outer walls
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  
  // Draw outer perimeter walls
  minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // WHITE - Outer perimeter walls
  mapLayout.outerWalls.forEach(wall => {
    minimapCtx.fillRect(
      toMinimapX(wall.x - wall.w/2),
      toMinimapZ(wall.z - wall.d/2),
      wall.w * scale,
      wall.d * scale
    );
  });
  
  // Draw A Site structures
  minimapCtx.fillStyle = 'rgba(255, 102, 102, 0.7)'; // RED - A Site structures
  mapLayout.aSite.forEach(wall => {
    minimapCtx.fillRect(
      toMinimapX(wall.x - wall.w/2),
      toMinimapZ(wall.z - wall.d/2),
      wall.w * scale,
      wall.d * scale
    );
  });
  
  // Draw B Site structures
  minimapCtx.fillStyle = 'rgba(102, 102, 255, 0.7)'; // BLUE - B Site structures
  mapLayout.bSite.forEach(wall => {
    minimapCtx.fillRect(
      toMinimapX(wall.x - wall.w/2),
      toMinimapZ(wall.z - wall.d/2),
      wall.w * scale,
      wall.d * scale
    );
  });
  
  // Draw Mid area structures
  minimapCtx.fillStyle = 'rgba(102, 255, 102, 0.7)'; // GREEN - Mid area structures
  mapLayout.mid.forEach(wall => {
    minimapCtx.fillRect(
      toMinimapX(wall.x - wall.w/2),
      toMinimapZ(wall.z - wall.d/2),
      wall.w * scale,
      wall.d * scale
    );
  });
  
  // Draw connectors
  minimapCtx.fillStyle = 'rgba(255, 255, 102, 0.7)'; // YELLOW - Connectors
  mapLayout.connectors.forEach(wall => {
    minimapCtx.fillRect(
      toMinimapX(wall.x - wall.w/2),
      toMinimapZ(wall.z - wall.d/2),
      wall.w * scale,
      wall.d * scale
    );
  });
  
  // Draw spawn points
  mapLayout.spawnPoints.forEach(spawn => {
    // Add golden "S" label
    minimapCtx.fillStyle = 'gold';
    minimapCtx.font = 'bold 12px Arial';
    minimapCtx.textAlign = 'center';
    minimapCtx.textBaseline = 'middle';
    minimapCtx.fillText('S', toMinimapX(spawn.x), toMinimapZ(spawn.z));
  });
  
  // Draw player position (white dot)
  minimapCtx.fillStyle = 'white'; // WHITE - Player position
  minimapCtx.beginPath();
  minimapCtx.arc(
    toMinimapX(camera.position.x),
    toMinimapZ(camera.position.z),
    3,
    0,
    Math.PI * 2
  );
  minimapCtx.fill();
  
  // Draw player direction (white line)
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  minimapCtx.strokeStyle = 'white'; // WHITE - Player direction
  minimapCtx.lineWidth = 1;
  minimapCtx.beginPath();
  minimapCtx.moveTo(
    toMinimapX(camera.position.x),
    toMinimapZ(camera.position.z)
  );
  minimapCtx.lineTo(
    toMinimapX(camera.position.x + direction.x * 10),
    toMinimapZ(camera.position.z + direction.z * 10)
  );
  minimapCtx.stroke();
  
  // Draw zombies (red dots)
  minimapCtx.fillStyle = 'red'; // RED - Zombies
  zombies.forEach(zombie => {
    minimapCtx.beginPath();
    minimapCtx.arc(
      toMinimapX(zombie.position.x),
      toMinimapZ(zombie.position.z),
      2,
      0,
      Math.PI * 2
    );
    minimapCtx.fill();
  });
}

// Update UI elements
function updateUI() {
  // Update health display
  healthDisplay.innerHTML = Math.max(0, Math.round(gameState.health));
  healthDisplay.style.color = gameState.health > 25 ? 'white' : '#ff4444';
  
  // Update health bar
  const healthBar = document.getElementById('healthBar');
  const healthPercent = Math.max(0, Math.min(100, gameState.health));
  healthBar.style.width = `${healthPercent}%`;
  
  // Change health bar color based on health level
  if (healthPercent > 60) {
    healthBar.style.backgroundColor = '#00ff00'; // Green
  } else if (healthPercent > 30) {
    healthBar.style.backgroundColor = '#ffff00'; // Yellow
  } else {
    healthBar.style.backgroundColor = '#ff0000'; // Red
  }

  // Update wave progress
  const waveProgress = (gameState.zombiesKilled / gameState.zombiesInWave) * 100;
  waveDisplay.innerHTML = `WAVE ${gameState.wave} (${waveProgress.toFixed(0)}%)`;
  
  // Update wave progress bar
  const waveProgressBar = document.getElementById('waveProgressBar');
  waveProgressBar.style.width = `${waveProgress}%`;
  
  // Update score with animation when it hits 100
  const previousScore = parseInt(scoreDisplay.innerHTML.replace('Score: ', '')) || 0;
  const newScore = gameState.score;
  
  if (newScore !== previousScore) {
    scoreDisplay.innerHTML = `Score: ${newScore}`;
    
    // If score is 100 or more, make it pop and turn gold
    if (newScore >= 100) {
      scoreDisplay.style.color = '#ffd700'; // Gold color
      scoreDisplay.style.fontWeight = 'bold';
      scoreDisplay.style.transform = 'scale(1.2)';
      
      // Reset after animation
      setTimeout(() => {
        scoreDisplay.style.transform = 'scale(1)';
      }, 300);
    } else {
      scoreDisplay.style.color = 'white';
      scoreDisplay.style.fontWeight = 'normal';
    }
  }

  // Update cooldown indicators
  const now = Date.now();
  
  // Update dash cooldown
  const dashCooldown = gameState.abilities.dash;
  const dashTimeLeft = Math.max(0, dashCooldown.cooldown - (now - dashCooldown.lastUsed));
  const dashCooldownPercent = (dashTimeLeft / dashCooldown.cooldown) * 100;
  dashCooldownDisplay.style.background = `conic-gradient(#4444ff ${dashCooldownPercent}%, transparent ${dashCooldownPercent}%)`;
  dashCooldownDisplay.style.opacity = dashTimeLeft > 0 ? '0.7' : '1';
  
  // Update updraft cooldown
  const updraftCooldown = gameState.abilities.updraft;
  const updraftTimeLeft = Math.max(0, updraftCooldown.cooldown - (now - updraftCooldown.lastUsed));
  const updraftCooldownPercent = (updraftTimeLeft / updraftCooldown.cooldown) * 100;
  updraftCooldownDisplay.style.background = `conic-gradient(#44ff44 ${updraftCooldownPercent}%, transparent ${updraftCooldownPercent}%)`;
  updraftCooldownDisplay.style.opacity = updraftTimeLeft > 0 ? '0.7' : '1';
}

// Start a new wave
function startWave() {
  // Calculate zombies for this wave (increases with each wave)
  gameState.zombiesInWave = 5 + (gameState.wave - 1) * 3;
  
  // For wave 3 and above, include ranged enemies
  if (gameState.wave >= 3) {
    // Initialize rangedEnemies array if it doesn't exist
    if (!window.rangedEnemies) {
      window.rangedEnemies = [];
    }
    
    // Clear existing ranged enemies
    for (const enemy of rangedEnemies) {
      scene.remove(enemy);
    }
    rangedEnemies = [];
    
    // Determine number of ranged enemies (about 1/3 of total enemies)
    const numRangedEnemies = Math.floor(gameState.zombiesInWave / 3);
    const numNormalZombies = gameState.zombiesInWave - numRangedEnemies;
    
    // Spawn initial enemies (mix of normal and ranged)
    for (let i = 0; i < Math.min(numRangedEnemies, 3); i++) {
      spawnRangedEnemy();
    }
    
    for (let i = 0; i < Math.min(numNormalZombies, 7); i++) {
      spawnZombie();
    }
  } else {
    // Wave 1 and 2: only normal zombies
    for (let i = 0; i < Math.min(gameState.zombiesInWave, 10); i++) {
      spawnZombie();
    }
  }
  
  // Update UI
  updateUI();
}

// Spawn a ranged enemy
function spawnRangedEnemy() {
  // Load slime texture
  const slimeTexture = new THREE.TextureLoader().load('textures/slime.jpg');
  
  // Create the enemy body (two stacked circles)
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32);
  const material = new THREE.MeshStandardMaterial({ 
    map: slimeTexture,
    color: 0xffffff // White base color to show texture properly
  });
  const enemy = new THREE.Mesh(geometry, material);
  enemy.castShadow = true;
  enemy.receiveShadow = true;
  
  // Create the enemy head (second circle)
  const headGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 32);
  const headMaterial = new THREE.MeshStandardMaterial({ 
    map: slimeTexture,
    color: 0xffffff // White base color to show texture properly
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.y = 0.45; // Position on top of the body
  head.castShadow = true;
  head.receiveShadow = true;
  enemy.add(head);
  
  // Find a valid spawn position
  let spawnX, spawnZ;
  let validPosition = false;
  let attempts = 0;
  const maxAttempts = 50;
  
  while (!validPosition && attempts < maxAttempts) {
    attempts++;
    // Generate random position within map boundaries
    spawnX = Math.random() * 90 - 45; // -45 to 45 (slightly inside boundaries)
    spawnZ = Math.random() * 90 - 45; // -45 to 45
    
    // Create a test position
    const testPosition = new THREE.Vector3(spawnX, 1, spawnZ);
    
    // Check if position is valid (not in walls and not too close to player)
    if (isPositionOutsideWalls(testPosition) && // Not in walls
        testPosition.distanceTo(camera.position) > 15 && // Not too close to player
        hasLineOfSight(testPosition, camera.position)) { // Has line of sight to player
      validPosition = true;
    }
  }
  
  // If no valid position found after max attempts, don't spawn the enemy
  if (!validPosition) {
    return null;
  }
  
  // Set position
  enemy.position.set(spawnX, 1, spawnZ);
  
  // Add properties
  enemy.userData = {
    health: 150, // Reduced from 300 to 150
    speed: 0.004 + Math.random() * 0.007,
    type: 'rangedEnemy',
    lastShot: 0,
    shootCooldown: 3000, // 2 seconds between shots
    projectileSpeed: 0.01, // Reduced from 0.15 to 0.03 (5 times slower)
    projectileDamage: 10,
    canSeePlayer: false // Track if enemy can see player
  };
  
  // Add to scene and array
  scene.add(enemy);
  rangedEnemies.push(enemy);
  return enemy;
}

// Check if there is a clear line of sight between two points
function hasLineOfSight(from, to) {
  const direction = new THREE.Vector3().subVectors(to, from).normalize();
  const raycaster = new THREE.Raycaster(from, direction);
  const distance = from.distanceTo(to);
  
  // Check for intersections with walls
  const intersects = raycaster.intersectObjects(walls);
  
  // Return true if no walls are between the points
  return intersects.length === 0 || intersects[0].distance > distance;
}

// Spawn a single zombie
function spawnZombie() {
  // List of zombie textures
  const zombieTextures = ['textures/zombie.png', 'textures/zombie2.png', 'textures/zombie3.png', 'textures/zombie4.png'];
  
  // Choose a random texture
  const randomTexture = zombieTextures[Math.floor(Math.random() * zombieTextures.length)];
  const zombieTexture = new THREE.TextureLoader().load(randomTexture);

  // Zombie appearance (simple cube for now)
  const zombieGeometry = new THREE.BoxGeometry(1, 2, 1);
  const zombieMaterial = new THREE.MeshStandardMaterial({ map: zombieTexture });
  const zombie = new THREE.Mesh(zombieGeometry, zombieMaterial);
  
  // Position zombie at random location outside player's view but within arena
  let position = new THREE.Vector3();
  let validPosition = false;

  while (!validPosition) {
    position.x = (Math.random() - 0.5) * 100;
    position.z = (Math.random() - 0.5) * 100;

    if (isPositionOutsideWalls(position) && position.distanceTo(camera.position) > 15) {
      validPosition = true;
    }
  }
  
  zombie.position.copy(position);
  zombie.position.y = 1; // Half height of zombie
  
  zombie.castShadow = true;
  zombie.receiveShadow = true;
  
  // Zombie properties
  zombie.userData = {
    health: 100,
    speed: 0.004 + Math.random() * 0.007,
    type: 'zombie'
  };
  
  zombies.push(zombie);
  scene.add(zombie);
}


// Check if a position is outside walls
function isPositionOutsideWalls(position) {
  // Check if position is outside the map boundaries
  if (Math.abs(position.x) > 50 || Math.abs(position.z) > 50) {
    return false;
  }
  
  // Safety check - if mapLayout is not initialized yet, return true
  if (!mapLayout) {
    return true;
  }
  
  // Check collision with all walls in the map layout
  for (const section of Object.values(mapLayout)) {
    for (const item of section) {
      if ('w' in item) { // It's a wall
        // Calculate the boundaries of the wall
        const halfWidth = item.w / 2;
        const halfDepth = item.d / 2;
        
        // Check if the position is inside the wall
        if (
          position.x >= item.x - halfWidth &&
          position.x <= item.x + halfWidth &&
          position.z >= item.z - halfDepth &&
          position.z <= item.z + halfDepth
        ) {
          return false; // Position is inside a wall
        }
      }
    }
  }
  
  // If we've made it here, the position is outside walls
  return true;
}

// Handle mouse click (shooting)
function onMouseClick(event) {
  if (gameState.gameOver) {
    // Restart game on click if game over
    restartGame();
    return;
  }
  
  if (!controls.isLocked) return;
  
  // Start shooting
  gameState.isShooting = true;
}

// Handle mouse up (stop shooting)
function onMouseUp(event) {
  gameState.isShooting = false;
}

// Handle mouse movement
function onMouseMove(event) {
  if (!controls.isLocked) return;
  
  // Update mouse position for raycaster
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Handle pointer lock change
function onPointerLockChange() {
  if (!controls.isLocked && !gameState.gameOver) {
    // Remove pause menu if it exists
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) pauseMenu.remove();
    
    // Show escape hint if it's the first time
    if (showEscapeHint) {
      showEscapeHint = false;
      showEscapeHintMessage();
    }
  }
}

// Show escape hint message
function showEscapeHintMessage() {
  // Create hint element
  const hintElement = document.createElement('div');
  hintElement.id = 'escapeHint';
  hintElement.style.position = 'absolute';
  hintElement.style.top = '50%';
  hintElement.style.left = '50%';
  hintElement.style.transform = 'translate(-50%, -50%)';
  hintElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  hintElement.style.color = '#00ff00';
  hintElement.style.padding = '15px 25px';
  hintElement.style.borderRadius = '5px';
  hintElement.style.fontFamily = '"Orbitron", sans-serif';
  hintElement.style.fontSize = '24px';
  hintElement.style.zIndex = '1000';
  hintElement.style.textAlign = 'center';
  hintElement.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.7)';
  hintElement.style.animation = 'fadeInOut 3s forwards';
  hintElement.style.border = '2px solid #00ff00';
  
  // Add text
  hintElement.innerHTML = 'Press <span style="color: #ffff00;">ESC</span> to show menu';
  
  // Add to document
  document.body.appendChild(hintElement);
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  // Remove hint after animation completes
  escapeHintTimeout = setTimeout(() => {
    if (hintElement && hintElement.parentNode) {
      hintElement.parentNode.removeChild(hintElement);
    }
  }, 3000);
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Kill a zombie
function killZombie(zombie) {
  // Create death animation
  createZombieDeathAnimation(zombie);
  
  // Remove from zombies array but keep in scene for animation
  zombies.splice(zombies.indexOf(zombie), 1);
  
  // Update game state
  gameState.zombiesKilled++;
  gameState.score += 10;
  
  // Check if we need to spawn more zombies in this wave
  const totalEnemies = zombies.length + (rangedEnemies ? rangedEnemies.length : 0);
  if (totalEnemies < 10 && gameState.zombiesKilled < gameState.zombiesInWave) {
    if (gameState.wave >= 2 && Math.random() < 0.3) { // 30% chance for ranged enemy in wave 2+
      spawnRangedEnemy();
    } else {
      spawnZombie();
    }
  }
  
  // Check if wave is complete
  if (gameState.zombiesKilled >= gameState.zombiesInWave) {
    // Start next wave
    gameState.wave++;
    gameState.zombiesKilled = 0;
    startWave();
  }
  
  // Update UI
  updateUI();
}

// Create death animation for zombie
function createZombieDeathAnimation(zombie) {
  // Store original position and material
  const originalPosition = zombie.position.clone();
  
  // Create particle system for death effect
  const particleCount = 50; // More particles for a more dramatic effect
  const particles = [];
  
  // Create particles
  for (let i = 0; i < particleCount; i++) {
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 1
    });
    
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Position particle at zombie's position with slight random offset
    particle.position.copy(originalPosition);
    particle.position.x += (Math.random() - 0.5) * 0.5;
    particle.position.y += (Math.random() - 0.5) * 0.5;
    particle.position.z += (Math.random() - 0.5) * 0.5;
    
    // Add random velocity with higher speed for a "pop" effect
    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3, // Increased speed
        Math.random() * 0.3,         // Increased speed
        (Math.random() - 0.5) * 0.3  // Increased speed
      ),
      life: 1.0, // Full life
      maxLife: 1.0
    };
    
    particles.push(particle);
    scene.add(particle);
  }
  
  // Create a blood splat effect
  const splatGeometry = new THREE.CircleGeometry(0.5, 16);
  const splatMaterial = new THREE.MeshBasicMaterial({
    color: 0x660000,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  
  const splat = new THREE.Mesh(splatGeometry, splatMaterial);
  splat.position.copy(originalPosition);
  splat.position.y = 0.01; // Just above the ground
  splat.rotation.x = -Math.PI / 2; // Lay flat on the ground
  scene.add(splat);
  
  // Immediately remove the zombie for a "pop" effect
  scene.remove(zombie);
  
  // Animate the death effect
  const startTime = Date.now();
  const animationDuration = 800; // Slightly faster animation
  
  function animateDeath() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    
    // Update particles
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      
      // Update position based on velocity
      particle.position.add(particle.userData.velocity);
      
      // Apply gravity to y velocity
      particle.userData.velocity.y -= 0.01; // Increased gravity
      
      // Fade out particle
      particle.userData.life -= 0.02;
      particle.material.opacity = particle.userData.life;
      
      // Scale down particle
      const scale = 0.1 * particle.userData.life;
      particle.scale.set(scale, scale, scale);
    }
    
    // Fade out blood splat
    splat.material.opacity = 0.7 * (1 - progress * 0.5);
    
    // Continue animation or clean up
    if (progress < 1) {
      requestAnimationFrame(animateDeath);
    } else {
      // Remove particles from scene
      particles.forEach(particle => scene.remove(particle));
      scene.remove(splat);
    }
  }
  
  // Start the animation
  animateDeath();
}

// Create bullet hit effect
function createBulletHitEffect(position) {
  // Create particle system for hit effect
  const particleCount = 20; // Increased from 15 to 30 particles
  const particles = [];
  
  // Create particles
  for (let i = 0; i < particleCount; i++) {
    const particleGeometry = new THREE.SphereGeometry(0.4, 8, 8); // Increased size from 0.05 to 0.15
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Red particles for blood
      transparent: true,
      opacity: 0.9 // Increased opacity from 0.8 to 0.9
    });
    
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Position particle at hit position with slight random offset
    particle.position.copy(position);
    particle.position.x += (Math.random() - 0.5) * 0.3; // Increased spread from 0.2 to 0.3
    particle.position.y += (Math.random() - 0.5) * 0.3;
    particle.position.z += (Math.random() - 0.5) * 0.3;
    
    // Add random velocity with higher speed
    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2, // Increased speed from 0.2 to 0.4
        Math.random() * 0.4,
        (Math.random() - 0.5) * 0.4
      ),
      life: 1.0,
      maxLife: 1.0
    };
    
    particles.push(particle);
    scene.add(particle);
  }
  
  // Add a small blood splat at impact point
  const splatGeometry = new THREE.CircleGeometry(0.2, 16);
  const splatMaterial = new THREE.MeshBasicMaterial({
    color: 0x990000, // Darker red for blood
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  
  const splat = new THREE.Mesh(splatGeometry, splatMaterial);
  splat.position.copy(position);
  splat.position.y = 0.01; // Just above the ground
  splat.rotation.x = -Math.PI / 2; // Lay flat on the ground
  scene.add(splat);
  
  // Animate the hit effect
  const startTime = Date.now();
  const animationDuration = 700; // Increased duration from 500 to 700ms
  
  function animateHit() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    
    // Update particles
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      
      // Update position based on velocity
      particle.position.add(particle.userData.velocity);
      
      // Apply gravity to y velocity
      particle.userData.velocity.y -= 0.015; // Increased gravity from 0.01 to 0.015
      
      // Fade out particle
      particle.userData.life -= 0.03; // Slower fade from 0.05 to 0.03
      particle.material.opacity = particle.userData.life;
      
      // Scale down particle
      const scale = 0.15 * particle.userData.life; // Increased base scale from 0.05 to 0.15
      particle.scale.set(scale, scale, scale);
    }
    
    // Fade out blood splat
    splat.material.opacity = 0.8 * (1 - progress * 0.5);
    
    // Continue animation or clean up
    if (progress < 1) {
      requestAnimationFrame(animateHit);
    } else {
      // Remove particles from scene
      particles.forEach(particle => scene.remove(particle));
      scene.remove(splat);
    }
  }
  
  // Start the animation
  animateHit();
}

// Update zombies
function updateZombies(deltaTime) {
  for (const zombie of zombies) {
    // Calculate direction to player
    const direction = new THREE.Vector3()
      .subVectors(camera.position, zombie.position)
      .normalize();
    
    // Move zombie towards player (y component 0 to stay on ground)
    direction.y = 0;
    
    // Calculate potential new position
    const newPosition = zombie.position.clone().add(
      direction.multiplyScalar(zombie.userData.speed * deltaTime)
    );
    
    // Check if new position would collide with walls
    if (!isPositionOutsideWalls(newPosition)) {
      // If would collide, try to find a path around the obstacle
      const alternativeDirections = [
        new THREE.Vector3(1, 0, 0),   // Right
        new THREE.Vector3(-1, 0, 0),  // Left
        new THREE.Vector3(0, 0, 1),   // Forward
        new THREE.Vector3(0, 0, -1),  // Backward
        new THREE.Vector3(1, 0, 1).normalize(),    // Forward-Right
        new THREE.Vector3(-1, 0, 1).normalize(),   // Forward-Left
        new THREE.Vector3(1, 0, -1).normalize(),   // Backward-Right
        new THREE.Vector3(-1, 0, -1).normalize()   // Backward-Left
      ];
      
      // Try each alternative direction
      let foundPath = false;
      for (const altDir of alternativeDirections) {
        const altPosition = zombie.position.clone().add(
          altDir.multiplyScalar(zombie.userData.speed * deltaTime)
        );
        
        // Check if this alternative position is valid
        if (isPositionOutsideWalls(altPosition)) {
          // Move in this direction instead
          zombie.position.copy(altPosition);
          foundPath = true;
          break;
        }
      }
      
      // If no alternative path found, try to move away from the wall
      if (!foundPath) {
        // Calculate a direction away from the wall
        const awayFromWall = new THREE.Vector3()
          .subVectors(zombie.position, camera.position)
          .normalize();
        
        // Move slightly in this direction
        zombie.position.add(awayFromWall.multiplyScalar(zombie.userData.speed * deltaTime * 0.5));
      }
    } else {
      // No collision, move to new position
      zombie.position.copy(newPosition);
    }
    
    // Make zombie face the player
    zombie.lookAt(new THREE.Vector3(camera.position.x, zombie.position.y, camera.position.z));
    
    // Check if zombie reached player
    if (zombie.position.distanceTo(camera.position) < 1.5) {
      damagePlayer(10);
      
      // Push zombie back a bit
      const pushDirection = new THREE.Vector3()
        .subVectors(zombie.position, camera.position)
        .normalize();
      zombie.position.add(pushDirection.multiplyScalar(1));
    }
  }
}

// Update bullets
function updateBullets(deltaTime) {
  for (const bullet of bullets) {
    // Store previous position for trail
    const prevPosition = bullet.position.clone();
    
    // Move bullet
    bullet.position.add(bullet.userData.velocity.clone().multiplyScalar(deltaTime));
    
    // Create trail particle
    const trailGeometry = new THREE.SphereGeometry(0.05, 4, 4);
    const trailMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      transparent: true,
      opacity: 0.5
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    trail.position.copy(prevPosition);
    
    // Add trail to scene and bullet's trail array
    scene.add(trail);
    bullet.userData.trail.push(trail);
    
    // Remove old trail particles (keep only the last 5)
    if (bullet.userData.trail.length > 5) {
      const oldTrail = bullet.userData.trail.shift();
      scene.remove(oldTrail);
    }
    
    // Fade out trail particles
    for (let i = 0; i < bullet.userData.trail.length; i++) {
      const trailParticle = bullet.userData.trail[i];
      trailParticle.material.opacity = 0.5 * (i / bullet.userData.trail.length);
    }
  }
}

// Damage player
function damagePlayer(amount) {
  gameState.health -= amount;
  
  // Flash screen red when damaged
  const flashOverlay = document.createElement('div');
  flashOverlay.style.position = 'absolute';
  flashOverlay.style.top = '0';
  flashOverlay.style.left = '0';
  flashOverlay.style.width = '100%';
  flashOverlay.style.height = '100%';
  flashOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
  flashOverlay.style.pointerEvents = 'none';
  document.body.appendChild(flashOverlay);
  
  // Remove flash after a short time
  setTimeout(() => {
    document.body.removeChild(flashOverlay);
  }, 100);
  
  updateUI();
  
  // Check if player is dead
  if (gameState.health <= 0) {
    gameOver();
  }
}

// Game over
function gameOver() {
  gameState.gameOver = true;
  gameOverDisplay.style.display = 'block';
  
  // Show end screen with final stats
  endScreenDisplay.innerHTML = `
    <h2 style="color: #ff3333; margin-bottom: 20px;">GAME OVER</h2>
    <p>Final Score: ${gameState.score}</p>
    <p>Waves Completed: ${gameState.wave - 1}</p>
    <p style="margin-top: 20px; font-size: 18px;">Click anywhere to restart</p>
  `;
  endScreenDisplay.style.display = 'block';
  
  controls.unlock();
}

// Restart game
function restartGame() {
  // Clear zombies
  for (const zombie of zombies) {
    scene.remove(zombie);
  }
  zombies = [];
  
  // Clear ranged enemies
  for (const enemy of rangedEnemies) {
    scene.remove(enemy);
  }
  rangedEnemies = [];
  
  // Clear projectiles
  for (const projectile of projectiles) {
    scene.remove(projectile);
  }
  projectiles = [];
  
  // Reset game state
  gameState = {
    health: 100,
    score: 0,
    wave: 1,
    zombiesKilled: 0,
    zombiesInWave: 5,
    gameOver: false,
    lastShot: 0,
    shootCooldown: 150,
    moveSpeed: 0.2,
    jumpForce: 0.3,
    gravity: 0.02,
    isJumping: false,
    verticalVelocity: 0,
    isShooting: false,
    // Ability cooldowns and states
    abilities: {
      dash: {
        cooldown: 6000,
        lastUsed: 0,
        distance: 10,
        duration: 200
      },
      updraft: {
        cooldown: 8000,
        lastUsed: 0,
        force: 0.3
      }
    }
  };
  
  // Reset player position to attacker spawn point
  const spawnZ = Math.random() < 0.5 ? 45 : -45;
  camera.position.set(0, 1.6, spawnZ);
  camera.lookAt(0, 1.6, 0);
  
  // Hide game over display and end screen
  gameOverDisplay.style.display = 'none';
  endScreenDisplay.style.display = 'none';
  
  // Reset escape hint
  showEscapeHint = true;
  
  // Clear any existing escape hint
  const escapeHint = document.getElementById('escapeHint');
  if (escapeHint) {
    escapeHint.parentNode.removeChild(escapeHint);
  }
  
  // Clear timeout if it exists
  if (escapeHintTimeout) {
    clearTimeout(escapeHintTimeout);
    escapeHintTimeout = null;
  }
  
  // Update UI
  updateUI();
  
  // Start first wave
  startWave();
  
  // Lock controls again
  controls.lock();
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta() * 1000; // Convert to milliseconds
  
  // Only update if game is running and controls are locked
  if (!gameState.gameOver && controls.isLocked) {
    // Update movement
    updateMovement(moveState);
    updateZombies(deltaTime);
    updateRangedEnemies(deltaTime);
    updateProjectiles(deltaTime);
    updateBullets(deltaTime);
    
    // Handle continuous shooting
    if (gameState.isShooting) {
      handleShooting();
    }
    
    // Occasionally play random zombie sounds
    playRandomZombieSound();
  }
  
  // Update minimap
  updateMinimap();
  
  // Update UI
  updateUI();
  
  // Render scene
  renderer.render(scene, camera);
}

// Update ranged enemies
function updateRangedEnemies(deltaTime) {
  if (!rangedEnemies) return;
  
  rangedEnemies.forEach(enemy => {
    // Calculate distance to player
    const distanceToPlayer = enemy.position.distanceTo(camera.position);
    
    // Check if enemy has line of sight to player
    enemy.userData.canSeePlayer = hasLineOfSight(enemy.position, camera.position);
    
    // If player is within range (20 units) AND enemy has line of sight, shoot at them
    if (distanceToPlayer <= 20 && 
        Date.now() - enemy.userData.lastShot >= enemy.userData.shootCooldown &&
        enemy.userData.canSeePlayer) {
      // Calculate direction to player
      const direction = new THREE.Vector3()
        .subVectors(camera.position, enemy.position)
        .normalize();
      
      // Create projectile
      const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
      const projectileMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, // Green color
        transparent: true,
        opacity: 0.8
      });
      const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
      
      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(0.25, 8, 8);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      projectile.add(glow);
      
      // Set projectile position slightly above enemy
      projectile.position.copy(enemy.position);
      projectile.position.y += 0.5;
      
      // Set velocity
      projectile.velocity = direction.multiplyScalar(enemy.userData.projectileSpeed);
      
      // Add damage value to projectile
      projectile.damage = enemy.userData.projectileDamage;
      
      // Add to scene and projectiles array
      scene.add(projectile);
      projectiles.push(projectile);
      
      // Update last shot time
      enemy.userData.lastShot = Date.now();
    }
    
    // Move towards player if too far away AND has line of sight
    if (distanceToPlayer > 15 && enemy.userData.canSeePlayer) {
      const direction = new THREE.Vector3()
        .subVectors(camera.position, enemy.position)
        .normalize();
      
      // Calculate potential new position
      const newPosition = enemy.position.clone().add(
        direction.multiplyScalar(enemy.userData.speed * deltaTime)
      );
      
      // Only move if new position is valid
      if (isPositionOutsideWalls(newPosition)) {
        enemy.position.copy(newPosition);
      }
    }
    
    // Make enemy face the player
    enemy.lookAt(new THREE.Vector3(camera.position.x, enemy.position.y, camera.position.z));
  });
}

// Update projectiles from ranged enemies
function updateProjectiles(deltaTime) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    
    // Store current position for wall check
    const currentPos = projectile.position.clone();
    
    // Calculate next position
    const nextPos = currentPos.clone().add(
      projectile.velocity.clone().multiplyScalar(deltaTime)
    );
    
    // Check for wall collision
    const direction = new THREE.Vector3().subVectors(nextPos, currentPos).normalize();
    const distance = currentPos.distanceTo(nextPos);
    const raycaster = new THREE.Raycaster(currentPos, direction);
    const wallIntersects = raycaster.intersectObjects(walls);
    
    if (wallIntersects.length > 0 && wallIntersects[0].distance < distance) {
      // Hit a wall - remove projectile
      scene.remove(projectile);
      projectiles.splice(i, 1);
      continue;
    }
    
    // Move projectile if no wall hit
    projectile.position.copy(nextPos);
    
    // Check for collision with player
    if (projectile.position.distanceTo(camera.position) < 1) {
      // Damage player
      damagePlayer(projectile.damage);
      
      // Remove projectile
      scene.remove(projectile);
      projectiles.splice(i, 1);
      continue;
    }
    
    // Remove projectiles that are too far
    if (projectile.position.length() > 100) {
      scene.remove(projectile);
      projectiles.splice(i, 1);
    }
  }
}

// Handle shooting logic
function handleShooting() {
  // Check cooldown
  const now = Date.now();
  if (now - gameState.lastShot < gameState.shootCooldown) return;
  gameState.lastShot = now;
  
  // Clean up any existing shooting animation
  if (currentShootingElements) {
    clearTimeout(currentShootingElements.cleanupTimeout);
    Object.values(currentShootingElements).forEach(element => {
      if (element && element.parentNode === document.body) {
        document.body.removeChild(element);
      }
    });
  }
  
  // Play laser sound first (before animation)
  playLaserSound();
  
  // Create bullet visual effect
  shootBullet();
  
  // Create and store references to elements
  const elements = {
    gunImage: document.createElement('img'),
    svgContainer: document.createElement('div')
  };

  // Setup gun image - use preloaded images if available
  currentGunState = (currentGunState + 1) % 3;
  
  if (gunImagesLoaded && gunImages[currentGunState]) {
    // Use the preloaded image
    elements.gunImage.src = gunImages[currentGunState].src;
  } else {
    // Fallback to direct path if preloading isn't complete
    elements.gunImage.src = `textures/gun_shoot${currentGunState === 0 ? '' : currentGunState + 1}.png`;
  }
  
  elements.gunImage.style.position = 'absolute';
  elements.gunImage.style.bottom = '-18px';
  elements.gunImage.style.transform = `rotate(2deg)`;
  elements.gunImage.style.right = '0';
  elements.gunImage.style.width = '41vw';
  elements.gunImage.style.pointerEvents = 'none';
  elements.gunImage.style.userSelect = 'none';
  elements.gunImage.style.zIndex = '999';
  elements.gunImage.style.backgroundColor = 'transparent'; // Ensure transparency
  
  // Setup SVG container with improved visibility
  elements.svgContainer.style.position = 'absolute';
  elements.svgContainer.style.top = '0';
  elements.svgContainer.style.left = '0';
  elements.svgContainer.style.width = '100%';
  elements.svgContainer.style.height = '100%';
  elements.svgContainer.style.pointerEvents = 'none';
  elements.svgContainer.style.zIndex = '998';
  
  // Calculate positions
  const gunX = window.innerWidth - 50;
  const gunY = window.innerHeight - 50;
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  
  // Create SVG with line
  elements.svgContainer.innerHTML = `
    <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0;">
      <line 
        x1="${gunX}" 
        y1="${gunY}" 
        x2="${centerX}" 
        y2="${centerY}" 
        stroke="#2deef1" 
        stroke-width="3"
        filter="url(#glow)"
      />
      <defs>
        <filter id="glow">
          <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#2deef1"/>
        </filter>
      </defs>
    </svg>
  `;
  
  // Add all elements to the document
  Object.values(elements).forEach(element => {
    document.body.appendChild(element);
  });
  
  // Create a cleanup function
  const cleanup = () => {
    Object.values(elements).forEach(element => {
      if (element && element.parentNode === document.body) {
        document.body.removeChild(element);
      }
    });
    currentShootingElements = null;
  };
  
  // Set up the cleanup timeout
  const cleanupTimeout = setTimeout(cleanup, 50);
  
  // Store the timeout ID and elements for potential cancellation
  elements.cleanupTimeout = cleanupTimeout;
  currentShootingElements = elements;
  
  // Raycast for shooting - check both zombies and ranged enemies
  raycaster.setFromCamera(new THREE.Vector2(), camera);
  const allEnemies = [...zombies, ...rangedEnemies];
  const intersects = raycaster.intersectObjects(allEnemies);
  
  if (intersects.length > 0) {
    const hitEnemy = intersects[0].object;
    hitEnemy.userData.health -= 50; // Damage amount
    
    // Play hit sound
    playHitSound();
    
    // Create bullet hit effect at the hit position
    createBulletHitEffect(intersects[0].point);
    
    // Temporary hit effect (change color)
    const originalColor = hitEnemy.material.color.clone();
    hitEnemy.material.color.set(0xff0000);
    setTimeout(() => {
      hitEnemy.material.color.copy(originalColor);
    }, 100);
    
    // Check if enemy is dead
    if (hitEnemy.userData.health <= 0) {
      if (hitEnemy.userData.type === 'rangedEnemy') {
        // Remove ranged enemy
        scene.remove(hitEnemy);
        rangedEnemies.splice(rangedEnemies.indexOf(hitEnemy), 1);
        gameState.score += 20; // More points for ranged enemies
      } else {
        killZombie(hitEnemy);
      }
    }
  }
}

// Create visual bullet effect
function shootBullet() {
  // Create a bullet (small sphere)
  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
  
  // Position bullet at player camera
  bullet.position.copy(camera.position);
  
  // Set direction from camera
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  
  bullet.userData = {
    velocity: direction.multiplyScalar(2), // Bullet speed
    lifetime: 100, // Bullet disappears after 1 second
    trail: [] // Array to store trail particles
  };
  
  bullets.push(bullet);
  scene.add(bullet);
  
  // Remove bullet after lifetime
  setTimeout(() => {
    scene.remove(bullet);
    bullets.splice(bullets.indexOf(bullet), 1);
  }, bullet.userData.lifetime);
}

// Dash ability
function useDash() {
  const now = Date.now();
  const dash = gameState.abilities.dash;
  
  if (now - dash.lastUsed < dash.cooldown) return;
  dash.lastUsed = now;
  
  // Play dash sound
  playDashSound();
  
  // Get current look direction
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0; // Keep dash horizontal
  direction.normalize();
  
  // Create dash effect
  const startPos = camera.position.clone();
  const endPos = startPos.clone().add(direction.multiplyScalar(dash.distance));
  
  // Check if the end position would be valid (not in a wall or outside the map)
  if (!isPositionOutsideWalls(endPos) || Math.abs(endPos.x) > 50 || Math.abs(endPos.z) > 50) {
    // If not valid, find a valid position along the dash path
    let validEndPos = startPos.clone();
    const steps = 10;
    const stepSize = dash.distance / steps;
    
    for (let i = 1; i <= steps; i++) {
      const testPos = startPos.clone().add(direction.clone().multiplyScalar(stepSize * i));
      if (isPositionOutsideWalls(testPos) && Math.abs(testPos.x) <= 50 && Math.abs(testPos.z) <= 50) {
        validEndPos = testPos;
      } else {
        break;
      }
    }
    
    endPos.copy(validEndPos);
  }
  
  // Animate dash
  const startTime = now;
  function animateDash() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / dash.duration, 1);
    
    camera.position.lerpVectors(startPos, endPos, progress);
    
    if (progress < 1) {
      requestAnimationFrame(animateDash);
    }
  }
  animateDash();
  
  // Create dash trail effect
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.LineBasicMaterial({ 
    color: 0x4488ff,
    transparent: true,
    opacity: 0.5
  });
  
  const points = [startPos, endPos];
  trailGeometry.setFromPoints(points);
  
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  scene.add(trail);
  
  // Remove trail after dash duration
  setTimeout(() => {
    scene.remove(trail);
  }, dash.duration);
}

// Updraft ability
function useUpdraft() {
  const now = Date.now();
  const updraft = gameState.abilities.updraft;
  
  if (now - updraft.lastUsed < updraft.cooldown) return;
  updraft.lastUsed = now;
  
  // Play updraft sound
  playUpdraftSound();
  
  // Apply upward force
  gameState.verticalVelocity = updraft.force;
  gameState.isJumping = true;
  
  // Create updraft visual effect
  const particleCount = 20;
  const particles = [];
  
  for (let i = 0; i < particleCount; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 4, 4),
      new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.6
      })
    );
    
    // Position around player
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = 1;
    particle.position.set(
      camera.position.x + Math.cos(angle) * radius,
      camera.position.y - 1,
      camera.position.z + Math.sin(angle) * radius
    );
    
    // Add upward velocity
    particle.userData.velocity = new THREE.Vector3(0, 0.1, 0);
    
    particles.push(particle);
    scene.add(particle);
  }
  
  // Animate particles
  function updateParticles() {
    particles.forEach(particle => {
      particle.position.add(particle.userData.velocity);
      particle.material.opacity -= 0.02;
      
      if (particle.material.opacity <= 0) {
        scene.remove(particle);
        particles.splice(particles.indexOf(particle), 1);
      }
    });
    
    if (particles.length > 0) {
      requestAnimationFrame(updateParticles);
    }
  }
  updateParticles();
}

// Start the game
function startGame() {
  // Hide start screen
  document.getElementById('startScreen').style.display = 'none';
  
  // Show loading screen
  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'loadingScreen';
  loadingScreen.style.position = 'absolute';
  loadingScreen.style.top = '0';
  loadingScreen.style.left = '0';
  loadingScreen.style.width = '100%';
  loadingScreen.style.height = '100%';
  loadingScreen.style.backgroundColor = '#000000';
  loadingScreen.style.display = 'flex';
  loadingScreen.style.flexDirection = 'column';
  loadingScreen.style.justifyContent = 'center';
  loadingScreen.style.alignItems = 'center';
  loadingScreen.style.zIndex = '9999';
  
  const loadingText = document.createElement('div');
  loadingText.style.color = '#00ff00';
  loadingText.style.fontSize = '36px';
  loadingText.style.fontFamily = '"Orbitron", sans-serif';
  loadingText.style.marginBottom = '20px';
  loadingText.style.textShadow = '0 0 10px rgba(0, 255, 0, 0.8)';
  loadingText.textContent = 'LOADING...';
  
  const loadingBar = document.createElement('div');
  loadingBar.style.width = '300px';
  loadingBar.style.height = '20px';
  loadingBar.style.backgroundColor = '#333333';
  loadingBar.style.borderRadius = '10px';
  loadingBar.style.overflow = 'hidden';
  
  const loadingProgress = document.createElement('div');
  loadingProgress.style.width = '0%';
  loadingProgress.style.height = '100%';
  loadingProgress.style.backgroundColor = '#00ff00';
  loadingProgress.style.transition = 'width 0.5s ease-in-out';
  
  loadingBar.appendChild(loadingProgress);
  loadingScreen.appendChild(loadingText);
  loadingScreen.appendChild(loadingBar);
  document.body.appendChild(loadingScreen);
  
  // Simulate loading progress
  let progress = 0;
  const loadingInterval = setInterval(() => {
    progress += 5;
    loadingProgress.style.width = `${progress}%`;
    
    if (progress >= 100) {
      clearInterval(loadingInterval);
    }
  }, 100);
  
  // Start the game after 2 seconds
  setTimeout(() => {
    // Remove loading screen
    document.body.removeChild(loadingScreen);
    
    // Set button clicked to true
    buttonClicked = true;
    
    // Start the first wave
    startWave();
    
    // Lock controls
    controls.lock();
    
    // Ensure music is playing
    if (backgroundMusic.paused) {
      backgroundMusic.play().catch(error => {
        console.log("Audio playback failed:", error);
      });
    }
  }, 2000);
}

// Initialize game when scripts are loaded
window.onload = init;

// Setup laser sound
function setupLaserSound() {
  try {
    laserSound = new Audio('sounds/lazer_sound.mp3');
    laserSound.volume = soundEffectsVolume; // Use the global sound effects volume
    
    // Preload the sound
    laserSound.load();
    
    // Create a pool of audio elements for rapid firing
    window.laserSoundPool = [];
    for (let i = 0; i < 5; i++) {
      const sound = new Audio('sounds/lazer_sound.mp3');
      sound.volume = soundEffectsVolume; // Use the global sound effects volume
      sound.load();
      window.laserSoundPool.push(sound);
    }
  } catch (error) {
    console.log("Error setting up laser sound:", error);
  }
}

// Play laser sound
function playLaserSound() {
  try {
    // Use the sound pool for rapid firing
    if (window.laserSoundPool && window.laserSoundPool.length > 0) {
      // Find an available sound from the pool
      const availableSound = window.laserSoundPool.find(sound => sound.paused);
      
      if (availableSound) {
        // Reset the sound to the beginning and skip the silent part
        availableSound.currentTime = 0.3; // Skip the first 0.3 seconds
        // Play immediately
        availableSound.play().catch(error => {
          console.log("Laser sound playback failed:", error);
        });
      } else {
        // If all sounds are playing, use the first one (overwrite)
        const sound = window.laserSoundPool[0];
        sound.currentTime = 0.3; // Skip the first 0.3 seconds
        sound.play().catch(error => {
          console.log("Laser sound playback failed:", error);
        });
      }
    } else {
      // Fallback to the original method if pool isn't available
      const sound = new Audio('sounds/lazer_sound.mp3');
      sound.volume = soundEffectsVolume;
      sound.currentTime = 0.3; // Skip the first 0.3 seconds
      sound.play().catch(error => {
        console.log("Laser sound playback failed:", error);
      });
    }
  } catch (error) {
    console.log("Error playing laser sound:", error);
  }
}

// Setup hit sound
function setupHitSound() {
  try {
    hitSound = new Audio('sounds/hit.wav');
    hitSound.volume = soundEffectsVolume; // Use the global sound effects volume
    
    // Preload the sound
    hitSound.load();
    
    // Create a pool of audio elements for rapid hits
    window.hitSoundPool = [];
    for (let i = 0; i < 5; i++) {
      const sound = new Audio('sounds/hit.wav');
      sound.volume = soundEffectsVolume; // Use the global sound effects volume
      sound.load();
      window.hitSoundPool.push(sound);
    }
  } catch (error) {
    console.log("Error setting up hit sound:", error);
  }
}

// Play hit sound
function playHitSound() {
  try {
    // Use the sound pool for rapid hits
    if (window.hitSoundPool && window.hitSoundPool.length > 0) {
      // Find an available sound from the pool
      const availableSound = window.hitSoundPool.find(sound => sound.paused);
      
      if (availableSound) {
        // Reset the sound to the beginning
        availableSound.currentTime = 0;
        // Play immediately
        availableSound.play().catch(error => {
          console.log("Hit sound playback failed:", error);
        });
      } else {
        // If all sounds are playing, use the first one (overwrite)
        const sound = window.hitSoundPool[0];
        sound.currentTime = 0;
        sound.play().catch(error => {
          console.log("Hit sound playback failed:", error);
        });
      }
    } else {
      // Fallback to the original method if pool isn't available
      const sound = new Audio('sounds/hit.wav');
      sound.volume = soundEffectsVolume;
      sound.play().catch(error => {
        console.log("Hit sound playback failed:", error);
      });
    }
  } catch (error) {
    console.log("Error playing hit sound:", error);
  }
}

// Setup zombie sounds
function setupZombieSounds() {
  try {
    // Create a pool of zombie sounds with correct filenames
    const zombieSoundFiles = [
      'sounds/zombie-1.wav',
      'sounds/zombie-2.wav',
      'sounds/zombie-3.wav',
      'sounds/zombie-4.wav',
      'sounds/zombie-5.wav'
    ];
    
    // Load each sound file
    zombieSoundFiles.forEach(soundFile => {
      const sound = new Audio(soundFile);
      sound.volume = soundEffectsVolume * 0.6; // Lower volume for zombie sounds
      sound.load();
      zombieSounds.push(sound);
    });
    
    console.log(`Loaded ${zombieSounds.length} zombie sounds`);
  } catch (error) {
    console.log("Error setting up zombie sounds:", error);
  }
}

// Play a random zombie sound
function playRandomZombieSound() {
  try {
    // Check if enough time has passed since the last zombie sound
    const now = Date.now();
    if (now - lastZombieSound < zombieSoundCooldown) {
      return; // Don't play if on cooldown
    }
    
    // Only play sound if there are zombies nearby
    const nearbyZombies = zombies.filter(zombie => 
      zombie.position.distanceTo(camera.position) < 30
    );
    
    if (nearbyZombies.length === 0) {
      return; // Don't play if no zombies nearby
    }
    
    // Higher chance to play (70% chance)
    if (Math.random() > 0.3) {
      // Select a random sound from the pool
      const randomIndex = Math.floor(Math.random() * zombieSounds.length);
      const sound = zombieSounds[randomIndex];
      
      // Reset the sound to the beginning
      sound.currentTime = 0;
      
      // Play the sound
      sound.play().catch(error => {
        console.log("Zombie sound playback failed:", error);
      });
      
      // Update the last played time
      lastZombieSound = now;
      
      // Set cooldown to 3-4 seconds
      zombieSoundCooldown = 3000 + Math.random() * 1000;
    }
  } catch (error) {
    console.log("Error playing zombie sound:", error);
  }
}

// Setup dash sound
function setupDashSound() {
  try {
    dashSound = new Audio('sounds/Dash.mp3');
    dashSound.volume = soundEffectsVolume; // Use the global sound effects volume
    
    // Preload the sound
    dashSound.load();
    
    console.log("Dash sound loaded successfully");
  } catch (error) {
    console.log("Error setting up dash sound:", error);
  }
}

// Play dash sound
function playDashSound() {
  try {
    // Reset the sound to the beginning
    dashSound.currentTime = 0;
    
    // Play the sound
    dashSound.play().catch(error => {
      console.log("Dash sound playback failed:", error);
    });
  } catch (error) {
    console.log("Error playing dash sound:", error);
  }
}

// Setup updraft sound
function setupUpdraftSound() {
  try {
    updraftSound = new Audio('sounds/Updraft.mp3');
    updraftSound.volume = soundEffectsVolume; // Use the global sound effects volume
    
    // Preload the sound
    updraftSound.load();
    
    console.log("Updraft sound loaded successfully");
  } catch (error) {
    console.log("Error setting up updraft sound:", error);
  }
}

// Play updraft sound
function playUpdraftSound() {
  try {
    // Reset the sound to the beginning
    updraftSound.currentTime = 0;
    
    // Play the sound
    updraftSound.play().catch(error => {
      console.log("Updraft sound playback failed:", error);
    });
  } catch (error) {
    console.log("Error playing updraft sound:", error);
  }
}

// Create settings menu
function createSettingsMenu() {
  // Create settings menu container
  const settingsMenu = document.createElement('div');
  settingsMenu.id = 'settingsMenu';
  settingsMenu.style.position = 'absolute';
  settingsMenu.style.top = '50%';
  settingsMenu.style.left = '50%';
  settingsMenu.style.transform = 'translate(-50%, -50%)';
  settingsMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  settingsMenu.style.padding = '20px';
  settingsMenu.style.borderRadius = '10px';
  settingsMenu.style.color = 'white';
  settingsMenu.style.fontFamily = '"Orbitron", sans-serif';
  settingsMenu.style.zIndex = '1000';
  settingsMenu.style.display = 'none';
  settingsMenu.style.minWidth = '300px';
  settingsMenu.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
  
  // Create title
  const title = document.createElement('h2');
  title.textContent = 'Game Settings';
  title.style.textAlign = 'center';
  title.style.marginBottom = '20px';
  title.style.color = '#00ff00';
  title.style.textShadow = '0 0 10px rgba(0, 255, 0, 0.8)';
  settingsMenu.appendChild(title);
  
  // Create mouse sensitivity control
  const sensitivityContainer = document.createElement('div');
  sensitivityContainer.style.marginBottom = '20px';
  
  const sensitivityLabel = document.createElement('label');
  sensitivityLabel.textContent = 'Mouse Sensitivity: ';
  sensitivityLabel.style.display = 'block';
  sensitivityLabel.style.marginBottom = '5px';
  
  const sensitivitySlider = document.createElement('input');
  sensitivitySlider.type = 'range';
  sensitivitySlider.min = '0.0005';
  sensitivitySlider.max = '0.005';
  sensitivitySlider.step = '0.0005';
  sensitivitySlider.value = mouseSensitivity;
  sensitivitySlider.style.width = '100%';
  sensitivitySlider.style.height = '20px';
  sensitivitySlider.style.accentColor = '#00ff00';
  
  const sensitivityValue = document.createElement('span');
  sensitivityValue.textContent = `${Math.round(mouseSensitivity * 10000)}`;
  sensitivityValue.style.marginLeft = '10px';
  
  sensitivitySlider.addEventListener('input', function() {
    mouseSensitivity = parseFloat(this.value);
    sensitivityValue.textContent = `${Math.round(mouseSensitivity * 10000)}`;
    if (controls) {
      controls.mouseSensitivity = mouseSensitivity;
    }
  });
  
  sensitivityContainer.appendChild(sensitivityLabel);
  sensitivityContainer.appendChild(sensitivitySlider);
  sensitivityContainer.appendChild(sensitivityValue);
  settingsMenu.appendChild(sensitivityContainer);
  
  // Create crosshair style selector
  const crosshairContainer = document.createElement('div');
  crosshairContainer.style.marginBottom = '20px';
  
  const crosshairLabel = document.createElement('label');
  crosshairLabel.textContent = 'Crosshair Style: ';
  crosshairLabel.style.display = 'block';
  crosshairLabel.style.marginBottom = '5px';
  
  const crosshairSelect = document.createElement('select');
  crosshairSelect.style.width = '100%';
  crosshairSelect.style.padding = '5px';
  crosshairSelect.style.backgroundColor = '#333';
  crosshairSelect.style.color = 'white';
  crosshairSelect.style.border = '1px solid #00ff00';
  crosshairSelect.style.borderRadius = '5px';
  
  const defaultOption = document.createElement('option');
  defaultOption.value = 'default';
  defaultOption.textContent = 'Default';
  
  const dotOption = document.createElement('option');
  dotOption.value = 'dot';
  dotOption.textContent = 'Dot';
  
  const crossOption = document.createElement('option');
  crossOption.value = 'cross';
  crossOption.textContent = 'Cross';
  
  crosshairSelect.appendChild(defaultOption);
  crosshairSelect.appendChild(dotOption);
  crosshairSelect.appendChild(crossOption);
  
  crosshairSelect.value = crosshairStyle;
  
  crosshairSelect.addEventListener('change', function() {
    crosshairStyle = this.value;
    updateCrosshair();
  });
  
  crosshairContainer.appendChild(crosshairLabel);
  crosshairContainer.appendChild(crosshairSelect);
  settingsMenu.appendChild(crosshairContainer);
  
  // Create music volume control
  const musicVolumeContainer = document.createElement('div');
  musicVolumeContainer.style.marginBottom = '20px';
  
  const musicLabel = document.createElement('label');
  musicLabel.textContent = 'Music Volume: ';
  musicLabel.style.display = 'block';
  musicLabel.style.marginBottom = '5px';
  
  const musicSlider = document.createElement('input');
  musicSlider.type = 'range';
  musicSlider.min = '0';
  musicSlider.max = '100';
  musicSlider.value = musicVolume * 100;
  musicSlider.style.width = '100%';
  musicSlider.style.height = '20px';
  musicSlider.style.accentColor = '#00ff00';
  
  const musicValue = document.createElement('span');
  musicValue.textContent = `${Math.round(musicVolume * 100)}%`;
  musicValue.style.marginLeft = '10px';
  
  musicSlider.addEventListener('input', function() {
    musicVolume = this.value / 100;
    musicValue.textContent = `${Math.round(musicVolume * 100)}%`;
    if (backgroundMusic) {
      backgroundMusic.volume = allMuted ? 0 : musicVolume;
    }
  });
  
  musicVolumeContainer.appendChild(musicLabel);
  musicVolumeContainer.appendChild(musicSlider);
  musicVolumeContainer.appendChild(musicValue);
  settingsMenu.appendChild(musicVolumeContainer);
  
  // Create sound effects volume control
  const sfxVolumeContainer = document.createElement('div');
  sfxVolumeContainer.style.marginBottom = '20px';
  
  const sfxLabel = document.createElement('label');
  sfxLabel.textContent = 'Sound Effects Volume: ';
  sfxLabel.style.display = 'block';
  sfxLabel.style.marginBottom = '5px';
  
  const sfxSlider = document.createElement('input');
  sfxSlider.type = 'range';
  sfxSlider.min = '0';
  sfxSlider.max = '100';
  sfxSlider.value = soundEffectsVolume * 100;
  sfxSlider.style.width = '100%';
  sfxSlider.style.height = '20px';
  sfxSlider.style.accentColor = '#00ff00';
  
  const sfxValue = document.createElement('span');
  sfxValue.textContent = `${Math.round(soundEffectsVolume * 100)}%`;
  sfxValue.style.marginLeft = '10px';
  
  sfxSlider.addEventListener('input', function() {
    soundEffectsVolume = this.value / 100;
    sfxValue.textContent = `${Math.round(soundEffectsVolume * 100)}%`;
    updateSoundEffectsVolume();
  });
  
  sfxVolumeContainer.appendChild(sfxLabel);
  sfxVolumeContainer.appendChild(sfxSlider);
  sfxVolumeContainer.appendChild(sfxValue);
  settingsMenu.appendChild(sfxVolumeContainer);
  
  // Create mute all button
  const muteButton = document.createElement('button');
  muteButton.textContent = allMuted ? 'Unmute All' : 'Mute All';
  muteButton.style.display = 'block';
  muteButton.style.margin = '0 auto 20px auto';
  muteButton.style.padding = '10px 20px';
  muteButton.style.backgroundColor = allMuted ? '#ff0000' : '#00ff00';
  muteButton.style.color = 'black';
  muteButton.style.border = 'none';
  muteButton.style.borderRadius = '5px';
  muteButton.style.cursor = 'pointer';
  muteButton.style.fontFamily = '"Orbitron", sans-serif';
  muteButton.style.fontWeight = 'bold';
  muteButton.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
  
  muteButton.addEventListener('click', function() {
    allMuted = !allMuted;
    this.textContent = allMuted ? 'Unmute All' : 'Mute All';
    this.style.backgroundColor = allMuted ? '#ff0000' : '#00ff00';
    
    // Update all sound volumes
    if (backgroundMusic) {
      backgroundMusic.volume = allMuted ? 0 : musicVolume;
    }
    
    updateSoundEffectsVolume();
  });
  
  settingsMenu.appendChild(muteButton);
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.display = 'block';
  closeButton.style.margin = '0 auto';
  closeButton.style.padding = '10px 20px';
  closeButton.style.backgroundColor = '#00ff00';
  closeButton.style.color = 'black';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '5px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontFamily = '"Orbitron", sans-serif';
  closeButton.style.fontWeight = 'bold';
  closeButton.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
  
  closeButton.addEventListener('click', function() {
    toggleSettingsMenu();
  });
  
  settingsMenu.appendChild(closeButton);
  
  // Add settings menu to document
  document.body.appendChild(settingsMenu);
}

// Toggle settings menu visibility
function toggleSettingsMenu() {
  const settingsMenu = document.getElementById('settingsMenu');
  
  if (!settingsMenu) {
    console.error("Settings menu element not found!");
    return;
  }
  
  if (settingsMenuVisible) {
    // Hide menu
    settingsMenu.style.display = 'none';
    settingsMenuVisible = false;
    controls.lock();
  } else {
    // Show menu
    controls.unlock(); // Unlock controls first
    settingsMenu.style.display = 'block';
    settingsMenuVisible = true;
    
    // Clear escape hint if it's visible
    const escapeHint = document.getElementById('escapeHint');
    if (escapeHint) {
      escapeHint.parentNode.removeChild(escapeHint);
    }
    
    // Clear timeout if it exists
    if (escapeHintTimeout) {
      clearTimeout(escapeHintTimeout);
      escapeHintTimeout = null;
    }
  }
}

// Update all sound effects volume
function updateSoundEffectsVolume() {
  const volume = allMuted ? 0 : soundEffectsVolume;
  
  if (laserSound) {
    laserSound.volume = volume;
  }
  
  if (hitSound) {
    hitSound.volume = volume;
  }
  
  if (dashSound) {
    dashSound.volume = volume;
  }
  
  if (updraftSound) {
    updraftSound.volume = volume;
  }
  
  // Update zombie sounds volume
  zombieSounds.forEach(sound => {
    sound.volume = volume * 0.6; // Keep zombie sounds slightly quieter
  });
  
  // Update sound pool volumes
  if (window.laserSoundPool) {
    window.laserSoundPool.forEach(sound => {
      sound.volume = volume;
    });
  }
  
  if (window.hitSoundPool) {
    window.hitSoundPool.forEach(sound => {
      sound.volume = volume;
    });
  }
}

// Update crosshair style
function updateCrosshair() {
  const crosshair = document.querySelector('.crosshair');
  if (!crosshair) return;
  
  // Remove existing crosshair
  crosshair.remove();
  
  // Create new crosshair based on selected style
  const newCrosshair = document.createElement('div');
  newCrosshair.className = 'crosshair';
  newCrosshair.style.position = 'absolute';
  newCrosshair.style.top = '50%';
  newCrosshair.style.left = '50%';
  newCrosshair.style.transform = 'translate(-50%, -50%)';
  newCrosshair.style.pointerEvents = 'none';
  newCrosshair.style.zIndex = '1000';
  
  switch (crosshairStyle) {
    case 'default':
      // Default crosshair (dot with circle)
      newCrosshair.innerHTML = `
        <div style="width: 10px; height: 10px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.8); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        <div style="width: 20px; height: 20px; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
      `;
      break;
    case 'dot':
      // Simple dot crosshair
      newCrosshair.innerHTML = `
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.8); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
      `;
      break;
    case 'cross':
      // Cross crosshair
      newCrosshair.innerHTML = `
        <div style="width: 2px; height: 20px; background-color: rgba(255, 255, 255, 0.8); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
        <div style="width: 20px; height: 2px; background-color: rgba(255, 255, 255, 0.8); position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
      `;
      break;
  }
  
  document.body.appendChild(newCrosshair);
}