/* library: aframep5.js
   author: craig kapp
   v0.1: 11/13/2016
   v0.2: 11/7/2017
   v0.3: 11/5/2019
   v2.0: 11/6/2020
*/

// A-Frame component to handle interaction events
AFRAME.registerComponent('generic-interaction-handler', {
    schema: {},

    init: function() {
        var el = this.el;

        el.addEventListener('mousedown', function(e) {
          console.log();
            try {
                // invoke the 'clickFunction' defined on this object
                el.eRef.clickFunction(el.eRef);
            } catch (err) {

            }
        });

        el.addEventListener('mouseenter', function() {
            try {
                // invoke the 'enterFunction' defined on this object
                el.eRef.enterFunction(el.eRef);
            } catch (err) {

            }
        });

        el.addEventListener('mouseleave', function() {
            try {
                // invoke the 'leaveFunction' defined on this object
                el.eRef.leaveFunction(el.eRef);
            } catch (err) {

            }
        });

        el.addEventListener('mouseup', function() {
            try {
                // invoke the 'upFunction' defined on this object
                el.eRef.upFunction(el.eRef);
            } catch (err) {

            }
        });

    }
});



var registerComponent = AFRAME.registerComponent;
var utils = AFRAME.utils;
var bind = utils.bind;

// To avoid recalculation at every mouse movement tick
var PI_2 = Math.PI / 2;

// helper functions
function computeDistance(x1,y1,x2,y2) {
  return Math.sqrt( Math.pow((x1-x2), 2) + Math.pow((y1-y2), 2) )
}

