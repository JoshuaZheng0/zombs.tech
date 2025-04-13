// Game state
const gameState = {
    health: 100,
    isJumping: false,
    verticalVelocity: 0
};

// Global variables
let scene, camera, renderer, controls;
let walls = [];
let rangedEnemies = [];
let projectiles = [];
let lastTime = Date.now();
let animationFrameId;
let moveState = { forward: false, backward: false, left: false, right: false };
let healthDisplay;
let player, playerVelocity;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let prevTime = performance.now();
const playerSpeed = 10;
const playerHealth = 100;
let currentHealth = playerHealth;

// Initialize the game
function init() {
    // Get DOM elements
    healthDisplay = document.getElementById('healthDisplay');
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Black background

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Setup PointerLockControls
    controls = new THREE.PointerLockControls(camera, document.body);
    
    // Add event listener for click to start
    document.addEventListener('click', function() {
        if (!controls.isLocked) {
            controls.lock();
        }
    });

    controls.addEventListener('lock', function() {
        document.getElementById('instructions').style.display = 'none';
    });

    controls.addEventListener('unlock', function() {
        document.getElementById('instructions').style.display = 'block';
    });

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black floor
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create some walls
    createWalls();

    // Spawn a ranged enemy
    spawnRangedEnemy();

    // Set up controls
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);

    // Player setup
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshPhongMaterial({ color: 0x000000 });
    player = new THREE.Mesh(geometry, material);
    player.position.y = 1;
    scene.add(player);
    camera.position.set(0, 2, 0);

    playerVelocity = new THREE.Vector3();

    // Start animation loop
    animate();
}

// Create walls
function createWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    
    // Create outer walls
    const wallGeometry = new THREE.BoxGeometry(2, 3, 100);
    
    // Left wall
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-50, 1.5, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    scene.add(leftWall);
    walls.push(leftWall);
    
    // Right wall
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(50, 1.5, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    scene.add(rightWall);
    walls.push(rightWall);
    
    // Front wall
    const frontWall = new THREE.Mesh(wallGeometry, wallMaterial);
    frontWall.rotation.y = Math.PI / 2;
    frontWall.position.set(0, 1.5, -50);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    scene.add(frontWall);
    walls.push(frontWall);
    
    // Back wall
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.rotation.y = Math.PI / 2;
    backWall.position.set(0, 1.5, 50);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    scene.add(backWall);
    walls.push(backWall);
}

// Spawn a ranged enemy
function spawnRangedEnemy() {
    // Create the enemy body (two stacked circles)
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black color
    const enemy = new THREE.Mesh(geometry, material);
    enemy.castShadow = true;
    enemy.receiveShadow = true;
    
    // Create the enemy head (second circle)
    const headGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black color
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.45; // Position on top of the body
    head.castShadow = true;
    head.receiveShadow = true;
    enemy.add(head);
    
    // Find a valid spawn position
    let spawnX, spawnZ;
    let validPosition = false;
    
    while (!validPosition) {
        // Generate random position within map boundaries
        spawnX = Math.random() * 100 - 50; // -50 to 50
        spawnZ = Math.random() * 100 - 50; // -50 to 50
        
        // Check if position is valid (not in walls and not too close to player)
        if (Math.abs(spawnX) <= 50 && Math.abs(spawnZ) <= 50 && // Within map boundaries
            !isPositionBlocked(spawnX, spawnZ) && // Not in walls
            Math.sqrt(Math.pow(spawnX - camera.position.x, 2) + Math.pow(spawnZ - camera.position.z, 2)) > 15) { // Not too close to player
            validPosition = true;
        }
    }
    
    // Set position
    enemy.position.set(spawnX, 0.5, spawnZ); // Y position is half the height of the enemy
    
    // Add properties
    enemy.userData = {
        health: 100,
        speed: 0.01,
        type: 'rangedEnemy',
        lastShot: 0,
        shootCooldown: 2000, // 2 seconds between shots
        projectileSpeed: 0.01, // Reduced from 0.2 to 0.02 (10x slower)
        projectileDamage: 10
    };
    
    // Add to scene and array
    scene.add(enemy);
    rangedEnemies.push(enemy);
}

