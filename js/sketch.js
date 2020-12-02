/*jshint esversion: 10 */
var world;
var sensor; // will find objects in front/below the user
var takeOff = false;
var elevation;
var state = 'playing';
var tarmac, ground;
var torusArray = [];
var asteroidArray = [];
var cloudArray = [];
var projectiles = [];
var shotDelay = 3;
var score = 0;
var user;
var sound;
var distanceTraveled = 0;
var planeSpeed = 0.05;
var maxPlaneSpeed = 0.65;
var usingSpeedControls = false;
var scoreLabel;
var speedLabel;
var blankPlane;
// by default render first objects in front of player
var firstToruses = true;
var firstClouds = true;
var firstAsteroids = true;
/* graphic settings */
var renderDistance = 200;
var currentRender = 0;
var skyRenderDistance = 350;
var skyCurrentRender = skyRenderDistance;
var groundRenderDistance = 1400;
var groundCurrentRender = groundRenderDistance;
var renderCushion = 80; //distance to start rendering before reaching render distance
var cloudDensity = Math.round(0.3 * renderDistance);
var torusDensity = Math.round(0.1 * renderDistance);
var asteroidDensity = Math.round(0.1 * renderDistance);
// to increase performance:
// increase skyrender distance
// increase ground render distance
// decrease renderDistance
// decrease density of objects

function preload() {
  pointSound = loadSound('sounds/point.mp3');
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
  container2 = new Container3D({}); // container for tarmac and ground

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

  tarmac = new Plane({ // tarmac
    x: 0,
    y: 0.1,
    width: 10,
    height: 100,
    asset: 'pavement',
    repeatX: 10,
    repeatY: 100,
    rotationX: -90
  });

  ground = new Plane({ // regular ground
    x: 0,
    y: 0,
    z: 0,
    width: 3000,
    height: 3000,
    rotationX: -90,
    asset: "ground",
    side: "double",
    repeatX: 500,
    repeatY: 500,
  });
  container2.add(tarmac);
  ground.tag.object3D.userData.ground = true;
  container2.add(ground);
  // world.add(container2);

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

  accelerateButton = new Cylinder({
    x: 0.2,
    y: -0.5,
    z: 0,
    red: 0,
    green: 255,
    blue: 0,
    radius: 0.05,
    height: 0.1,
    rotationX: 45,
    enterFunction: function(btn) {
      usingSpeedControls = true;
    },
    leaveFunction: function(btn) {
      usingSpeedControls = false;
    },
    clickFunction: function(btn) {
      if (planeSpeed < maxPlaneSpeed) {
        planeSpeed += 0.1;
        engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
      }
    }
  });

  deaccelerateButton = new Cylinder({
    x: -0.2,
    y: -0.5,
    z: 0,
    red: 255,
    green: 0,
    blue: 0,
    radius: 0.05,
    height: 0.1,
    rotationX: 45,
    enterFunction: function(btn) {
      usingSpeedControls = true;
    },
    leaveFunction: function(btn) {
      usingSpeedControls = false;
    },
    clickFunction: function(btn) {
      if (planeSpeed >= 0.15) {
        planeSpeed -= 0.1;
      }
      engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
    }
  });
  container.addChild(accelerateButton);
  container.addChild(deaccelerateButton);

  // create our gravity sensor (see class below)
  // this object detects what is below the user
  sensor = new Sensor();
  engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
  shotSound.setVolume(0.05);
  crashSound.setVolume(0.18);
  engineSound.loop();
}