function remapRange(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

/**
 * look-controls. Update entity pose, factoring mouse, touch, and WebVR API data.
 */
AFRAME.registerComponent('look-controls-mousemove', {
  dependencies: ['position', 'rotation'],

  schema: {
    enabled: {default: true},
    magicWindowTrackingEnabled: {default: true},
    pointerLockEnabled: {default: false},
    reverseMouseDrag: {default: false},
    reverseTouchDrag: {default: false},
    touchEnabled: {default: true},
    mouseEnabled: {default: true}
  },

  init: function () {
    this.deltaYaw = 0;
    this.previousHMDPosition = new THREE.Vector3();
    this.hmdQuaternion = new THREE.Quaternion();
    this.magicWindowAbsoluteEuler = new THREE.Euler();
    this.magicWindowDeltaEuler = new THREE.Euler();
    this.position = new THREE.Vector3();
    this.magicWindowObject = new THREE.Object3D();
    this.rotation = {};
    this.deltaRotation = {};
    this.savedPose = null;
    this.pointerLocked = false;
    this.setupMouseControls();
    this.bindMethods();
    this.previousMouseEvent = {};

    // constant mouse motion variables
    this.movementX = 0;
    this.movementY = 0;

    this.setupMagicWindowControls();

    // To save / restore camera pose
    this.savedPose = {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler()
    };

    // Call enter VR handler if the scene has entered VR before the event listeners attached.
    if (this.el.sceneEl.is('vr-mode')) { this.onEnterVR(); }
  },

  setupMagicWindowControls: function () {
    var magicWindowControls;
    var data = this.data;

    // Only on mobile devices and only enabled if DeviceOrientation permission has been granted.
    if (utils.device.isMobile()) {
      magicWindowControls = this.magicWindowControls = new THREE.DeviceOrientationControls(this.magicWindowObject);
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        magicWindowControls.enabled = false;
        if (this.el.sceneEl.components['device-orientation-permission-ui'].permissionGranted) {
          magicWindowControls.enabled = data.magicWindowTrackingEnabled;
        } else {
          this.el.sceneEl.addEventListener('deviceorientationpermissiongranted', function () {
            magicWindowControls.enabled = data.magicWindowTrackingEnabled;
          });
        }
      }
    }
  },

  update: function (oldData) {
    var data = this.data;

    // Disable grab cursor classes if no longer enabled.
    if (data.enabled !== oldData.enabled) {
      this.updateGrabCursor(data.enabled);
    }

    // Reset magic window eulers if tracking is disabled.
    if (oldData && !data.magicWindowTrackingEnabled && oldData.magicWindowTrackingEnabled) {
      this.magicWindowAbsoluteEuler.set(0, 0, 0);
      this.magicWindowDeltaEuler.set(0, 0, 0);
    }

    // Pass on magic window tracking setting to magicWindowControls.
    if (this.magicWindowControls) {
      this.magicWindowControls.enabled = data.magicWindowTrackingEnabled;
    }

    if (oldData && !data.pointerLockEnabled !== oldData.pointerLockEnabled) {
      this.removeEventListeners();
      this.addEventListeners();
      if (this.pointerLocked) { this.exitPointerLock(); }
    }
  },

  tick: function (t) {
    var data = this.data;
    if (!data.enabled) { return; }

    var direction = this.data.reverseMouseDrag ? 1 : -1;
    this.yawObject.rotation.y += this.movementX * 0.002 * direction;
    this.pitchObject.rotation.x += this.movementY * 0.002 * direction;
    this.pitchObject.rotation.x = Math.max(-PI_2, Math.min(PI_2, this.pitchObject.rotation.x));

    // Calculate rotation.
    this.updateOrientation();

    // zzz
  },

  play: function () {
    this.addEventListeners();
  },

  pause: function () {
    this.removeEventListeners();
    if (this.pointerLocked) { this.exitPointerLock(); }
  },

  remove: function () {
    this.removeEventListeners();
    if (this.pointerLocked) { this.exitPointerLock(); }
  },

  bindMethods: function () {
    this.onMouseDown = bind(this.onMouseDown, this);
    this.onMouseMove = bind(this.onMouseMove, this);
    this.onMouseUp = bind(this.onMouseUp, this);
    this.onTouchStart = bind(this.onTouchStart, this);
    this.onTouchMove = bind(this.onTouchMove, this);
    this.onTouchEnd = bind(this.onTouchEnd, this);
    this.onEnterVR = bind(this.onEnterVR, this);
    this.onExitVR = bind(this.onExitVR, this);
    this.onPointerLockChange = bind(this.onPointerLockChange, this);
    this.onPointerLockError = bind(this.onPointerLockError, this);
  },

 /**
  * Set up states and Object3Ds needed to store rotation data.
  */
  setupMouseControls: function () {
    this.mouseDown = false;
    this.pitchObject = new THREE.Object3D();
    this.yawObject = new THREE.Object3D();
    this.yawObject.position.y = 10;
    this.yawObject.add(this.pitchObject);
  },

  /**
   * Add mouse and touch event listeners to canvas.
   */
  addEventListeners: function () {
    var sceneEl = this.el.sceneEl;
    var canvasEl = sceneEl.canvas;

    // Wait for canvas to load.
    if (!canvasEl) {
      sceneEl.addEventListener('render-target-loaded', bind(this.addEventListeners, this));
      return;
    }

    // Mouse events.
    canvasEl.addEventListener('mousedown', this.onMouseDown, false);
    window.addEventListener('mousemove', this.onMouseMove, false);
    window.addEventListener('mouseup', this.onMouseUp, false);

    // Touch events.
    canvasEl.addEventListener('touchstart', this.onTouchStart);
    window.addEventListener('touchmove', this.onTouchMove);
    window.addEventListener('touchend', this.onTouchEnd);

    // sceneEl events.
    sceneEl.addEventListener('enter-vr', this.onEnterVR);
    sceneEl.addEventListener('exit-vr', this.onExitVR);

    // Pointer Lock events.
    if (this.data.pointerLockEnabled) {
      document.addEventListener('pointerlockchange', this.onPointerLockChange, false);
      document.addEventListener('mozpointerlockchange', this.onPointerLockChange, false);
      document.addEventListener('pointerlockerror', this.onPointerLockError, false);
    }
  },

  /**
   * Remove mouse and touch event listeners from canvas.
   */
  removeEventListeners: function () {
    var sceneEl = this.el.sceneEl;
    var canvasEl = sceneEl && sceneEl.canvas;

    if (!canvasEl) { return; }

    // Mouse events.
    canvasEl.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    // Touch events.
    canvasEl.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);

    // sceneEl events.
    sceneEl.removeEventListener('enter-vr', this.onEnterVR);
    sceneEl.removeEventListener('exit-vr', this.onExitVR);

    // Pointer Lock events.
    document.removeEventListener('pointerlockchange', this.onPointerLockChange, false);
    document.removeEventListener('mozpointerlockchange', this.onPointerLockChange, false);
    document.removeEventListener('pointerlockerror', this.onPointerLockError, false);
  },

  /**
   * Update orientation for mobile, mouse drag, and headset.
   * Mouse-drag only enabled if HMD is not active.
   */
  updateOrientation: (function () {
    var poseMatrix = new THREE.Matrix4();

    return function () {
      var object3D = this.el.object3D;
      var pitchObject = this.pitchObject;
      var yawObject = this.yawObject;
      var pose;
      var sceneEl = this.el.sceneEl;

      // In VR mode, THREE is in charge of updating the camera pose.
      if (sceneEl.is('vr-mode') && sceneEl.checkHeadsetConnected()) {
        // With WebXR THREE applies headset pose to the object3D matrixWorld internally.
        // Reflect values back on position, rotation, scale for getAttribute to return the expected values.
        if (sceneEl.hasWebXR) {
          pose = sceneEl.renderer.xr.getCameraPose();
          if (pose) {
            poseMatrix.elements = pose.transform.matrix;
            poseMatrix.decompose(object3D.position, object3D.rotation, object3D.scale);
          }
        }
        return;
      }

      this.updateMagicWindowOrientation();

      // On mobile, do camera rotation with touch events and sensors.
      object3D.rotation.x = this.magicWindowDeltaEuler.x + pitchObject.rotation.x;
      object3D.rotation.y = this.magicWindowDeltaEuler.y + yawObject.rotation.y;
      object3D.rotation.z = this.magicWindowDeltaEuler.z;
    };
  })(),

  updateMagicWindowOrientation: function () {
    var magicWindowAbsoluteEuler = this.magicWindowAbsoluteEuler;
    var magicWindowDeltaEuler = this.magicWindowDeltaEuler;
    // Calculate magic window HMD quaternion.
    if (this.magicWindowControls && this.magicWindowControls.enabled) {
      this.magicWindowControls.update();
      magicWindowAbsoluteEuler.setFromQuaternion(this.magicWindowObject.quaternion, 'YXZ');
      if (!this.previousMagicWindowYaw && magicWindowAbsoluteEuler.y !== 0) {
        this.previousMagicWindowYaw = magicWindowAbsoluteEuler.y;
      }
      if (this.previousMagicWindowYaw) {
        magicWindowDeltaEuler.x = magicWindowAbsoluteEuler.x;
        magicWindowDeltaEuler.y += magicWindowAbsoluteEuler.y - this.previousMagicWindowYaw;
        magicWindowDeltaEuler.z = magicWindowAbsoluteEuler.z;
        this.previousMagicWindowYaw = magicWindowAbsoluteEuler.y;
      }
    }
  },

  /**
   * Translate mouse drag into rotation.
   *
   * Dragging up and down rotates the camera around the X-axis (yaw).
   * Dragging left and right rotates the camera around the Y-axis (pitch).
   */
  onMouseMove: function (evt) {
    var direction;
    var movementX;
    var movementY;
    var pitchObject = this.pitchObject;

    var previousMouseEvent = this.previousMouseEvent;
    var yawObject = this.yawObject;

    // compute center of screen
    var screenMiddleX = window.innerWidth / 2;
    var screenMiddleY = window.innerHeight / 2;
    var ignoreRadius = 0

    // how far away from the center is the mouse?
    let d = computeDistance(evt.clientX, evt.clientY, screenMiddleX, screenMiddleY)

    // if we are far enough away ...
    if (d > ignoreRadius) {

      // compute how fast we should scroll
      var factor = remapRange(d, ignoreRadius, ignoreRadius*2, 0.005, 0.008)
      if (factor > 0.008) {
        factor = 0.008
      }

      // store new movement info
      this.movementX = (evt.clientX - screenMiddleX) * factor;
      this.movementY = (evt.clientY - screenMiddleY) * factor;
    }
    else {

      // no movement
      this.movementX = 0;
      this.movementY = 0;
    }

    // Calculate rotation.
    direction = this.data.reverseMouseDrag ? 1 : -1;
    yawObject.rotation.y += this.movementX * 0.002 * direction;
    pitchObject.rotation.x += this.movementY * 0.002 * direction;
    pitchObject.rotation.x = Math.max(-PI_2, Math.min(PI_2, pitchObject.rotation.x));

  },

  /**
   * Register mouse down to detect mouse drag.
   */
  onMouseDown: function (evt) {
    var sceneEl = this.el.sceneEl;
    if (!this.data.enabled || !this.data.mouseEnabled || (sceneEl.is('vr-mode') && sceneEl.checkHeadsetConnected())) { return; }
    // Handle only primary button.
    if (evt.button !== 0) { return; }

    var canvasEl = sceneEl && sceneEl.canvas;

    this.mouseDown = true;
    this.previousMouseEvent.screenX = evt.screenX;
    this.previousMouseEvent.screenY = evt.screenY;
    this.showGrabbingCursor();

    if (this.data.pointerLockEnabled && !this.pointerLocked) {
      if (canvasEl.requestPointerLock) {
        canvasEl.requestPointerLock();
      } else if (canvasEl.mozRequestPointerLock) {
        canvasEl.mozRequestPointerLock();
      }
    }
  },

  /**
   * Shows grabbing cursor on scene
   */
  showGrabbingCursor: function () {
    this.el.sceneEl.canvas.style.cursor = 'grabbing';
  },

  /**
   * Hides grabbing cursor on scene
   */
  hideGrabbingCursor: function () {
    this.el.sceneEl.canvas.style.cursor = '';
  },

  /**
   * Register mouse up to detect release of mouse drag.
   */
  onMouseUp: function () {
    this.mouseDown = false;
    this.hideGrabbingCursor();
  },

  /**
   * Register touch down to detect touch drag.
   */
  onTouchStart: function (evt) {
    if (evt.touches.length !== 1 ||
        !this.data.touchEnabled ||
        this.el.sceneEl.is('vr-mode')) { return; }
    this.touchStart = {
      x: evt.touches[0].pageX,
      y: evt.touches[0].pageY
    };
    this.touchStarted = true;
  },

  /**
   * Translate touch move to Y-axis rotation.
   */
  onTouchMove: function (evt) {
    var direction;
    var canvas = this.el.sceneEl.canvas;
    var deltaY;
    var yawObject = this.yawObject;

    if (!this.touchStarted || !this.data.touchEnabled) { return; }

    deltaY = 2 * Math.PI * (evt.touches[0].pageX - this.touchStart.x) / canvas.clientWidth;

    direction = this.data.reverseTouchDrag ? 1 : -1;
    // Limit touch orientaion to to yaw (y axis).
    yawObject.rotation.y -= deltaY * 0.5 * direction;
    this.touchStart = {
      x: evt.touches[0].pageX,
      y: evt.touches[0].pageY
    };
  },

  /**
   * Register touch end to detect release of touch drag.
   */
  onTouchEnd: function () {
    this.touchStarted = false;
  },

  /**
   * Save pose.
   */
  onEnterVR: function () {
    var sceneEl = this.el.sceneEl;
    if (!sceneEl.checkHeadsetConnected()) { return; }
    this.saveCameraPose();
    this.el.object3D.position.set(0, 0, 0);
    this.el.object3D.rotation.set(0, 0, 0);
    if (sceneEl.hasWebXR) {
      this.el.object3D.matrixAutoUpdate = false;
      this.el.object3D.updateMatrix();
    }
  },

  /**
   * Restore the pose.
   */
  onExitVR: function () {
    if (!this.el.sceneEl.checkHeadsetConnected()) { return; }
    this.restoreCameraPose();
    this.previousHMDPosition.set(0, 0, 0);
    this.el.object3D.matrixAutoUpdate = true;
  },

  /**
   * Update Pointer Lock state.
   */
  onPointerLockChange: function () {
    this.pointerLocked = !!(document.pointerLockElement || document.mozPointerLockElement);
  },

  /**
   * Recover from Pointer Lock error.
   */
  onPointerLockError: function () {
    this.pointerLocked = false;
  },

  // Exits pointer-locked mode.
  exitPointerLock: function () {
    document.exitPointerLock();
    this.pointerLocked = false;
  },

  /**
   * Toggle the feature of showing/hiding the grab cursor.
   */
  updateGrabCursor: function (enabled) {
    var sceneEl = this.el.sceneEl;

    function enableGrabCursor () { sceneEl.canvas.classList.add('a-grab-cursor'); }
    function disableGrabCursor () { sceneEl.canvas.classList.remove('a-grab-cursor'); }

    if (!sceneEl.canvas) {
      if (enabled) {
        sceneEl.addEventListener('render-target-loaded', enableGrabCursor);
      } else {
        sceneEl.addEventListener('render-target-loaded', disableGrabCursor);
      }
      return;
    }

    if (enabled) {
      enableGrabCursor();
      return;
    }
    disableGrabCursor();
  },

  /**
   * Save camera pose before entering VR to restore later if exiting.
   */
  saveCameraPose: function () {
    var el = this.el;

    this.savedPose.position.copy(el.object3D.position);
    this.savedPose.rotation.copy(el.object3D.rotation);
    this.hasSavedPose = true;
  },

  /**
   * Reset camera pose to before entering VR.
   */
  restoreCameraPose: function () {
    var el = this.el;
    var savedPose = this.savedPose;

    if (!this.hasSavedPose) { return; }

    // Reset camera orientation.
    el.object3D.position.copy(savedPose.position);
    el.object3D.rotation.copy(savedPose.rotation);
    this.hasSavedPose = false;
  }
});



