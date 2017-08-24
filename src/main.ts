import { Game } from "./game";
import { Player } from "./actor";

// HTMLCanvasElement doesn't work, so I have to use any...
var canvas: any = document.getElementById("viewport");

var seed = 1.19;
var player = new Player({
  name: "Name",
  // TODO: class selection?
  stats: {
    maxhp: 100,
    str: 10,
    dex: 10,
    intl: 10,
    wis: 10,
    con: 10,
    luck: 10,

    lightRadius: 20,
    speed: 1,
    regenRate: 1
  },
  level: 1,
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
    minRoomSize: 5,
    maxRoomSize: 11,
    allowRoomOverlap: true,
    numRoomAttempts: 800,
    numExtraConnectors: 30,
    caveWidth: 20,
    caveHeight: 20,
    numCaves: 30,
    caveSetting: [6,7,8],
    connectorThickness: 1,
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

(<any>window).game = game;

