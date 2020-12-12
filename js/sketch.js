/* jshint esversion: 10 */
var world;
var sensor; // will find objects in front/below the user
var elevation;
var health = 100;
var state = 'playing';
var asteroidArray = [];
var enemyArray = [];
var ally = [];
var projectiles = [];
var enemyProjectiles = [];
var shotDelay = 3;
var score = 0;
var user;
var sound;
var planeSpeed = 0.05;
var maxPlaneSpeed = 0.65;
var scoreLabel;
var speedLabel;
var healthLabel;
var blankPlane;
// by default render first objects in front of player
var firstAsteroids = true;
var firstEnemies = true;
/* graphic settings */
var renderDistance = 200;
var currentRender = 0;
var renderCushion = 80; //distance to start rendering before reaching render distance
var asteroidDensity = Math.round(0.1 * renderDistance);
// var enemyPlaneDensity = Math.round(0.01 * renderDistance);
var enemyPlaneDensity = Math.round(0.02 * renderDistance);
var distanceTraveled = 0;
// to increase performance:
// decrease renderDistance
// decrease density of objects


function preload() {
  engineSound = loadSound('sounds/engine.mp3');
  shotSound = loadSound('sounds/shot.wav');
  crashSound = loadSound('sounds/crash.mp3');
}

function createAlly() {
  ally = new Ally();
}

function createEnemyPlanes() {
  let startPoint = distanceTraveled - renderCushion;
  // start rendering asteroid closer if its first set rendered
  if (firstEnemies) {
    startPoint = 0;
    firstEnemies = false;
  }
  for (let i = 0; i < enemyPlaneDensity; i++) {
    enemyArray.push(new EnemyPlane((startPoint, startPoint - renderDistance)));
  }
}

function setup() {

  noCanvas();
  world = new World('VRScene', 'mouse', 'mouseMove');
  world.camera.cursor.show();
  world.setFlying(true);
  container = new Container3D({});
  createAlly();

  scoreLabel = new Plane({
    x: 0,
    y: -0.6,
    z: 0,
    width: 1,
    height: 1,
    transparent: true,
    opacity: 0
  });
  healthLabel = new Plane({
    x: 0,
    y: -0.7,
    z: 0,
    width: 1,
    height: 1,
    transparent: true,
    opacity: 0
  });

  speedLabel = new Plane({
    x: 0,
    y: -0.8,
    z: 0,
    width: 1,
    height: 1,
    transparent: true,
    opacity: 0
  });

  // add image to HUD
  let cockpitImage = new Plane({
    x: 0,
    y: 0,
    z: 0,
    scaleX: 3,
    scaleY: 2,
    transparent: true,
    asset: 'cockpit',
  });
  container.addChild(cockpitImage);
  container.addChild(scoreLabel);
  container.addChild(healthLabel);
  container.addChild(speedLabel);
  world.camera.cursor.addChild(container);

  // create our gravity sensor (see class below)
  // this object detects what is below the user
  sensor = new Sensor();
  engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
  shotSound.setVolume(0.05);
  crashSound.setVolume(0.18);
  engineSound.loop();
}

function mousePressed() {
  if (state === "crash") {
    //restartGame();
  } else {
    // projectiles.push(new Projectile());
    // shotSound.play();
    // shotDelay = 0;
  }
}

function increaseSpeed() {
  if (planeSpeed < maxPlaneSpeed) {
    planeSpeed += 0.1;
    engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
  }
}

function decreaseSpeed() {
  if (planeSpeed >= 0.15) {
    planeSpeed -= 0.1;
    engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
  }
}

function keyPressed() {
  if (keyCode === 32) { // space bar pressed
    projectiles.push(new Projectile());
    shotSound.play();
  } else if (keyCode === 87) {
    increaseSpeed();
  } else if (keyCode === 83) {
    decreaseSpeed();
  }
}

function collidedWithUser(projectilePosition) {
  const p = ally.ship.getWorldPosition();
  const d = dist(projectilePosition.x, projectilePosition.y, projectilePosition.z, p.x, p.y, p.z);
  if (d <= 1.4) {
    health -= 15;
    return true;
  }
  return false;
}