class Light {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'light';

        // process light opts
        setLight(this.opts, this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}


class Container3D {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'container';

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class DAE {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'dae';

        // set asset id
        this.tag.setAttribute('collada-model', '#' + opts.asset);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class OBJ {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'obj';

        // set asset id
        this.tag.setAttribute('obj-model', 'obj: #' + opts.asset + '; mtl: #' + opts.mtl);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }
}

class Box {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'box';

        // setup geometry parameters
        if (!('width' in opts)) {
            opts.width = 1;
        }
        if (!('depth' in opts)) {
            opts.depth = 1;
        }
        if (!('height' in opts)) {
            opts.height = 1;
        }
        this.width = opts.width;
        this.height = opts.height;
        this.depth = opts.depth;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }
}


class Plane {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'plane';

        // setup geometry parameters
        if (!('width' in opts)) {
            opts.width = 1;
        }
        if (!('height' in opts)) {
            opts.height = 1;
        }
        this.width = opts.width;
        this.height = opts.height;
        this.depth = "none";

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}


class Sphere {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'sphere';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        if (!('segmentsWidth' in opts)) {
            opts.segmentsWidth = 18;
        }
        this.segmentsWidth = opts.segmentsWidth;

        if (!('segmentsHeight' in opts)) {
            opts.segmentsHeight = 36;
        }
        this.segmentsHeight = opts.segmentsHeight;

        if (!('phiStart' in opts)) {
            opts.phiStart = 0;
        }
        this.phiStart = opts.phiStart;

        if (!('phiLength' in opts)) {
            opts.phiLength = 360;
        }
        this.phiLength = opts.phiLength;

        if (!('thetaStart' in opts)) {
            opts.thetaStart = 0;
        }
        this.thetaStart = opts.thetaStart;

        if (!('thetaLength' in opts)) {
            opts.thetaLength = 360;
        }
        this.thetaLength = opts.thetaLength;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}



class Dodecahedron {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'dodecahedron';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}



class Octahedron {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'octahedron';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}


class Tetrahedron {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'tetrahedron';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}


class Circle {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'circle';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        if (!('segments' in opts)) {
            opts.segments = 32;
        }
        this.segments = opts.segments;

        if (!('thetaStart' in opts)) {
            opts.thetaStart = 0;
        }
        this.thetaStart = opts.thetaStart;

