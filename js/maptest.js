require(["./map", "./rng"], function(DMap, rng) {
  window.rng = rng;
  window.DMap = DMap;

  var cnv = document.getElementById("viewport");
  var ctx = cnv.getContext("2d");

  var seed = Math.random() + 1;
  console.log("Seed: ", seed);
  
  var map = new DMap({
    width: 121,
    height: 71,
    minRoomSize: 7,
    maxRoomSize: 19,
    allowRoomOverlap: true,
    numRoomAttempts: 800,
    caveHeight: 10,
    caveWidth: 10,
    caveSetting: [6,7,8],
    numExtraConnectors: 30,
    connectorThickness: 1,
    straightTendency: 0.8,
    rng: new rng(seed)
  });

  map.generate();

  var x, y;
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  for (x = 0; x < map.width; x++) {
    for (y = 0; y < map.height; y++) {
      switch (map.get(x, y)) {
        case DMap.FLOOR:
          ctx.fillStyle = "white"; break;
        case DMap.WALL:
          ctx.fillStyle = "black"; break;
        case DMap.TEMP:
          ctx.fillStyle = "green"; break;
        case DMap.NOTHING:
          ctx.fillStyle = "yellow"; break;
      }
      ctx.fillRect(x * 10, y * 10, 10, 10);
    }
  }
  for (x = 0; x < map.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * 10, 0);
    ctx.lineTo(x * 10, map.height * 10);
    ctx.stroke();
  }
  for (y = 0; y < map.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * 10);
    ctx.lineTo(map.width * 10, y * 10);
    ctx.stroke();
  }

});
