define(["./game", "./actor"], function(Game, Actor) {
  var canvas = document.getElementById("viewport");
  var seed = 1.18;
  var player = new Actor.Player({
    name: window.prompt("name your player"),
  });

  var game = new Game(canvas, {
    player: player,
    seed: seed,

    homeLevel: {
      width: 63,
      height: 31,
    },
    dungeon: {
      width: 255,
      height: 127,
      minRoomSize: 5,
      maxRoomSize: 11,
      
      // Higher = more rooms (can't guarantee how many though)
      numRoomAttempts: 400,

      // Higher = more connected dungeon
      numExtraConnectors: 20,

      // 0-1, how straight should corridors be?
      straightTendency: 0.8

    },
  });

  console.log("HI");

  // Disable backspace navigation
  canvas.addEventListener("keydown", function(event) {
    var key = event.keyCode || event.which;
    game.handleKey(key, event.shiftKey);
    if (!event.ctrlKey) {
      event.preventDefault();
    }
  });

  game.handleKey(190);

});