        if (!('thetaLength' in opts)) {
            opts.thetaLength = 360;
        }
        this.thetaLength = opts.thetaLength;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class Cone {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'cone';

        // setup geometry parameters
        if (!('height' in opts)) {
            opts.height = 2;
        }
        this.height = opts.height;

        if (!('openEnded' in opts)) {
            opts.openEnded = false;
        }
        this.openEnded = opts.openEnded;

        if (!('radiusBottom' in opts)) {
            opts.radiusBottom = 1;
        }
        this.radiusBottom = opts.radiusBottom;

        if (!('radiusTop' in opts)) {
            opts.radiusTop = 1;
        }
        this.radiusTop = opts.radiusTop;

        if (!('segmentsRadial' in opts)) {
            opts.segmentsRadial = 36;
        }
        this.segmentsRadial = opts.segmentsRadial;

        if (!('segmentsHeight' in opts)) {
            opts.segmentsHeight = 18;
        }
        this.segmentsHeight = opts.segmentsHeight;

        if (!('thetaStart' in opts)) {
            opts.thetaStart = 0;
        }
        this.thetaStart = opts.thetaStart;

        if (!('thetaLength' in opts)) {
            opts.thetaLength = 360;
        }
        this.thetaLength = opts.thetaLength;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class Cylinder {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'cylinder';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        if (!('height' in opts)) {
            opts.height = 2;
        }
        this.height = opts.height;

        if (!('segmentsRadial' in opts)) {
            opts.segmentsRadial = 36;
        }
        this.segmentsRadial = opts.segmentsRadial;

        if (!('segmentsHeight' in opts)) {
            opts.segmentsHeight = 18;
        }
        this.segmentsHeight = opts.segmentsHeight;

        if (!('openEnded' in opts)) {
            opts.openEnded = false;
        }
        this.openEnded = opts.openEnded;

        if (!('thetaStart' in opts)) {
            opts.thetaStart = 0;
        }
        this.thetaStart = opts.thetaStart;

        if (!('thetaLength' in opts)) {
            opts.thetaLength = 360;
        }
        this.thetaLength = opts.thetaLength;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class Ring {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'ring';

        // setup geometry parameters
        if (!('radiusInner' in opts)) {
            opts.radiusInner = 0.5;
        }
        this.radiusInner = opts.radiusInner;

        if (!('radiusOuter' in opts)) {
            opts.radiusOuter = 1;
        }
        this.radiusOuter = opts.radiusOuter;

        if (!('segmentsTheta' in opts)) {
            opts.segmentsTheta = 32;
        }
        this.segmentsTheta = opts.segmentsTheta;

        if (!('segmentsPhi' in opts)) {
            opts.segmentsPhi = 8;
        }
        this.segmentsPhi = opts.segmentsPhi;

        if (!('thetaStart' in opts)) {
            opts.thetaStart = 0;
        }
        this.thetaStart = opts.thetaStart;

        if (!('thetaLength' in opts)) {
            opts.thetaLength = 360;
        }
        this.thetaLength = opts.thetaLength;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class Torus {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'torus';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        if (!('radiusTubular' in opts)) {
            opts.radiusTubular = 0.2;
        }
        this.radiusTubular = opts.radiusTubular;

        if (!('segmentsRadial' in opts)) {
            opts.segmentsRadial = 36;
        }
        this.segmentsRadial = opts.segmentsRadial;

        if (!('segmentsTubular' in opts)) {
            opts.segmentsTubular = 32;
        }
        this.segmentsTubular = opts.segmentsTubular;

        if (!('arc' in opts)) {
            opts.arc = 360;
        }
        this.arc = opts.arc;

        // set geometry
        setGeometry(this);

        // set material
        processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}

class TorusKnot {

    constructor(opts) {
        // store desired options
        setEntityOptions(opts, this);

        // store what kind of primitive shape this entity is
        this.prim = 'torusKnot';

        // setup geometry parameters
        if (!('radius' in opts)) {
            opts.radius = 1;
        }
        this.radius = opts.radius;

        if (!('radiusTubular' in opts)) {
            opts.radiusTubular = 0.2;
        }
        this.radiusTubular = opts.radiusTubular;

        if (!('segmentsRadial' in opts)) {
            opts.segmentsRadial = 36;
        }
        this.segmentsRadial = opts.segmentsRadial;

        if (!('segmentsTubular' in opts)) {
            opts.segmentsTubular = 32;
        }
        this.segmentsTubular = opts.segmentsTubular;

        if (!('p' in opts)) {
            opts.p = 2;
        }
        this.p = opts.p;

        if (!('q' in opts)) {
            opts.q = 3;
        }
        this.q = opts.q;

        // set geometry
        setGeometry(this);

        // set material
				processMaterial(this);
        setMaterial(this);

        // set scale
        setScale(this.opts, this);

        // set position
        setPosition(this.opts, this);

        // set rotation
        setRotation(this.opts, this);

        // set visibility
        setVisibility(this.opts, this);

        // set click handler
        setClickHandlers(this);

        // init common setters / getters
        initializerSettersAndGetters(this);
    }

}



function setClickHandlers(entity) {
    if ('clickFunction' in entity.opts) {
        entity.clickFunction = entity.opts.clickFunction;
        entity.tag.eRef = entity;
        entity.tag.setAttribute('generic-interaction-handler', '');
    }
    if ('upFunction' in entity.opts) {
        entity.upFunction = entity.opts.upFunction;
        entity.tag.eRef = entity;
        entity.tag.setAttribute('generic-interaction-handler', '');
    }
    if ('enterFunction' in entity.opts) {
        entity.enterFunction = entity.opts.enterFunction;
        entity.tag.eRef = entity;
        entity.tag.setAttribute('generic-interaction-handler', '');
    }
    if ('leaveFunction' in entity.opts) {
        entity.leaveFunction = entity.opts.leaveFunction;
        entity.tag.eRef = entity;
        entity.tag.setAttribute('generic-interaction-handler', '');
    }
}


function setEntityOptions(opts, entity) {
    // store desired options
    if (opts == undefined) {
        opts = {};
    }
    entity.opts = opts;

    // create a tag for this entity
    entity.tag = document.createElement('a-entity');
    entity.tag.id = uniqueId();
    entity.id = entity.tag.id;

    // setup a "children" array
    entity.children = [];
}

/**
 * quick & dirty unique ID generator: https://gist.github.com/garvin/0266789815689e2b81c931f8113b0eec
 * Creates a string that can be used for dynamic id attributes
 * Example: "id-so7567s1pcpojemi"
 * @returns {string}
 */
var uniqueId = function() {
    return 'id-' + Math.random().toString(36).substr(2, 16);
};


function setGeometry(entity) {
    if (entity.prim == 'sphere') {
        entity.tag.setAttribute('geometry', 'primitive: sphere; radius: ' + entity.radius + '; segmentsWidth: ' + entity.segmentsWidth + '; segmentsHeight: ' + entity.segmentsHeight + '; phiStart: ' + entity.phiStart + '; phiLength: ' + entity.phiLength + '; thetaStart: ' + entity.thetaStart + '; thetaLength: ' + entity.thetaLength);
    } else if (entity.prim == 'circle') {
        entity.tag.setAttribute('geometry', 'primitive: circle; radius: ' + entity.radius + '; segments: ' + entity.segments + '; thetaStart: ' + entity.thetaStart + '; thetaLength: ' + entity.thetaLength);
    } else if (entity.prim == 'ring') {
        entity.tag.setAttribute('geometry', 'primitive: ring; radiusInner: ' + entity.radiusInner + '; radiusOuter: ' + entity.radiusOuter + '; segmentsTheta: ' + entity.segmentsTheta + '; segmentsPhi: ' + entity.segmentsPhi + '; thetaStart: ' + entity.thetaStart + '; thetaLength: ' + entity.thetaLength);
    } else if (entity.prim == 'cone') {
        entity.tag.setAttribute('geometry', 'primitive: cone; height: ' + entity.height + '; openEnded: ' + entity.openEnded + '; radiusBottom: ' + entity.radiusBottom + '; radiusTop: ' + entity.radiusTop + '; segmentsRadial: ' + entity.segmentsRadial + '; segmentsHeight: ' + entity.segmentsHeight + '; thetaStart: ' + entity.thetaStart + '; thetaLength: ' + entity.thetaLength);
    } else if (entity.prim == 'torus') {
        entity.tag.setAttribute('geometry', 'primitive: torus; radius: ' + entity.radius + '; radiusTubular: ' + entity.radiusTubular + '; segmentsRadial: ' + entity.segmentsRadial + '; segmentsTubular: ' + entity.segmentsTubular + '; arc: ' + entity.arc);
    } else if (entity.prim == 'torusKnot') {
        entity.tag.setAttribute('geometry', 'primitive: torusKnot; radius: ' + entity.radius + '; radiusTubular: ' + entity.radiusTubular + '; segmentsRadial: ' + entity.segmentsRadial + '; segmentsTubular: ' + entity.segmentsTubular + '; p: ' + entity.p + '; q: ' + entity.q);
    } else if (entity.prim == 'cylinder') {
        entity.tag.setAttribute('geometry', 'primitive: cylinder; radius: ' + entity.radius + '; height: ' + entity.height + '; openEnded: ' + entity.openEnded + '; segmentsRadial: ' + entity.segmentsRadial + '; segmentsHeight: ' + entity.segmentsHeight + '; thetaStart: ' + entity.thetaStart + '; thetaLength: ' + entity.thetaLength);
    } else if (entity.prim == 'box') {
        entity.tag.setAttribute('geometry', 'primitive: box; depth: ' + entity.depth + '; height: ' + entity.height + '; width: ' + entity.width);
    } else if (entity.prim == 'plane') {
        entity.tag.setAttribute('geometry', 'primitive: plane; height: ' + entity.height + '; width: ' + entity.width);
    } else if (entity.prim == 'octahedron' || entity.prim == 'tetrahedron' || entity.prim == 'dodecahedron') {
        entity.tag.setAttribute('geometry', 'primitive: ' + entity.prim + '; radius: ' + entity.radius);
    }
}


function processMaterial(entity) {
    // handle common attributes
    var opts = entity.opts;

    if (!('opacity' in opts)) {
        opts.opacity = 1.0;
    }
    entity.opacity = opts.opacity;

    if (!('transparent' in opts)) {
        opts.transparent = false;
    }
    entity.transparent = opts.transparent;

    if (!('shader' in opts)) {
        opts.shader = 'standard';
    }
    entity.shader = opts.shader;

    if (!('side' in opts)) {
        opts.side = 'front';
    }
    entity.side = opts.side;

    if (!('metalness' in opts)) {
        opts.metalness = 0.1;
    }
    entity.metalness = opts.metalness;

    if (!('roughness' in opts)) {
        opts.roughness = 0.5;
    }
    entity.roughness = opts.roughness;

    if (!('repeatX' in opts)) {
        opts.repeatX = 1;
    }
    entity.repeatX = opts.repeatX;

    if (!('repeatY' in opts)) {
        opts.repeatY = 1;
    }
    entity.repeatY = opts.repeatY;

    // set color values
    if ('red' in opts) {
        entity.red = parseInt(opts.red);
    } else {
        entity.red = 255;
    }
    if ('green' in opts) {
        entity.green = parseInt(opts.green);
    } else {
        entity.green = 255;
    }
    if ('blue' in opts) {
        entity.blue = parseInt(opts.blue);
    } else {
        entity.blue = 255;
    }

    if ('asset' in opts) {
        entity.asset = opts.asset;
    } else {
        entity.asset = 'None';
    }
}

function setMaterial(entity) {
    // set tag
    if (entity.asset == 'None') {
        entity.tag.setAttribute('material', 'opacity: ' + entity.opacity + '; transparent: ' + entity.transparent + '; shader: ' + entity.shader + '; side: ' + entity.side + '; repeat: ' + entity.repeatX + " " + entity.repeatY + '; color: rgb(' + entity.red + ',' + entity.green + ',' + entity.blue + ')');
    } else {
        entity.tag.setAttribute('material', 'opacity: ' + entity.opacity + '; transparent: ' + entity.transparent + '; shader: ' + entity.shader + '; side: ' + entity.side + '; src: #' + entity.asset + '; repeat: ' + entity.repeatX + " " + entity.repeatY + '; color: rgb(' + entity.red + ',' + entity.green + ',' + entity.blue + ')');
    }

    // TODO: Text
    // should this element also have a textual component?

}



function setLight(opts, entity) {
    if (!('color' in opts)) {
        opts.color = '#fff';
    }
    if (!('intensity' in opts)) {
        opts.intensity = 1.0;
    }
    if (!('type' in opts)) {
        opts.type = 'directional';
    }
    if (!('groundColor' in opts)) {
        opts.groundColor = '#fff';
    }
    if (!('decay' in opts)) {
        opts.decay = 1.0;
    }
    if (!('distance' in opts)) {
        opts.distance = 0.0;
    }
    if (!('angle' in opts)) {
        opts.angle = 60;
    }
    if (!('penumbra' in opts)) {
        opts.penumbra = 0.0;
    }
    if (!('target' in opts)) {
        opts.target = 'null';
    }

    if (opts.type == 'directional') {
        entity.tag.setAttribute('light', 'color: ' + opts.color + '; intensity: ' + opts.intensity + '; type: ' + opts.type);
    } else if (opts.type == 'ambient') {
        entity.tag.setAttribute('light', 'color: ' + opts.color + '; intensity: ' + opts.intensity + '; type: ' + opts.type);
    } else if (opts.type == 'hemisphere') {
        entity.tag.setAttribute('light', 'color: ' + opts.color + '; intensity: ' + opts.intensity + '; type: ' + opts.type + '; groundColor: ' + opts.groundColor);
    } else if (opts.type == 'point') {
        entity.tag.setAttribute('light', 'color: ' + opts.color + '; intensity: ' + opts.intensity + '; type: ' + opts.type + '; distance: ' + opts.distance + '; decay: ' + opts.decay);
    } else if (opts.type == 'spot') {
        entity.tag.setAttribute('light', 'color: ' + opts.color + '; intensity: ' + opts.intensity + '; type: ' + opts.type + '; angle: ' + opts.angle + '; decay: ' + opts.decay + '; distance: ' + opts.distance + '; penumbra: ' + opts.penumbra + '; target: ' + opts.target);
    }
}


function setScale(opts, entity) {
    // set scale
    if ('scaleX' in opts) {
        entity.scaleX = opts.scaleX;
    } else {
        entity.scaleX = 1;
    }

    if ('scaleY' in opts) {
        entity.scaleY = opts.scaleY;
    } else {
        entity.scaleY = 1;
    }

    if ('scaleZ' in opts) {
        entity.scaleZ = opts.scaleZ;
    } else {
        entity.scaleZ = 1;
    }

    // set tag attributes
    entity.tag.setAttribute('scale', entity.scaleX + ' ' + entity.scaleY + ' ' + entity.scaleZ);
}


function setPosition(opts, entity) {
    // set position
    if ('x' in opts) {
        entity.x = opts.x;
    } else {
        entity.x = 0;
    }
    if ('y' in opts) {
        entity.y = opts.y;
    } else {
        entity.y = 0;
    }
    if ('z' in opts) {
        entity.z = opts.z;
    } else {
        entity.z = 0;
    }

    // set tag attributes
    entity.tag.setAttribute('position', entity.x + ' ' + entity.y + ' ' + entity.z);
}


function setRotation(opts, entity) {
    // set rotation
    if ('rotationX' in opts) {
        entity.rotationX = opts.rotationX;
    } else {
        entity.rotationX = 0;
    }
    if ('rotationY' in opts) {
        entity.rotationY = opts.rotationY;
    } else {
        entity.rotationY = 0;
    }
    if ('rotationZ' in opts) {
        entity.rotationZ = opts.rotationZ;
    } else {
        entity.rotationZ = 0;
    }

    // set tag attributes
    entity.tag.setAttribute('rotation', entity.rotationX + ' ' + entity.rotationY + ' ' + entity.rotationZ);
}


function setVisibility(opts, entity) {
    // set visibility
    if ('visible' in opts) {
        entity.visible = opts.visible;
        entity.tag.setAttribute('visible', opts.visible);
    } else {
        entity.visible = true;
        entity.tag.setAttribute('visible', true);
    }
}


function initializerSettersAndGetters(entity) {
    entity.getWorldPosition = function() {
        var vectorHUD = new THREE.Vector3();
        vectorHUD.setFromMatrixPosition(this.tag.object3D.matrixWorld);
        return vectorHUD;
    }

    entity.nudge = function(nx, ny, nz) {
        this.x += nx;
        this.y += ny;
        this.z += nz;

        this.tag.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    entity.constrainPosition = function(xmin, xmax, ymin, ymax, zmin, zmax) {
        if (this.x < xmin) {
            this.x = xmin;
        }
        if (this.y < ymin) {
            this.y = ymin;
        }
        if (this.z < zmin) {
            this.z = zmin;
        }
        if (this.x > xmax) {
            this.x = xmax;
        }
        if (this.y > ymax) {
            this.y = ymax;
        }
        if (this.z > zmax) {
            this.z = zmax;
        }

        this.tag.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    entity.setPosition = function(nx, ny, nz) {
        this.x = nx;
        this.y = ny;
        this.z = nz;

        this.tag.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    entity.getX = function() {
        return this.x;
    }

    entity.getY = function() {
        return this.y;
    }

    entity.getZ = function() {
        return this.z;
    }

    entity.setX = function(x) {
        this.x = x;

        this.tag.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    entity.setY = function(y) {
        this.y = y;

        this.tag.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    entity.setZ = function(z) {
        this.z = z;

        this.tag.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }


    entity.setRotation = function(nx, ny, nz) {
        this.rotationX = nx;
        this.rotationY = ny;
        this.rotationZ = ny;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.rotateX = function(nx) {
        this.rotationX = nx;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.rotateY = function(ny) {
        this.rotationY = ny;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.rotateZ = function(nz) {
        this.rotationZ = nz;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.spinX = function(nx) {
        this.rotationX += nx;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.spinY = function(ny) {
        this.rotationY += ny;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.spinZ = function(nz) {
        this.rotationZ += nz;

        this.tag.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    }

    entity.getRotationX = function() {
        return this.rotationX;
    }

    entity.getRotationY = function() {
        return this.rotationY;
    }

    entity.getRotationZ = function() {
        return this.rotationZ;
    }

    entity.hide = function() {
        this.visible = false;

        this.tag.setAttribute('visible', this.visible);
    }

    entity.show = function() {
        this.visible = true;

        this.tag.setAttribute('visible', this.visible);
    }

    entity.toggleVisibility = function() {
        this.visible = !this.visible;

        this.tag.setAttribute('visible', this.visible);
    }

    entity.getVisibility = function() {
        return this.visible;
    }

    entity.getScale = function() {
        var s = {};
        s.x = this.scaleX;
        s.y = this.scaleY;
        s.z = this.scaleZ;
        return s;
    }

    entity.getScaleX = function() {
        return this.scaleX;
    }

    entity.getScaleY = function() {
        return this.scaleY;
    }

    entity.getScaleZ = function() {
        return this.scaleZ;
    }

    entity.setScale = function(x, y, z) {
        this.scaleX = x;
        this.scaleY = y;
        this.scaleZ = z;

        this.tag.setAttribute('scale', this.scaleX + ' ' + this.scaleY + ' ' + this.scaleZ);
    }

    entity.setScaleX = function(sx) {
        this.scaleX = sx;

        this.tag.setAttribute('scale', this.scaleX + ' ' + this.scaleY + ' ' + this.scaleZ);
    }

    entity.setScaleY = function(sy) {
        this.scaleY = sy;

        this.tag.setAttribute('scale', this.scaleX + ' ' + this.scaleY + ' ' + this.scaleZ);
    }

    entity.setScaleZ = function(sz) {
        this.scaleZ = sz;

        this.tag.setAttribute('scale', this.scaleX + ' ' + this.scaleY + ' ' + this.scaleZ);
    }


    // material getters & setters
    entity.setColor = function(r, g, b) {
        if ('red' in this && 'green' in this && 'blue' in this) {
            this.red = parseInt(r);
            this.green = parseInt(g);
            this.blue = parseInt(b);

            setMaterial(this);
        }
    }

    entity.setRed = function(r) {
        if ('red' in this) {
            this.red = parseInt(r);
            setMaterial(this);
        }
    }

    entity.setGreen = function(g) {
        if ('green' in this) {
            this.green = parseInt(g);
            setMaterial(this);
        }
    }

    entity.setBlue = function(b) {
        if ('blue' in this) {
            this.blue = parseInt(b);
            setMaterial(this);
        }
    }

    entity.getRed = function() {
        if ('red' in this) {
            return this.red;
        }
        return "none";
    }

    entity.getGreen = function() {
        if ('green' in this) {
            return this.green;
        }
        return "none";
    }

    entity.getBlue = function() {
        if ('blue' in this) {
            return this.blue;
        }
        return "none";
    }

    entity.getOpacity = function() {
        if ('opacity' in this) {
            return this.opacity;
        }
        return "none";
    }
    entity.setOpacity = function(v) {
        if ('opacity' in this) {
            this.opacity = v;
            setMaterial(this);
        }
    }

    entity.getTransparent = function() {
        if ('transparent' in this) {
            return this.transparent;
        }
        return "none";
    }
    entity.setTransparent = function(v) {
        if ('transparent' in this) {
            this.transparent = v;
            setMaterial(this);
        }
    }

    entity.getShader = function() {
        if ('shader' in this) {
            return this.shader;
        }
        return "none";
    }
    entity.setShader = function(v) {
        if ('shader' in this) {
            this.shader = v;
            setMaterial(this);
        }
    }

    entity.getSide = function() {
        if ('side' in this) {
            return this.side;
        }
        return "none";
    }
    entity.setSide = function(v) {
        if ('side' in this) {
            this.side = v;
            setMaterial(this);
        }
    }

    entity.getMetalness = function() {
        if ('metalness' in this) {
            return this.metalness;
        }
        return "none";
    }
    entity.setMetalness = function(v) {
        if ('metalness' in this) {
            this.metalness = v;
            setMaterial(this);
        }
    }

    entity.getRoughness = function() {
        if ('roughness' in this) {
            return this.roughness;
        }
        return "none";
    }
    entity.setRoughness = function(v) {
        if ('roughness' in this) {
            this.roughness = v;
            setMaterial(this);
        }
    }

    entity.getRepeatX = function() {
        if ('repeatX' in this) {
            return this.repeatX;
        }
        return "none";
    }
    entity.setRepeatX = function(v) {
        if ('repeatX' in this) {
            this.repeatX = v;
            setMaterial(this);
        }
    }

    // need to add repeatY zzz

    entity.getAsset = function() {
        if ('asset' in this) {
            return this.asset;
        }
        return "none";
    }
    entity.setAsset = function(v) {
        if ('asset' in this) {
            this.asset = v;
            setMaterial(this);
        }
    }


    entity.getOpacity = function() {
        return this.opacity;
    }




    // geometry getters & setters
    entity.getProperty = function(prop) {
        if (prop in this) {
            return this[prop];
        }
        return 'none';
    }

    entity.setWidth = function(nw) {
        if ('width' in this) {
            this.width = nw;
            setGeometry(this);
        }
    }

    entity.setDepth = function(nd) {
        if ('depth' in this) {
            this.depth = nd;
            setGeometry(this);
        }
    }

    entity.setHeight = function(nh) {
        if ('height' in this) {
            this.height = nh;
            setGeometry(this);
        }
    }

    entity.getWidth = function() {
        if ('width' in this) {
            return this.width;
        }
        return 'none';
    }

    entity.getHeight = function() {
        if ('height' in this) {
            return this.height;
        }
        return 'none';
    }

    entity.getDepth = function() {
        if ('depth' in this) {
            return this.depth;
        }
        return 'none';
    }

    entity.getRadius = function() {
        if ('radius' in this) {
            return this.radius;
        }
        return 'none';
    }

    entity.setRadius = function(r) {
        if ('radius' in this) {
            this.radius = r;
            setGeometry(this);
        }
    }

    entity.changeRadius = function(r) {
        if ('radius' in this) {
            this.radius += r;
            setGeometry(this);
        }
    }


    entity.getSegmentsWidth = function() {
        if ('segmentsWidth' in this) {
            return this.segmentsWidth;
        }
        return "none";
    }
    entity.getSegmentsHeight = function() {
        if ('segmentsHeight' in this) {
            return this.segmentsHeight;
        }
        return "none";
    }
    entity.getPhiStart = function() {
        if ('phiStart' in this) {
            return this.phiStart;
        }
        return "none";
    }
    entity.getPhiLength = function() {
        if ('phiLength' in this) {
            return this.phiLength;
        }
        return "none";
    }
    entity.getThetaStart = function() {
        if ('thetaStart' in this) {
            return this.thetaStart;
        }
        return "none";
    }
    entity.getThetaLength = function() {
        if ('thetaLength' in this) {
            return this.thetaLength;
        }
        return "none";
    }
    entity.getArc = function() {
        if ('arc' in this) {
            return this.arc;
        }
        return "none";
    }

    entity.setSegmentsWidth = function(v) {
        if ('segmentsWidth' in this) {
            this.segmentsWidth = v;
            setGeometry(this);
        }
    }
    entity.setSegmentsHeight = function(v) {
        if ('segmentsHeight' in this) {
            this.segmentsHeight = v;
            setGeometry(this);
        }
    }
    entity.setPhiStart = function(v) {
        if ('phiStart' in this) {
            this.phiStart = v;
            setGeometry(this);
        }
    }
    entity.setPhiLength = function(v) {
        if ('phiLength' in this) {
            this.phiLength = v;
            setGeometry(this);
        }
    }
    entity.setThetaStart = function(v) {
        if ('thetaStart' in this) {
            this.thetaStart = v;
            setGeometry(this);
        }
    }
    entity.setThetaLength = function(v) {
        if ('thetaLength' in this) {
            this.thetaLength = v;
            setGeometry(this);
        }
    }
    entity.getSegments = function() {
        if ('segments' in this) {
            return this.segments;
        }
        return "none";
    }
    entity.setSegments = function(v) {
        if ('segments' in this) {
            this.segments = v;
            setGeometry(this);
        }
    }
    entity.getOpenEnded = function() {
        if ('openEnded' in this) {
            return this.openEnded;
        }
        return "none";
    }
    entity.getRadiusBottom = function() {
        if ('radiusBottom' in this) {
            return this.radiusBottom;
        }
        return "none";
    }
    entity.getRadiusTop = function() {
        if ('radiusTop' in this) {
            return this.radiusTop;
        }
        return "none";
    }
    entity.getRadiusInner = function() {
        if ('radiusInner' in this) {
            return this.radiusInner;
        }
        return "none";
    }
    entity.getRadiusOuter = function() {
        if ('radiusOuter' in this) {
            return this.radiusOuter;
        }
        return "none";
    }
    entity.getRadiusTubular = function() {
        if ('radiusTubular' in this) {
            return this.radiusTubular;
        }
        return "none";
    }
    entity.getSegmentsRadial = function() {
        if ('segmentsRadial' in this) {
            return this.segmentsRadial;
        }
        return "none";
    }
    entity.getSegmentsTubular = function() {
        if ('segmentsTubular' in this) {
            return this.segmentsTubular;
        }
        return "none";
    }
    entity.getSegmentsTheta = function() {
        if ('segmentsTheta' in this) {
            return this.segmentsTheta;
        }
        return "none";
    }
    entity.getSegmentsPhi = function() {
        if ('segmentsPhi' in this) {
            return this.segmentsPhi;
        }
        return "none";
    }
    entity.getP = function() {
        if ('p' in this) {
            return this.p;
        }
        return "none";
    }
    entity.getQ = function() {
        if ('q' in this) {
            return this.q;
        }
        return "none";
    }
    entity.setOpenEnded = function(v) {
        if ('openEnded' in this) {
            this.openEnded = v;
            setGeometry(this);
        }
    }
    entity.setRadiusBottom = function(v) {
        if ('radiusBottom' in this) {
            this.radiusBottom = v;
            setGeometry(this);
        }
    }
    entity.setRadiusTop = function(v) {
        if ('radiusTop' in this) {
            this.radiusTop = v;
            setGeometry(this);
        }
    }
    entity.setRadiusInner = function(v) {
        if ('radiusInner' in this) {
            this.radiusInner = v;
            setGeometry(this);
        }
    }
    entity.setRadiusOuter = function(v) {
        if ('radiusOuter' in this) {
            this.radiusOuter = v;
            setGeometry(this);
        }
    }
    entity.setRadiusTubular = function(v) {
        if ('radiusTubular' in this) {
            this.radiusTubular = v;
            setGeometry(this);
        }
    }
    entity.setSegmentsRadial = function(v) {
        if ('segmentsRadial' in this) {
            this.segmentsRadial = v;
            setGeometry(this);
        }
    }
    entity.setSegmentsTubular = function(v) {
        if ('segmentsTubular' in this) {
            this.segmentsTubular = v;
            setGeometry(this);
        }
    }
    entity.setSegmentsTheta = function(v) {
        if ('segmentsTheta' in this) {
            this.segmentsTheta = v;
            setGeometry(this);
        }
    }
    entity.setSegmentsPhi = function(v) {
        if ('segmentsPhi' in this) {
            this.segmentsPhi = v;
            setGeometry(this);
        }
    }
    entity.setArc = function(v) {
        if ('arc' in this) {
            this.arc = v;
            setGeometry(this);
        }
    }
    entity.setP = function(v) {
        if ('p' in this) {
            this.p = v;
            setGeometry(this);
        }
    }
    entity.setQ = function(v) {
        if ('q' in this) {
            this.q = v;
            setGeometry(this);
        }
    }



    // child management
    entity.addChild = function(child) {
        // append to our child array
        this.children.push(child);

        // append to our DOM element
        this.tag.appendChild(child.tag);
    }
    entity.add = entity.addChild

    entity.removeChild = function(child) {
        // first ensure that the item is actually a child
        var isChild = false;
        for (var i = 0; i < this.children.length; i++) {
            if (this.children[i] == child) {
                isChild = true;
                break;
            }
        }

        if (isChild) {
            this.children.splice(i, 1);
            this.tag.removeChild(child.tag);
        }
    }
    entity.remove = entity.removeChild



    entity.getChildren = function() {
        var returnChildren = [];
        for (var i = 0; i < this.children.length; i++) {
            returnChildren.push(this.children[i]);
        }

        return returnChildren;
    }



    // update texture (for canvas textures)
    entity.updateTexture = function() {
        try {
            this.tag.object3DMap.mesh.material.map.needsUpdate = true;
        } catch (e) {}
    }

}







function addToWorld(entity) {
    document.getElementById('VRScene').appendChild(entity.tag);
}

function removeFromWorld(entity) {
    document.getElementById('VRScene').removeChild(entity.tag);
}




class World {

    constructor(id, mouseOrGaze = 'mouse', lookControls = 'mouseClick') {
        console.log("A-FrameP5 v2.0 (Craig Kapp, 2017-2020)");

        if (id == undefined) {
            id = "VRScene";
        }
        this.scene = document.getElementById(id);

        // reference the three.js scene directly
        this.threeSceneReference = this.scene.object3D;

        // allow the user to leave base Y plane using WASD
        this.flying = false;

        // set up our camera
        this.camera = new Camera(mouseOrGaze, lookControls);
        this.scene.appendChild(this.camera.holder);

        // control semaphores
        this.slideMode = {
            enabled: false
        };

        // set up internal update loop
        this.frameCount = 0;
        var _this = this;
        var _interval = setInterval(function() {

            _this.frameCount++;

            _this.camera.storePosition(_this.camera.holder.getAttribute('position'))
            _this.camera.storeRotation(_this.camera.holder.getAttribute('rotation'))

            // slideToObject
            if (_this.slideMode.enabled) {
                // nudge the camera in this direction
                _this.camera.nudgePosition(_this.slideMode.slideXInc, _this.slideMode.slideYInc, _this.slideMode.slideZInc);

                // mark this step
                _this.slideMode.currentStep++;

                // have we arrived?
                if (_this.slideMode.currentStep >= _this.slideMode.steps) {
                    _this.slideMode.enabled = false;
                }
            }

        }, 10); // end internal update loop

    } // end constructor

    setFlying(v) {
        this.flying = v;
        this.camera.setWASD(v);
    }
    getFlying() {
        return this.flying;
    }
    add(entity) {
        this.scene.appendChild(entity.tag);
    }
    addChild(entity) {
        this.add(entity);
    }
    remove(entity) {
        this.scene.removeChild(entity.tag);
    }
    removeChild(entity) {
        this.remove(entity);
    }

    getUserPosition() {
        return {
            x: this.camera.getX(),
            y: this.camera.getY(),
            z: this.camera.getZ()
        };
    }

    setUserPosition(x, y, z) {
        this.camera.setPosition(x, y, z);
    }

    getUserRotation() {
        //return { x:this.camera.rotationX*180/Math.PI, y:this.camera.rotationY*180/Math.PI, z:this.camera.rotationZ*180/Math.PI};
        return {
            x: this.camera.rotationX,
            y: this.camera.rotationY,
            z: this.camera.rotationZ
        };
    }

    moveUserForward(d) {
        var vectorHUD = new THREE.Vector3();
        vectorHUD.setFromMatrixPosition(this.camera.cursor.tag.object3D.matrixWorld);

        var vectorCamera = this.getUserPosition();

        var xDiff = vectorHUD.x - vectorCamera.x;
        var yDiff = vectorHUD.y - vectorCamera.y;
        var zDiff = vectorHUD.z - vectorCamera.z;

        if (this.flying) {
            this.camera.nudgePosition(xDiff * d, yDiff * d, zDiff * d);
        } else {
            this.camera.nudgePosition(xDiff * d, 0, zDiff * d);
        }
    }

    teleportToObject(element) {
        this.camera.setPosition(element.getX(), element.getY(), element.getZ());
    }

    slideToObject(element, time) {

        // only slide if we aren't already sliding
        if (this.slideMode.enabled == false) {
            // compute distance in all axes
            this.slideMode.xDistance = element.getX() - this.camera.getX();
            this.slideMode.yDistance = element.getY() - this.camera.getY();
            this.slideMode.zDistance = element.getZ() - this.camera.getZ();

            // compute necessary # of steps
            this.slideMode.steps = parseInt(time / 10);
            this.slideMode.currentStep = 0;

            // compute increments
            this.slideMode.slideXInc = this.slideMode.xDistance / this.slideMode.steps;
            this.slideMode.slideYInc = this.slideMode.yDistance / this.slideMode.steps;
            this.slideMode.slideZInc = this.slideMode.zDistance / this.slideMode.steps;

            // enter into slide mode
            this.slideMode.enabled = true;
        }
    }

    setMouseControls() {
        this.camera.setMouseControls();
    }

    setGazeControls() {
        this.camera.setGazeControls();
    }

    hideCursor() {
        this.camera.cursor.hide();
    }

    showCursor() {
        this.camera.cursor.show();
    }

    removeDefaultWorldLighting() {
        let allLights = document.querySelectorAll('a-entity[light]');
        for (let i = 0; i < allLights.length; i++) {
            try {
                allLights[i].parentElement.removeChild(allLights[i])
            } catch (err) {}
        }
    }

}



class Camera {

    constructor(mouseOrGaze, lookControls) {

        // construct an entity holder
        this.holder = document.createElement('a-entity');
        this.holder.setAttribute('camera', '');

        // set position of camera
        this.x = 0;
        this.y = 1;
        this.z = 5;
        this.holder.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);

        // set rotation of camera
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;

        // set controls on camera
        console.log(lookControls)
        if (lookControls == 'mouseMove') {
          console.log("here");
          this.holder.setAttribute('look-controls-mousemove', '');
        }
        else {
          this.holder.setAttribute('look-controls', '');
        }

        // default to disallow flying
        this.setWASD(false);

        // construct our cursor graphic
        this.cursor = new Ring({
            x: 0,
            y: 0,
            z: -1.0,
            radiusInner: 0.02,
            radiusOuter: 0.03,
            side: 'double',
            red: 0,
            green: 0,
            blue: 0,
            shader: 'flat',
            opacity: 0.5
        });

        // default to mouse controls
        if (mouseOrGaze == 'gaze') {
            this.setGazeControls();
        } else {
            this.setMouseControls();
        }

        // add camera to our entity holder
        this.holder.appendChild(this.cursor.tag);
    }

    setMouseControls() {
        this.cursor.tag.setAttribute('cursor', 'rayOrigin: mouse');
        this.cursor.hide();
    }

    setGazeControls() {
        this.cursor.tag.setAttribute('cursor', 'fuse: false');
        this.cursor.show();
    }

    setWASD(flying) {
        this.holder.setAttribute('wasd-controls', 'fly: ' + flying);
    }

    // setters & getters
    setPosition(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.holder.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    storePosition(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
    }

    storeRotation(v) {
        this.rotationX = v.x;
        this.rotationY = v.y;
        this.rotationZ = v.z;
    }

    nudgePosition(x, y, z) {
        this.x = this.x + x;
        this.y = this.y + y;
        this.z = this.z + z;
        this.holder.setAttribute('position', this.x + ' ' + this.y + ' ' + this.z);
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    getZ() {
        return this.z;
    }

    /*
    this.rotateX = function(v) {
    	console.log("rotX")
    	this.storeRotation({x:this.rotationX+v, y:this.rotationY, z:this.rotationZ})
    	this.holder.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    	this.holder.object3D.rotateX( radians(v) );
    }
    this.rotateY = function(v) {
    	console.log("rotY")
    	this.storeRotation({x:this.rotationX, y:this.rotationY+v, z:this.rotationZ})
    	this.holder.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    	this.holder.object3D.rotateY( radians(v) );
    }
    this.rotateZ = function(v) {
    	console.log("rotZ")
    	this.storeRotation({x:this.rotationX, y:this.rotationY, z:this.rotationZ+v})
    	this.holder.setAttribute('rotation', this.rotationX + ' ' + this.rotationY + ' ' + this.rotationZ);
    	this.holder.object3D.rotateZ( radians(v) );
    }
    */
}
