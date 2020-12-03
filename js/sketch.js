/*jshint esversion: 10 */
var world;
var sensor; // will find objects in front/below the user
var elevation;
var state = 'playing';
var asteroidArray = [];
var projectiles = [];
var shotDelay = 3;
var score = 0;
var user;
var sound;
var distanceTraveled = 0;
var planeSpeed = 0.05;
var maxPlaneSpeed = 0.65;
var scoreLabel;
var speedLabel;
var blankPlane;
// by default render first objects in front of player
var firstAsteroids = true;
/* graphic settings */
var renderDistance = 200;
var currentRender = 0;
var renderCushion = 80; //distance to start rendering before reaching render distance
var asteroidDensity = Math.round(0.1 * renderDistance);
// to increase performance:
// decrease renderDistance
// decrease density of objects

function preload() {
  engineSound = loadSound('sounds/engine.mp3');
  shotSound = loadSound('sounds/shot.wav');
  crashSound = loadSound('sounds/crash.mp3');
}

function setup() {
  noCanvas();
  world = new World('VRScene');
  world.camera.cursor.show();
  world.setFlying(true);
  container = new Container3D({});

  scoreLabel = new Plane({
    x: 0,
    y: -0.2,
    z: 0,
    width: 1,
    height: 1,
    transparent: true,
    opacity: 0
  });

  speedLabel = new Plane({
    x: 0,
    y: -0.3,
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
    restartGame();
  } else {
    projectiles.push(new Projectile());
    shotSound.play();
    shotDelay = 0;
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

function drawProjectiles() {
  for (let i = 0; i < projectiles.length; i++) {
    projectiles[i].move();
    // get WORLD position for this projectile
    var projectilePosition = projectiles[i].projectile.getWorldPosition();
    // remove projectiles thay go to far
    if (projectilePosition.x > 50 || projectilePosition.x < -50 || projectilePosition.z > distanceTraveled + 50 || projectilePosition.z < distanceTraveled - 50) {
      world.remove(projectiles[i].container);
      projectiles.splice(i, 1);
      i -= 1;
      continue;
    }
    // otherwise check for collisions with our targets
    for (let j = 0; j < asteroidArray.length; j++) {
      // compute distance
      const sphere = asteroidArray[j].sphere;
      const d = dist(projectilePosition.x, projectilePosition.y, projectilePosition.z, sphere.getX(), sphere.getY(), sphere.getZ());
      if (d <= 4) { // asteroid hit
        world.remove(sphere);
        asteroidArray.splice(j, 1);
        break;
      }
    }
  }
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
  }
}

function drawScoreBoard() {
  scoreLabel.tag.setAttribute('text', 'value: ' + (score) + ' targets ; color: rgb(255,255,255); align: center;');
  speedLabel.tag.setAttribute('text', 'value: ' + (Math.round(planeSpeed * 10000)) + ' mph ; color: rgb(255,255,255); align: center;');
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
    'value: ' + ('Click to Restart') + '; color: rgb(0,0,0); align: center;');
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
    state = 'crash';
  }
  // if we collide with asteroid dont move
  if (objectAhead && objectAhead.distance < 1.4 && objectAhead.object.el.object3D.userData.asteroid) {
    loadGameOver();
    state = 'crash';
  }
}

function draw() {
  if (state === "playing") {
    document.getElementById("theSky").setAttribute("position", `${world.camera.getX()} ${world.camera.getY()} ${world.camera.getZ()}`);
    shotDelay += 1;
    // increase speed if taking off
    collisionDetection();
    renderNearbyObjects();
    // dont render objects that the plane no longer sees
    removeAsteroids();
    drawProjectiles();
    drawScoreBoard();
    world.moveUserForward(planeSpeed); // move
    distanceTraveled = world.camera.getZ();
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
      z: userPosition.z - 0.8,
      rotationX: userRotation.x,
      rotationY: userRotation.y,
      rotationZ: userRotation.z
    });
    world.add(this.container);
    this.projectile = new Cylinder({
      x: -1,
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

class Asteroid {
  constructor(start, end) {
    this.sphere = new Sphere({
      x: random(-80, 80),
      y: random(2, 30),
      z: random(start, end),
      asset: "asteroid",
      rotationX: random(0, 360),
      radius: random(1, 6)
    });
    this.sphere.tag.object3D.userData.asteroid = true;
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
        if (!(this.intersectsFront[i].object.el.object3D.userData.asteroid)) {
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
      if (!(this.intersects[i].object.el.object3D.userData.asteroid)) {
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
