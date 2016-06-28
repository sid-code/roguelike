define(["./game", "./actor"], function(Game, Actor) {
  var canvas = document.getElementById("viewport");

  var seed = 1.18;
  var player = new Actor.Player({
    name: window.prompt("name your player"),
    stats: {}, // TODO: class selection!
  });

  var game = new Game(canvas, {
    player: player,

    // How the game should show text to the player
    output: function(msg, color) {
      console.log(msg);
    },

    // The RNG's seed (needs to be a float x, 1 < x < 2)
    seed: seed,

    tileSize: 16,

    // How big should the home level be?
    homeLevel: {
      width: 63,
      height: 31,
    },

    // Dungeon configuration
    dungeon: {
      width: 121,
      height: 71,

      // Room size control
      minRoomSize: 7,
      maxRoomSize: 19,

      // Allow the rooms to overlap? (Allows dungeon to have tons of rooms)
      // Turn off for a more maze-like dungeon.
      allowRoomOverlap: true,
      
      // Higher = more rooms (can't guarantee how many though)
      numRoomAttempts: 800,

      // Higher = more connected dungeon
      numExtraConnectors: 30,

      // Vague constraints on cave dimensions. This does not guarantee caves of
      // size 24x24 but generally the bigger these get, the fatter or taller
      // caves get.
      caveWidth: 24,
      caveHeight: 24,

      // How many caves should be placed on the map?
      numCaves: 20,

      // How fat should the connectors be? 1 = single square, 2 = 3x3, 3 = 5x5,
      // etc. (A connector is a block of floor tiles randomly placed to connect
      // components of the dungeon together)
      connectorThickness: 1,

      // 0-1, how straight should corridors be?
      straightTendency: 0.8

    },
  });

  game.echo("Welcome " + player.name + "!");

  canvas.addEventListener("keydown", function(event) {
    var key = event.keyCode || event.which;
    game.handleKey(Game.prepareKey(key, event.shiftKey));
    if (!event.ctrlKey) {
      event.preventDefault();
    }
  });

  game.handleKey(190);

  // Auto resize canvas
  var resizeCanvas = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // This will clear the canvas but that's ok because it will be redrawn at
    // the next frame
  };
  resizeCanvas();

  window.addEventListener("resize", resizeCanvas, false);

  // Render loop
  var startRenderLoop = function() {
    game.draw();
    window.requestAnimationFrame(startRenderLoop);
  };

  startRenderLoop();
});