// Update ranged enemies
function updateRangedEnemies(deltaTime) {
    rangedEnemies.forEach(enemy => {
        // Calculate distance to player
        const distanceToPlayer = enemy.position.distanceTo(camera.position);
        
        // If player is within range (20 units), shoot at them
        if (distanceToPlayer <= 20 && Date.now() - enemy.userData.lastShot >= enemy.userData.shootCooldown) {
            // Calculate direction to player
            const direction = new THREE.Vector3()
                .subVectors(camera.position, enemy.position)
                .normalize();
            
            // Create projectile
            const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black color
            const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
            
            // Set projectile position (slightly above enemy)
            projectile.position.copy(enemy.position);
            projectile.position.y += 0.5;
            
            // Add properties
            projectile.userData = {
                direction: direction,
                speed: enemy.userData.projectileSpeed,
                damage: enemy.userData.projectileDamage,
                type: 'projectile'
            };
            
            // Add to scene and array
            scene.add(projectile);
            projectiles.push(projectile);
            
            // Update last shot time
            enemy.userData.lastShot = Date.now();
        }
        
        // Move towards player if too far away
        if (distanceToPlayer > 15) {
            // Calculate direction to player
            const direction = new THREE.Vector3()
                .subVectors(camera.position, enemy.position)
                .normalize();
            
            // Calculate next position
            const nextX = enemy.position.x + direction.x * enemy.userData.speed * deltaTime;
            const nextZ = enemy.position.z + direction.z * enemy.userData.speed * deltaTime;
            
            // Check if next position is valid
            if (!isPositionBlocked(nextX, nextZ)) {
                enemy.position.x = nextX;
                enemy.position.z = nextZ;
            }
        }
        
        // Check for collision with player
        if (distanceToPlayer < 1.5) {
            // Deal damage to player
            gameState.health -= 10;
            healthDisplay.textContent = `Health: ${gameState.health}`;
            
            // Apply knockback
            const knockbackDirection = new THREE.Vector3()
                .subVectors(camera.position, enemy.position)
                .normalize();
            
            camera.position.add(knockbackDirection.multiplyScalar(0.5));
            
            // Check if player is dead
            if (gameState.health <= 0) {
                alert('Game Over!');
                location.reload();
            }
        }
    });
}

// Update projectiles
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Move projectile
        projectile.position.x += projectile.userData.direction.x * projectile.userData.speed * deltaTime;
        projectile.position.y += projectile.userData.direction.y * projectile.userData.speed * deltaTime;
        projectile.position.z += projectile.userData.direction.z * projectile.userData.speed * deltaTime;
        
        // Check for collision with player
        const distanceToPlayer = projectile.position.distanceTo(camera.position);
        if (distanceToPlayer < 1) {
            // Deal damage to player
            gameState.health -= projectile.userData.damage;
            healthDisplay.textContent = `Health: ${gameState.health}`;
            
            // Remove projectile
            scene.remove(projectile);
            projectiles.splice(i, 1);
            
            // Check if player is dead
            if (gameState.health <= 0) {
                alert('Game Over!');
                location.reload();
            }
            continue;
        }
        
        // Check for collision with walls
        if (isPositionBlocked(projectile.position.x, projectile.position.z)) {
            // Remove projectile
            scene.remove(projectile);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check if projectile is out of bounds
        if (Math.abs(projectile.position.x) > 50 || Math.abs(projectile.position.z) > 50) {
            // Remove projectile
            scene.remove(projectile);
            projectiles.splice(i, 1);
        }
    }
}