function restartGame() {
  state = "playing";
  world.setUserPosition(0, 3, 0);
  // reset variables
  score = 0;
  firstToruses = true;
  firstClouds = true;
  firstAsteroids = true;
  currentRender = 0;
  skyCurrentRender = skyRenderDistance;
  groundCurrentRender = groundRenderDistance;
  planeSpeed = 0.15;
  // reset sky
  document.getElementById("theSky").setAttribute("position", `0 0 ${distanceTraveled}`);

  container.remove(blankPlane);

  tarmac = new Plane({ // tarmac
    x: 0,
    y: 0.1,
    width: 10,
    height: 100,
    asset: 'pavement',
    repeatX: 10,
    repeatY: 100,
    rotationX: -90
  });

  ground = new Plane({ // regular ground
    x: 0,
    y: 0,
    z: 0,
    width: 3000,
    height: 3000,
    rotationX: -90,
    asset: "ground",
    side: "double",
    repeatX: 500,
    repeatY: 500,
  });

  container2.add(tarmac);
  ground.tag.object3D.userData.ground = true;
  container2.add(ground);
  world.add(container2); // add ground and tarmac back
}

function mousePressed() {
  if (state === "crash") {
    restartGame();
  } else if (!usingSpeedControls && shotDelay > 14) { // do not shoot when user presses on speed control
    projectiles.push(new Projectile());
    shotSound.play();
    shotDelay = 0;
  }
}

function keyPressed() {
  if (keyCode === 32) { // space bar pressed
    projectiles.push(new Projectile());
    shotSound.play();
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
    if (asteroidArray[i].sphere.getZ() - 5 > distanceTraveled) { //if plane passed torus
      world.remove(asteroidArray[i].sphere);
      asteroidArray.splice(i, 1);
      i -= 1;
    }
  }
}

function createAsteroids() {
  let startPoint = distanceTraveled - renderCushion;
  // start rendering toruses closer if its first set rendered
  if (firstAsteroids) {
    startPoint = 0;
    firstAsteroids = false;
  }
  for (let i = 0; i < asteroidDensity; i++) {
    asteroidArray.push(new Asteroid(startPoint, startPoint - renderDistance));
  }
}

function removeClouds() {
  for (let i = 0; i < cloudArray.length; i++) {
    if (cloudArray[i].cloud.getZ() - 5 > distanceTraveled) { //if plane passed cloud
      world.remove(cloudArray[i].cloud);
      cloudArray.splice(i, 1);
      i -= 1;
    }
  }
}

function createClouds() {
  let startPoint = distanceTraveled - renderCushion;
  //start rendering clouds closer if its first set rendered
  if (firstClouds) {
    startPoint = 0;
    firstClouds = false;
  }
  // create clouds
  for (let i = 0; i < cloudDensity; i++) {
    cloudArray.push(new Cloud(startPoint, startPoint - renderDistance));
  }
}

function removeToruses() {
  for (let i = 0; i < torusArray.length; i++) {
    if (torusArray[i].torus.getZ() - 5 > distanceTraveled) { //if plane passed torus
      world.remove(torusArray[i].torus);
      torusArray.splice(i, 1);
      i -= 1;
    }
  }
}

function createToruses() {
  let startPoint = distanceTraveled - renderCushion;
  // start rendering toruses closer if its first set rendered
  if (firstToruses) {
    startPoint = 0;
    firstToruses = false;
  }
  for (let i = 0; i < torusDensity; i++) {
    torusArray.push(new TorusClass(startPoint, startPoint - renderDistance));
  }
}

function renderNearbyObjects() {
  // render nearby asteroids/toruses/clouds every renderdistance traveled
  if (distanceTraveled < -currentRender + renderCushion) {
    currentRender += renderDistance;
    // createClouds();
    // createToruses();
    createAsteroids();
  }
  // move sky once user travels far enough
  if (distanceTraveled < -skyCurrentRender) {
    skyCurrentRender += skyRenderDistance;
    document.getElementById("theSky").setAttribute("position", `0 0 ${distanceTraveled}`);
  }
  // move ground once user travels far enough
  if (distanceTraveled < -groundCurrentRender) {
    groundCurrentRender += groundRenderDistance;
    ground.nudge(0, 0, distanceTraveled);
  }
}

function drawScoreBoard() {
  scoreLabel.tag.setAttribute('text', 'value: ' + (score) + ' targets ; color: rgb(255,255,255); align: center;');
  speedLabel.tag.setAttribute('text', 'value: ' + (Math.round(planeSpeed * 10000)) + ' mph ; color: rgb(255,255,255); align: center;');
}

