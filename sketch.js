var world;
var rings;
var textholder;
var cockpitImage
var elevation
var state = 'playing'
var plane1, plane2
var torusArray = []
var score = 0
var user
var sound


function preload(){
  sound = loadSound('point.mp3')
}


function setup() {
      noCanvas();
      world = new World('VRScene', 'gaze');
      world.setFlying(true)
      container = new Container3D({});


      container2 = new Container3D({}); // container for tarmac and ground
      plane1 = new Plane({ // tarmac
            x: 0,
            y: 0.1,
            width: 10,
            height: 100,
            asset: 'stonebrick',
            repeatX: 10,
            repeatY: 100,
            rotationX: -90
            });
      container2.add(plane1);
      plane2 = new Plane({ // regular ground
            width: 1000,
            height: 1000,
            rotationX: -90
            });
      container2.add(plane2);

      world.add(container2)


      // create rings
      for (var i=0; i<10; i++){
        let temp = new TorusClass()
        torusArray.push(temp)
      }


      // add image to HUD
      cockpitImage = new Plane({
        x: 0,
        y: -.5,
        z: 0,
        scaleX: 3,
        scaleY: 3,
        transparent: true,
        asset: 'cockpit',
      });
      container.addChild(cockpitImage)
      world.camera.cursor.addChild(container);

      // create clouds
      for (var i=0; i<10; i++){
        let cloud = new OBJ({ 
            asset: 'cloud.obj', 
            mtl: 'cloud.mtl', 
            x: random(-50, 50),
            y: random(15, 200), 
            z: random(-45,  45),
            scaleX: 3, 
            scaleY: 3, 
            scaleZ: 3 
        }) 
            world.add(cloud)
        }


}


function draw() {
    user = world.getUserPosition() // user's position
    elevation = world.getUserPosition().y // user's y
    elevation = Math.round(elevation) // round it

    if (elevation <= 0){ // if they go too low, game is over
      state = 'crash'
    }

    if (state == 'crash'){ // create a blank game over field
      var plane3 = new Plane({
        x: 0,
        y: -.5,
        z: 0,
        scaleX: 3,
        scaleY: 3
      });
      container.addChild(plane3)
      container2.remove(plane2)
      container2.remove(plane1)

      // remove score
      cockpitImage.tag.setAttribute('text',
        'value: '+' '+'; color: rgb(0,0,0); align: center;');
      // tell user it's game over
      plane3.tag.setAttribute('text',
        'value: '+('game over')+'; color: rgb(0,0,0); align: center;');
    }

    else { // when plane is not crashed
      world.moveUserForward(0.05); // move
      cockpitImage.tag.setAttribute('text', // show score
  	    'value: '+(score)+'; color: rgb(0,0,0); align: center;');

        // if user gets a point
        for (var i=0; i<torusArray.length; i++){
          if (dist(torusArray[i].myTorus.x, torusArray[i].myTorus.y, torusArray[i].myTorus.z, user.x, user.y, user.z) <= 1){
            if (!sound.isPlaying() ){
              sound.play()
            }
            score += 1
            torusArray.splice(i, 1)
          }
        }
    }

}



class TorusClass{
  constructor(){
    this.myTorus = new Torus({
      x: random(-5, 5),
      y: random(-3, 30),
      z: random(-50, 5),
      red: random(255),
      green: random(255),
      blue: random(255),
      radius: 1.5,
      clickFunction: function(me){
        console.log(me)
        // if (dist(this.myTorus.x, this.myTorus.y, this.myTorus.z, user.x, user.y, user.z) <= 100){
          // world.remove(me)
          me.setColor(0, 255, 0)
        // }
      }
    })
    world.add(this.myTorus)
  }
}