function moveEnemyProjectiles() {
  for (let i = 0; i < enemyProjectiles.length; i++) {
    enemyProjectiles[i].move();
    projectilePosition = enemyProjectiles[i].projectile.tag.object3D.position;
    const p = world.getUserPosition();
    const d = dist(projectilePosition.x, projectilePosition.y, projectilePosition.z, p.x, p.y, p.z);
    const collideWithUser = collidedWithUser(projectilePosition);
    // if (d > 100) {
    //   world.remove(enemyProjectiles[i].container);
    //   enemyProjectiles.splice(i, 1);
    //   i -= 1;
    //   continue;
    // }
  }
}

function moveProjectiles() {
  for (let i = 0; i < projectiles.length; i++) {
    projectiles[i].move();
    // get WORLD position for this projectile
    const projectilePosition = projectiles[i].projectile.getWorldPosition();
    const d = dist(projectilePosition.x, projectilePosition.y, projectilePosition.z, world.camera.getX(), world.camera.getY(), world.camera.getZ());
    const collideWithAsteroid = checkCollisions(asteroidArray, "sphere", projectilePosition);
    const collideWithEnemy = checkCollisions(enemyArray, "enemy", projectilePosition);
    // remove projectiles thay go to far or collide with an object
    if (d > 100 || collideWithAsteroid || collideWithEnemy) {
      world.remove(projectiles[i].container);
      projectiles.splice(i, 1);
      i -= 1;
      continue;
    }
  }
}

function checkCollisions(objectArray, objectType, projectilePosition) {
  for (let j = 0; j < objectArray.length; j++) {
    // compute distance
    const object = objectArray[j][objectType];
    const d = dist(projectilePosition.x, projectilePosition.y, projectilePosition.z, object.getX(), object.getY(), object.getZ());
    if (d <= objectArray[j].hitDist) { // asteroid hit
      world.remove(object);
      if (objectType === "enemy") {
        score += 1;
      }
      objectArray.splice(j, 1);
      return true;
    }
  }
  return false;
}

function removeAsteroids() {
  for (let i = 0; i < asteroidArray.length; i++) {
    if (asteroidArray[i].sphere.getZ() - 5 > distanceTraveled) { //if plane passed asteroid
      world.remove(asteroidArray[i].sphere);
      asteroidArray.splice(i, 1);
      i -= 1;
    }
  }
}

function createAsteroids() {
  let startPoint = distanceTraveled - renderCushion;
  // start rendering asteroid closer if its first set rendered
  if (firstAsteroids) {
    startPoint = 0;
    firstAsteroids = false;
  }
  for (let i = 0; i < asteroidDensity; i++) {
    asteroidArray.push(new Asteroid(startPoint, startPoint - renderDistance));
  }
}

function renderNearbyObjects() {
  // render nearby asteroids every render distance traveled
  if (distanceTraveled < -currentRender + renderCushion) {
    currentRender += renderDistance;
    createAsteroids();
    createEnemyPlanes();
  }
}

function drawScoreBoard() {
  scoreLabel.tag.setAttribute('text', 'value: ' + (score) + ' targets ; color: rgb(0,255,255); align: center;');
  healthLabel.tag.setAttribute('text', 'value: ' + (health) + ' health ; color: rgb(0,255,255); align: center;');
  speedLabel.tag.setAttribute('text', 'value: ' + (Math.round(planeSpeed * 10000)) + ' mph ; color: rgb(0,255,255); align: center;');
}

function deleteGameObjects() {
  // remove all asteroids
  for (let i = 0; i < asteroidArray.length; i++) {
    world.remove(asteroidArray[i].sphere);
    asteroidArray.splice(i, 1);
    i -= 1;
  }
}

function loadGameOver() {
  state = 'crash';
  deleteGameObjects();
  crashSound.play();
  engineSound.stop();
  blankPlane = new Plane({
    x: 0,
    y: 0,
    z: 0,
    scaleX: 3,
    scaleY: 3
  });
  container.addChild(blankPlane);
  // tell user it's game over
  blankPlane.tag.setAttribute('text',
    'value: ' + ('Game Over') + '; color: rgb(0,0,0); align: center;');
}