function deleteGameObjects() {
  // remove all clouds
  for (let i = 0; i < cloudArray.length; i++) {
    world.remove(cloudArray[i].cloud);
    cloudArray.splice(i, 1);
    i -= 1;
  }
  // remove all asteroids
  for (let i = 0; i < asteroidArray.length; i++) {
    world.remove(asteroidArray[i].sphere);
    asteroidArray.splice(i, 1);
    i -= 1;
  }
  // remove all toruses
  for (let i = 0; i < torusArray.length; i++) {
    world.remove(torusArray[i].torus);
    torusArray.splice(i, 1);
    i -= 1;
  }
  for (let i = 0; i < projectiles.length; i++) {
    world.remove(projectiles[i].container);
    projectiles.splice(i, 1);
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
  world.remove(container2);
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
  // if we collide with asteroid or torus dont move
  if (objectAhead && objectAhead.distance < 1.4 && (objectAhead.object.el.object3D.userData.asteroid || objectAhead.object.el.object3D.userData.torus)) {
    loadGameOver();
    state = 'crash';
  }
}

function tryToTakeOff(){
  if (elevation >= 2 && !takeOff) { // increase speed once taken off
    planeSpeed = 0.15;
    engineSound.setVolume(map(planeSpeed, 0, maxPlaneSpeed, 0, 1));
    takeOff = true;
  }
}

function draw() {
  if (state === "playing") {
    shotDelay += 1;
    // increase speed if taking off
    tryToTakeOff();
    collisionDetection();
    renderNearbyObjects();
    // dont render objects that the plane no longer sees
    removeClouds();
    removeToruses();
    removeAsteroids();
    drawProjectiles();
    drawScoreBoard();
    world.moveUserForward(planeSpeed); // move
    distanceTraveled = world.camera.getZ();
    isUserScoring();
  }
}

function isUserScoring(){
  // if user gets a point
  for (let i = 0; i < torusArray.length; i++) {
    if (dist(torusArray[i].torus.x, torusArray[i].torus.y, torusArray[i].torus.z, user.x, user.y, user.z) <= torusArray[i].torus.radius) {
      if (!pointSound.isPlaying()) {
        pointSound.play();
      }
      score += 1;
      world.remove(torusArray[i].torus);
      torusArray.splice(i, 1);
      i -= 1;
    }
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
      y: -.5,
      z: 3,
      height: 1,
      radius: .1,
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

class Cloud {
  constructor(start, end) {
    this.cloud = new OBJ({
      asset: 'cloud.obj',
      mtl: 'cloud.mtl',
      x: random(-200, 200),
      y: random(10, 100),
      z: random(start, end),
      scaleX: 3,
      scaleY: 3,
      scaleZ: 3
    });
    world.add(this.cloud);
  }
}

class Asteroid {
  constructor(start, end) {
    this.sphere = new Sphere({
      x: random(-10, 10),
      y: random(2, 30),
      z: random(start, end),
      asset: "asteroid",
      radius: 1.5,
      rotationX: random(0, 360),
      radius: random(1, 6)
    });
    this.sphere.tag.object3D.userData.asteroid = true;
    world.add(this.sphere);
  }
}

class TorusClass {
  constructor(start, end) {
    this.torus = new Torus({
      x: random(-10, 10),
      y: random(3, 30),
      z: random(start, end),
      red: 255,
      green: 215,
      blue: 0,
      radius: 2.5,
    });
    this.torus.tag.object3D.userData.torus = true;
    world.add(this.torus);
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
        if (!(this.intersectsFront[i].object.el.object3D.userData.asteroid || this.intersectsFront[i].object.el.object3D.userData.torus || this.intersectsFront[i].object.el.object3D.userData.ground)) {
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
      if (!(this.intersects[i].object.el.object3D.userData.asteroid || this.intersects[i].object.el.object3D.userData.torus || this.intersects[i].object.el.object3D.userData.ground)) {
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