// Check if a position is blocked by walls
function isPositionBlocked(x, z) {
    // Create a small bounding box for the position
    const positionBB = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, 1.6, z),
        new THREE.Vector3(0.5, 3.2, 0.5)
    );
    
    // Check collision with all walls
    for (const wall of walls) {
        const wallBB = new THREE.Box3().setFromObject(wall);
        if (positionBB.intersectsBox(wallBB)) {
            return true;
        }
    }
    
    return false;
}

// Handle keyboard input
function onKeyDown(event) {
    if (!controls.isLocked) return;

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
    }
}

function onKeyUp(event) {
    if (!controls.isLocked) return;

    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

// Handle mouse movement
function onMouseMove(event) {
    if (!controls.isLocked) return;
    // PointerLockControls handles the camera rotation
}

// Update movement
function updateMovement(moveState) {
    if (!controls.isLocked) return;

    const moveSpeed = 0.2;
    
    if (moveState.forward) controls.moveForward(moveSpeed);
    if (moveState.backward) controls.moveForward(-moveSpeed);
    if (moveState.left) controls.moveRight(-moveSpeed);
    if (moveState.right) controls.moveRight(moveSpeed);
    
    // Keep player within bounds
    if (Math.abs(camera.position.x) > 49) {
        camera.position.x = Math.sign(camera.position.x) * 49;
    }
    if (Math.abs(camera.position.z) > 49) {
        camera.position.z = Math.sign(camera.position.z) * 49;
    }
}

function updatePlayerPosition(delta) {
    if (!controls.isLocked) return;

    playerVelocity.x = 0;
    playerVelocity.z = 0;

    const moveSpeed = playerSpeed * delta;

    if (moveForward) playerVelocity.z = -moveSpeed;
    if (moveBackward) playerVelocity.z = moveSpeed;
    if (moveLeft) playerVelocity.x = -moveSpeed;
    if (moveRight) playerVelocity.x = moveSpeed;

    // Apply movement relative to camera direction
    if (playerVelocity.x !== 0 || playerVelocity.z !== 0) {
        const angle = controls.getObject().rotation.y;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const moveX = playerVelocity.x * cos + playerVelocity.z * sin;
        const moveZ = playerVelocity.z * cos - playerVelocity.x * sin;

        // Update both camera and player position
        controls.moveRight(moveX);
        controls.moveForward(-moveZ);
        player.position.copy(controls.getObject().position);
        player.position.y = 1; // Keep player at ground level
    }

    // Keep player within bounds
    const boundaryLimit = 24;
    player.position.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, player.position.x));
    player.position.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, player.position.z));
    controls.getObject().position.copy(player.position);
    controls.getObject().position.y = 2;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    // Update player position
    updatePlayerPosition(delta);

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.position.add(projectile.velocity.multiplyScalar(delta));
        
        // Remove projectiles that are too far
        if (projectile.position.length() > 50) {
            scene.remove(projectile);
            projectiles.splice(i, 1);
            continue;
        }

        // Check for collisions with enemies
        for (let j = rangedEnemies.length - 1; j >= 0; j--) {
            const enemy = rangedEnemies[j];
            if (projectile.position.distanceTo(enemy.position) < 1) {
                scene.remove(projectile);
                projectiles.splice(i, 1);
                scene.remove(enemy);
                rangedEnemies.splice(j, 1);
                break;
            }
        }
    }

    // Update enemies
    rangedEnemies.forEach(enemy => {
        const directionToPlayer = new THREE.Vector3()
            .subVectors(player.position, enemy.position)
            .normalize();
        enemy.position.add(directionToPlayer.multiplyScalar(delta * 2));

        // Check for collision with player
        if (enemy.position.distanceTo(player.position) < 1) {
            currentHealth -= 10;
            document.getElementById('health').textContent = `Health: ${currentHealth}`;
            if (currentHealth <= 0) {
                alert('Game Over!');
                location.reload();
            }
        }
    });

    renderer.render(scene, camera);
}

// Initialize game
init(); 