function collisionDetection() {
  user = world.getUserPosition(); // user's position
  elevation = world.getUserPosition().y; // user's y
  elevation = Math.round(elevation); // round it
  // see what's below / in front of the user
  let whatsBelow = sensor.getEntityBelowUser();
  let objectAhead = sensor.getEntityInFrontOfUser();
  //if we hit an object below us
  if (whatsBelow && whatsBelow.distance < 0.98) {
    loadGameOver();
  }
  // if we collide with asteroid dont move
  if (objectAhead && objectAhead.distance < objectAhead.object.el.object3D.userData.hitDist && (objectAhead.object.el.object3D.userData.asteroid || objectAhead.object.el.object3D.userData.enemyPlane)) {
    loadGameOver();
  }
}

function enemyAttack(enemyPlane, enemyPlaneShape) {
  enemyPlane.attackDelay += 1;
  let p = ally.ship.getWorldPosition();

  // get position of cone container
  let c = enemyPlaneShape.getWorldPosition();

  // compute a rotation vector from thenemy  to the object to look at
  let v = new THREE.Vector3()
  v.subVectors(p, c).add(c);

  // tell the enemy to look at the object
  enemyPlaneShape.tag.object3D.lookAt(v);

  // now compute how far off we are from this position
  var xDiff = p.x - enemyPlaneShape.getX();
  var yDiff = p.y - enemyPlaneShape.getY();
  var zDiff = p.z - enemyPlaneShape.getZ();
  // nudge the container toward this position
  enemyPlaneShape.nudge(xDiff * 0.01, yDiff * 0.01, zDiff * 0.01);
  if (enemyPlane.attackDelay === enemyPlane.attackInterval) {
    enemyProjectiles.push(
      new EnemyProjectile(
        c.x,
        c.y,
        c.z,
        degrees(enemyPlaneShape.tag.object3D.rotation._x),
        degrees(enemyPlaneShape.tag.object3D.rotation._y),
        degrees(enemyPlaneShape.tag.object3D.rotation._z)
      )
    );
    enemyPlane.attackDelay = 0;
  }
}

function moveAlly() {
  if (ally.state === "idle") {
    ally.xMovement = map(noise(ally.xNoiseOffset), 0, 1, -0.3, 0.3);
    ally.yMovement = map(noise(ally.yNoiseOffset), 0, 1, -0.1, 0.1);
    ally.zMovement = map(noise(ally.zNoiseOffset), 0, 1, -0.1, -0.3);
    ally.ship.nudge(ally.xMovement, ally.yMovement, ally.zMovement);
    // make sure it doesn't leave the middle of the screen
    ally.ship.constrainPosition(-70, 70, 2, 30);
    ally.xNoiseOffset += 0.01;
    ally.yNoiseOffset += 0.01;
    ally.zNoiseOffset += 0.01;
  }
}

function moveEnemy() {

  for (let i = 0; i < enemyArray.length; i++) {
    const enemyPlane = enemyArray[i];
    const enemyPlaneShape = enemyArray[i].enemy;

    if (enemyPlane.state === "idle") {
      enemyPlane.xMovement = map(noise(enemyPlane.xNoiseOffset), 0, 1, -0.3, 0.3);
      enemyPlane.yMovement = map(noise(enemyPlane.yNoiseOffset), 0, 1, -0.1, 0.1);
      enemyPlane.zMovement = map(noise(enemyPlane.zNoiseOffset), 0, 1, -0.3, -0.6);
      enemyPlaneShape.nudge(enemyPlane.xMovement, enemyPlane.yMovement, enemyPlane.zMovement);
      enemyPlane.xNoiseOffset += 0.01;
      enemyPlane.yNoiseOffset += 0.01;
      enemyPlane.zNoiseOffset += 0.01;
    } else if (enemyPlane.state === "attack") {
      enemyAttack(enemyPlane, enemyPlaneShape);
    } else if (enemyPlane.state === "spin") {
      spinEnemy(enemyPlane, enemyPlaneShape);
    }
  }
}

function draw() {
  if (state === "playing") {
    if (health <= 0) {
      loadGameOver();
    }
    document.getElementById("theSky").setAttribute("position", `${world.camera.getX()} ${world.camera.getY()} ${world.camera.getZ()}`);
    shotDelay += 1;
    // increase speed if taking off
    collisionDetection();
    renderNearbyObjects();
    moveEnemy();
    moveAlly();
    // dont render objects that the plane no longer sees
    removeAsteroids();
    moveProjectiles();
    moveEnemyProjectiles();
    drawScoreBoard();
    world.moveUserForward(planeSpeed); // move
    distanceTraveled = world.camera.getZ();
  }
}

class EnemyProjectile {
  constructor(x, y, z, rotX, rotY, rotZ) {
    this.projectileSpeed = -1;
    this.container = new Container3D({
      x: x,
      y: y,
      z: z,
      rotationX: rotX,
      rotationY: rotY,
      rotationZ: rotZ
    });
    world.add(this.container);
    this.projectile = new Cylinder({
      x: 0,
      y: 0,
      z: 0,
      height: 1,
      radius: 0.1,
      rotationX: -90,
      red: 199,
      green: 14,
      blue: 32
    });
    this.container.addChild(this.projectile);
  }
  move() {
    this.projectile.nudge(0, 0, -this.projectileSpeed);
  }
}

class Projectile {
  constructor() {
    //find out where user is
    var userPosition = world.getUserPosition();
    //get the direction they are facing
    var userRotation = world.getUserRotation();
    this.projectileSpeed = 1;
    this.container = new Container3D({
      x: userPosition.x,
      y: userPosition.y,
      z: userPosition.z,
      rotationX: userRotation.x,
      rotationY: userRotation.y,
      rotationZ: userRotation.z
    });
    world.add(this.container);
    const randInt = int(random(0, 2));
    let cannonX = 1;
    if (randInt === 0) {
      cannonX = -1;
    }
    this.projectile = new Cylinder({
      x: cannonX,
      y: -0.5,
      z: 3,
      height: 1,
      radius: 0.1,
      rotationX: -90,
      red: 57,
      green: 255,
      blue: 20
    });
    // add the projectile to the container
    this.container.addChild(this.projectile);
  }
  move() {
    // easy peasy - the projectile just moves along the z-axis by a certain amount
    // since it's been placed into a container that is already rotated correctly
    this.projectile.nudge(0, 0, -this.projectileSpeed);
  }
}

class Ally {
  constructor() {
    this.ship = new OBJ({
      asset: 'friendly_obj',
      mtl: 'friendly_mtl',
      x: 0,
      y: 0,
      z: -10,
      rotationY: 270,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    });
    this.state = "idle";
    this.rotation = 0;
    this.xNoiseOffset = random(0, 1000);
    this.yNoiseOffset = random(1000, 2000);
    this.zNoiseOffset = random(2000, 3000);
    this.xMovement = -0.5;
    this.yMovement = -0.5;
    this.zMovement = -0.5;
    this.hitDist = 1.4;
    this.ship.tag.object3D.userData.asteroid = true;
    world.add(this.ship);
  }
}

class EnemyPlane {
  constructor(start, end) {
    this.enemy = new OBJ({
      asset: 'enemy_obj',
      mtl: 'enemy_mtl',
      x: random(80, 80),
      y: random(2, 30),
      z: random(start, end),
      rotationY: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    });
    this.enemy.spinY(-90);
    this.facing = "south"; // direction plane is facing
    this.state = "attack";
    this.rotation = 0;
    this.xNoiseOffset = random(0, 1000);
    this.yNoiseOffset = random(1000, 2000);
    this.zNoiseOffset = random(2000, 3000);
    this.xMovement = -0.5;
    this.yMovement = -0.5;
    this.zMovement = -0.5;
    this.hitDist = 1.4;
    //attack vars
    this.attackDelay = 0;
    this.attackInterval = 14;
    this.enemy.tag.object3D.userData.enemyPlane = true;
    this.enemy.tag.object3D.userData.hitDist = this.hitDist;
    world.add(this.enemy);
  }
}

function spinEnemy(enemyPlane, enemyPlaneShape) {
  if (enemyPlane.rotation === 180) {
    enemyPlane.rotation = 0;
    enemyPlane.state = "still";
  }
  enemyPlane.rotation += 3;
  enemyPlaneShape.spinY(-3);
}

function loopEnemy(enemyPlane, enemyPlaneShape) {
  const rotX = enemyPlaneShape.tag.object3D.rotation._x;
  const rotY = enemyPlaneShape.tag.object3D.rotation._x;
  if (enemyPlane.rotation === 180) {
    enemyPlane.rotation = 0;
    enemyPlane.state = "still";
    if (enemyPlane.facing === "west") {
      enemyPlane.facing = "east";
    } else if (enemyPlane.facing === "north") {
      enemyPlane.facing = "south";
    } else if (enemyPlane.facing === "east") {
      enemyPlane.facing = "west";
    } else {
      enemyPlane.facing = "north";
    }
  }
  if (enemyPlane.facing === "north") {
    enemyPlane.zMovement += 0.017;
    enemyPlaneShape.nudge(0, 0.1, enemyPlane.zMovement);
    enemyPlaneShape.spinX(-3);
  } else if (enemyPlane.facing === "south") {
    enemyPlane.zMovement -= 0.017;
    enemyPlaneShape.nudge(0, 0.1, enemyPlane.zMovement);
    enemyPlaneShape.spinX(3);
  } else if (enemyPlane.facing === "east") {
    enemyPlane.xMovement -= 0.017;
    enemyPlaneShape.nudge(enemyPlane.xMovement, 0.1, 0);
    enemyPlaneShape.spinX(3);
  } else if (enemyPlane.facing === "west") {
    enemyPlane.xMovement += 0.017;
    enemyPlaneShape.nudge(enemyPlane.xMovement, 0.1, 0);
    enemyPlaneShape.spinX(-3);
  }
  enemyPlane.rotation += 3;
}

class Asteroid {
  constructor(start, end) {
    const radius = random(0, 6);
    const p = world.getUserPosition();
    this.sphere = new Sphere({
      x: random(-80, 80),
      y: random(2, 30),
      z: random(start, end),
      asset: "asteroid",
      rotationX: random(0, 360),
      radius: radius
    });
    this.hitDist = radius; // distance from projectile to count as a hit
    this.sphere.tag.object3D.userData.asteroid = true;
    this.sphere.tag.object3D.userData.hitDist = this.hitDist;
    world.add(this.sphere);
  }
}

class Sensor {

  constructor() {
    // raycaster - think of this like a "beam" that will fire out of the
    // bottom of the user's position to figure out what is below their avatar
    this.rayCaster = new THREE.Raycaster();
    this.userPosition = new THREE.Vector3(0, 0, 0);
    this.downVector = new THREE.Vector3(0, -1, 0);
    this.intersects = [];

    this.rayCasterFront = new THREE.Raycaster();
    this.cursorPosition = new THREE.Vector2(0, 0);
    this.intersectsFront = [];
  }

  getEntityInFrontOfUser() {
    // update the user's current position
    var cp = world.getUserPosition();
    this.userPosition.x = cp.x;
    this.userPosition.y = cp.y;
    this.userPosition.z = cp.z;

    if (world.camera.holder.object3D.children.length >= 2) {
      this.rayCasterFront.setFromCamera(this.cursorPosition, world.camera.holder.object3D.children[1]);
      this.intersectsFront = this.rayCasterFront.intersectObjects(world.threeSceneReference.children, true);

      // determine which "solid" items are in front of the user
      for (var i = 0; i < this.intersectsFront.length; i++) {
        if (!(this.intersectsFront[i].object.el.object3D.userData.asteroid || this.intersectsFront[i].object.el.object3D.userData.enemyPlane)) {
          this.intersectsFront.splice(i, 1);
          i--;
        }
      }
      if (this.intersectsFront.length > 0) {
        return this.intersectsFront[0];
      }
      return false;
    }
  }

  getEntityBelowUser() {
    // update the user's current position
    var cp = world.getUserPosition();
    this.userPosition.x = cp.x;
    this.userPosition.y = cp.y;
    this.userPosition.z = cp.z;

    this.rayCaster.set(this.userPosition, this.downVector);
    this.intersects = this.rayCaster.intersectObjects(world.threeSceneReference.children, true);

    // determine which "solid" or "stairs" items are below
    for (var i = 0; i < this.intersects.length; i++) {
      if (!(this.intersects[i].object.el.object3D.userData.asteroid || this.intersects[i].object.el.object3D.userData.enemyPlane)) {
        this.intersects.splice(i, 1);
        i--;
      }
    }
    if (this.intersects.length > 0) {
      return this.intersects[0];
    }
    return false;
  }
}
