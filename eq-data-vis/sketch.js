// Author: Dishen Zhao

/* EXTRA TODO:
*  - MAP STYLES
*  - FIT CANVAS TO SCREEN
*  - IMPROVE CONTROL PANEL
*    - HIDE/EXPAND CONTROL PANEL
*  - MINIMAP NAVIGATION
*  - USE D3 TO
*    - DRAW FAULT LINES
*    - DRAW COUNTIES 
*/
// Constants
const MAP_IMAGE_ZOOM = 5.0;
const CENTER_LAT = 37.5;
const CENTER_LONG = -119;
const SF_LAT = 37.733795;
const SF_LONG = -122.446747;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const START_DATE = "2017-01-02";
const ANIMATION_SPEED = 0.5;

// Loaded data variables
var mapCA;
var table;

// DOM element variables
var magFilterToggle;
var minMagSlider;
var minMagValue;
var maxMagSlider;
var maxMagValue;
var dateFilterToggle;
var dateRangeInput;
var dateSlider;
var dateValue;
var animateButton;
var fadeToggle;

// Earthquakes list
var earthquakes = [];

// Booleans
var bInsideCanvas = false;
var bDragged = false;
var bMagFilter = false;
var bDateFilter = false;
var bAnimateTimeline = false;

// Values
var scalar = 1.0;
var imageX = 0.0;
var imageY = 0.0;
var deltaX = 0.0;
var deltaY = 0.0;
var fadeSpeed = 100.0;
var filterMinMag = 0.0;
var filterMaxMag = 10.0;
var dateRange = 14;
var dateTarget = new Date(START_DATE);
var activeInfo;


// Earthquake object
var quake = function(time, lat, long, mag, depth, place) {
  this.time = new Date(time);
  this.lat = lat;
  this.long = long;
  this.x = longToImage(this.long) - longToImage(CENTER_LONG);
  this.y = latToImage(this.lat) - latToImage(CENTER_LAT);
  this.mag = mag;
  this.depth = depth;
  this.place = place;
  this.show = true;
  this.showInfo = false;
  this.fadeOut = false;
  this.fadeIn = false;
  this.alpha = 100.0;

  this.onClick = function() {
    this.showInfo = true;
    // Become new active info
    if (activeInfo != null) {
      activeInfo.showInfo = false;
    }
    activeInfo = this;
  }

  this.draw = function() {
    if (!this.show && !this.fadeIn && !this.fadeOut) {
      // Filtered out, do not draw
      return;
    }else if (this.alpha < 0) {
      // End of fade out, stop updating
      this.fadeOut = false;
      this.alpha = 0.0;
    }else if (this.alpha > 100.0) {
      // End of fade in, stop updating
      this.fadeIn = false;
      this.alpha = 100.0;
    }else if (this.fadeOut) {
      // Currently fading out, reduce alpha
      this.alpha -= fadeSpeed;
    }else if (this.fadeIn) {
      // Currently fading in, increase alpha
      this.alpha += fadeSpeed;
    }

    // Draw transparent circle
    //stroke(100, 100, 100, this.alpha);
    noStroke();
    fill(255, map(this.depth, 0, 15, 200, 0), 0, this.alpha);
    ellipse(this.x, this.y, (this.mag * 10)/scalar, (this.mag * 10)/scalar);
  }

  this.drawInfo = function() {
    // Draw plain info tooltip
    fill(255, 255, 255);
    rect(this.x, this.y, 300/scalar, 140/scalar);
    textSize(14/scalar);
    fill(0,0,0);
    // Build info string
    let s = printDatetime(this.time) + "\n" +
         "Latitude: " + this.lat + "\n" +
         "Longitude: " + this.long + "\n" +
         "Magnitude: " + this.mag + "\n" +
         "Depth: " + this.depth + "\n";
    // Attach place if it's not empty
    if (this.place != '') {
      s = s.concat("Place: " + this.place);
    }

    text(s, this.x+4/scalar, this.y+4/scalar, 300/scalar, 140/scalar);
  }
}

function preload() {
  // Load map image from MapBox API call
  //mapCA = loadImage('https://api.mapbox.com/styles/v1/mapbox/light-v9/static/-119,37.5,5/1280x700?access_token=pk.eyJ1Ijoid2l0aWRlayIsImEiOiJjanVmNjhyM2QwN25pNDRwaXZ0cnVsMWYyIn0.fCSS87N-5-PptVYzOWaZaA');
  
  // Load map image from local image
  mapCA = loadImage('ca_map.png');
  
  // Load earthquake dataset
  table = loadTable("eq.csv","csv","header");
}

function setup() {
  // Create canvas
  var canvas = createCanvas(CANVAS_WIDTH,CANVAS_HEIGHT);
  canvas.parent('canvas');

  // Fill earthquake list
  var rows = table.getRows();
  for (let i = 0; i < rows.length; i++) {
    let time = rows[i].getString("time");
    let lat = rows[i].getNum("latitude");
    let long = rows[i].getNum("longitude");
    let mag = rows[i].getNum("mag");
    let depth = rows[i].getNum("depth");
    let place = rows[i].getString("place");
    earthquakes.push(new quake(time, lat, long, mag, depth, place));
  }

  // DOM elements

  // Title text
  titleText = createDiv('California & Nevada Earthquakes 2017-2018');
  titleText.style('transform: translateX(-50%)');
  titleText.style('text-align: center');
  titleText.style('width: 180px');
  titleText.position(100, 6);

  // Magnitude filter checkbox
  magFilterToggle = createCheckbox('Filter by magnitude', false);
  magFilterToggle.style('font-weight: bold');
  magFilterToggle.position(20, 60);
  magFilterToggle.input(toggleFilter);

  // Static text
  let minText = createDiv('Minimum Magnitude');
  minText.style('transform: translateX(-50%)');
  minText.position(100, 90);

  // Minimum magnitude slider
  minMagSlider = createSlider(0.0, 10.0, 0.0, 0.1);
  minMagSlider.position(20, 110);
  minMagSlider.style('width', '120px');
  minMagSlider.input(updateSlider);

  // Minimum magnitude slider value display
  minMagValue = createDiv('0.0');
  minMagValue.style('transform: translateX(-50%)');
  minMagValue.position(160, 110);

  // Static text
  let maxText = createDiv('Maximum Magnitude');
  maxText.style('transform: translateX(-50%)');
  maxText.position(100, 140);

  // Maximum magnitude slider
  maxMagSlider = createSlider(0.0, 10.0, 10.0, 0.1);
  maxMagSlider.position(20, 160);
  maxMagSlider.style('width', '120px');
  maxMagSlider.input(updateSlider);

  // Maximum magnitude slider value display
  maxMagValue = createDiv('10.0');
  maxMagValue.style('transform: translateX(-50%)');
  maxMagValue.position(160, 160);

  // Date filter checkbox
  dateFilterToggle = createCheckbox('Filter by date range', false);
  dateFilterToggle.style('font-weight: bold');
  dateFilterToggle.position(20, 220);
  dateFilterToggle.input(toggleFilter);

  // Static text
  let dateText = createDiv('Number of days difference');
  dateText.style('transform: translateX(-50%)');
  dateText.position(100, 250);

  // Days difference input form
  dateRangeInput = createInput('14');
  dateRangeInput.style('width: 100px');
  dateRangeInput.position(20, 280);

  // Button to update days difference
  dateUpdateButton = createButton('Update');
  dateUpdateButton.position(135, 280);
  dateUpdateButton.style('font-size:12px');
  dateUpdateButton.mousePressed(updateInput);

  // Target date slider
  dateSlider = createSlider(0, 729, 0);
  dateSlider.style('width', '160px');
  dateSlider.style('transform: translateX(-50%)');
  dateSlider.position(100, 310);
  dateSlider.input(updateSlider);

  // Print locale date of target date
  dateValue = createDiv(printDate(dateTarget));
  dateValue.style('transform: translateX(-50%)');
  dateValue.position(100, 340);

  // Animation button
  animateButton = createButton('Animate Timeline');
  animateButton.position(100, 370);
  animateButton.style('font-size:12px');
  animateButton.style('transform: translateX(-50%)');
  animateButton.mousePressed(animateTimeline);

  // Toggle fade
  fadeToggle = createCheckbox('Enable fade effect', false);
  fadeToggle.style('font-weight: bold');
  fadeToggle.position(20, 400);
  fadeToggle.input(toggleFade);
}

function draw() {
  // Update date slider for animation
  if (bAnimateTimeline) {
    dateSlider.value(dateSlider.value() + ANIMATION_SPEED);
    if (dateSlider.value() >= 729) {
      bAnimateTimeline = false;
    }
    updateSlider();
  }

  // Draw mode
  imageMode(CENTER);

  // Transform and draw map
  translate(CANVAS_WIDTH/2 + imageX, CANVAS_HEIGHT/2 + imageY);
  scale(scalar);
  noTint();
  noStroke();
  image(mapCA, 0, 0);

  // Draw data
  for (let i = 0; i < earthquakes.length; i++) {
    earthquakes[i].draw();
  }

  if (activeInfo != null && activeInfo.showInfo) {
    activeInfo.drawInfo();
  }
}

function toggleFilter() {
  // Set booleans based on checkbox value
  bMagFilter = magFilterToggle.checked();
  bDateFilter = dateFilterToggle.checked();

  applyFilter();
}

function updateSlider() {
  // Grab new slider values
  filterMinMag = minMagSlider.value();
  filterMaxMag = maxMagSlider.value();
  dateTarget = new Date(START_DATE);
  dateTarget.setDate(dateTarget.getDate() + dateSlider.value());

  // Update DOM elements
  minMagValue.html(filterMinMag);
  maxMagValue.html(filterMaxMag);
  dateValue.html(printDate(dateTarget));

  applyFilter();
}

function updateInput() {
  // Grab input and parse as int
  var check = dateRangeInput.value();

  // Return early and do nothing if not int
  if (isNaN(check) || isNaN(parseFloat(check))) {
    return;
  }

  // Update days difference
  dateRange = parseFloat(check);

  applyFilter();
}

function animateTimeline() {
  // Already animating, turn it off
  if (bAnimateTimeline == true) {
    bAnimateTimeline = false;
    return;
  }
  // Force date filter for animation
  dateFilterToggle.checked(true);
  toggleFilter();
  bAnimateTimeline = true;
}

function toggleFade() {
  if (fadeToggle.checked()) {
    fadeSpeed = 2.0;
  }else {
    fadeSpeed = 100.0;
  }
}

function applyFilter() {
  // Apply filter and start fade in or out
  for (let i = 0; i < earthquakes.length; i++) {
    let eq = earthquakes[i];
    let delta = dateDelta(eq.time, dateTarget);
    if (eq.show) {
      let die = false;
      if (bMagFilter && !withinRange(eq.mag, filterMinMag, filterMaxMag)) {
        // Not within magnitude filter
        die = true;
      }
      if (bDateFilter && delta > dateRange) {
        // Not within date filter
        die = true;
      }
      if (die) {
        // Hide earthquakes that do not fit active filters
        eq.show = false;
        eq.fadeOut = true;
        eq.fadeIn = false;
      }
    }else {
      let live = true;
      if (bMagFilter && !withinRange(eq.mag, filterMinMag, filterMaxMag)) {
        // Not within magnitude filter
        live = false;
      }
      if (bDateFilter && delta > dateRange) {
        // Not within date filter
        live = false;
      }
      if (live) {
        // Show earthquakes that fit active filters
        eq.show = true;
        eq.fadeOut = false;
        eq.fadeIn = true;
      }
    }
  }
}

function keyPressed() {
  if (key == 'w' || key == 'W') {
    // Zoom in, max zoom in scalar is 8.0;
    if (scalar * 2.0 <= 8.0) {
      scalar *= 2.0;
    }
  }else if (key == 's' || key == 'S') {
    // Zoom out, max zoom out scalar is 1.0
    if (scalar * 0.5 >= 1.0) {
      scalar *= 0.5;
      // Check boundaries in X and reposition if needed
      if (imageX > (CANVAS_WIDTH/2 * (scalar - 1))) {
        imageX = CANVAS_WIDTH/2 * (scalar - 1);
      }else if (imageX + scalar * CANVAS_WIDTH/2 < CANVAS_WIDTH/2) {
        imageX = CANVAS_WIDTH/2 - scalar * CANVAS_WIDTH/2;
      }
      // Check boundaries in Y and reposition if needed
      if (imageY > (CANVAS_HEIGHT/2 * (scalar -1))) {
        imageY = CANVAS_HEIGHT/2 * (scalar - 1);
      }else if (imageY + scalar * CANVAS_HEIGHT/2 < CANVAS_HEIGHT/2) {
        imageY = CANVAS_HEIGHT/2 - scalar * CANVAS_HEIGHT/2;
      }
    }
  }
}

function mousePressed() {
  // Check if mouse is within canvas
  if (mouseX >= 0 && mouseX <= 1280 && mouseY >= 0 && mouseY <= 720) {
    deltaX = mouseX - imageX;
    deltaY = mouseY - imageY;
    bInsideCanvas = true;
  }
}

function mouseDragged() {
  var newX = mouseX - deltaX;
  var newY = mouseY - deltaY;

  // Set dragged flag to true
  bDragged = true;

  // Ignore panning if not within canvas or already max zoom out
  if (!bInsideCanvas || scalar === 1.0) return;

  // Pan in X, check boundaries
  if (newX > (CANVAS_WIDTH/2 * (scalar - 1))) {
    imageX = CANVAS_WIDTH/2 * (scalar - 1);
  }else if (newX + scalar * CANVAS_WIDTH/2 < CANVAS_WIDTH/2) {
    imageX = CANVAS_WIDTH/2 - scalar * CANVAS_WIDTH/2;
  }else {
    imageX = mouseX - deltaX;
  }

  // Pan in Y, check boundaries
  if (newY > (CANVAS_HEIGHT/2 * (scalar -1))) {
    imageY = CANVAS_HEIGHT/2 * (scalar - 1);
  }else if (newY + scalar * CANVAS_HEIGHT/2 < CANVAS_HEIGHT/2) {
    imageY = CANVAS_HEIGHT/2 - scalar * CANVAS_HEIGHT/2;
  }else {
    imageY = mouseY - deltaY;
  }
}

function mouseReleased() {
  // If mouse clicked without movement, check for selection
  if (bInsideCanvas && !bDragged) {
    for (let i = 0; i < earthquakes.length; i++) {
      // Skip if not visible
      if (!earthquakes[i].show) continue;

      // Convert mouse coordinates from screen to object space
      let objMouseX = (mouseX - CANVAS_WIDTH/2 - imageX) / scalar;
      let objMouseY = (mouseY - CANVAS_HEIGHT/2 - imageY) / scalar;
      let d = dist(objMouseX, objMouseY, earthquakes[i].x, earthquakes[i].y);

      // Check if clicked inside
      if (d <= earthquakes[i].mag * 5/scalar) {
        earthquakes[i].onClick();
        // Reset flags
        bInsideCanvas = false;
        bDragged = false;
        return;
      }
    }
    // Turn off tooltip info if nothing was clicked
    activeInfo.showInfo = false;
    activeInfo = null;
  }

  // Reset flags
  bInsideCanvas = false;
  bDragged = false;
}

function mouseWheel(event) {
  if (mouseX < 0 || mouseX > CANVAS_WIDTH || mouseY < 0 || mouseY > CANVAS_HEIGHT) {
    // Mouse not in canvas, ignore
    return;
  }

  if (event.delta < 0) {
    // Zoom in, max zoom in scalar is 8.0;
    if (scalar * 2.0 <= 8.0) {
      scalar *= 2.0;
    }
  }else if (event.delta > 0) {
    // Zoom out, max zoom out scalar is 1.0
    if (scalar * 0.5 >= 1.0) {
      scalar *= 0.5;
      // Check boundaries in X and reposition if needed
      if (imageX > (CANVAS_WIDTH/2 * (scalar - 1))) {
        imageX = CANVAS_WIDTH/2 * (scalar - 1);
      }else if (imageX + scalar * CANVAS_WIDTH/2 < CANVAS_WIDTH/2) {
        imageX = CANVAS_WIDTH/2 - scalar * CANVAS_WIDTH/2;
      }
      // Check boundaries in Y and reposition if needed
      if (imageY > (CANVAS_HEIGHT/2 * (scalar -1))) {
        imageY = CANVAS_HEIGHT/2 * (scalar - 1);
      }else if (imageY + scalar * CANVAS_HEIGHT/2 < CANVAS_HEIGHT/2) {
        imageY = CANVAS_HEIGHT/2 - scalar * CANVAS_HEIGHT/2;
      }
    }
  }
  // Block page scrolling
  return false;
}

function latToImage(lat) {
  // Web-Mercator latitude projection, formula from Wikipedia
  // https://en.wikipedia.org/wiki/Web_Mercator_projection
  return (256 / PI) * 32 * (PI - log(tan(PI / 4 + radians(lat) / 2)));
}

function longToImage(long) {
  // Web-Mercator latitude projection, formula from Wikipedia
  // https://en.wikipedia.org/wiki/Web_Mercator_projection
  return (256 / PI) * 32 * (radians(long) + PI);
}

function withinRange(x, a, b) {
  // Test if x is within range(a, b) inclusive
  if (x >= a && x <= b) {
    return true;
  }else {
    return false;
  }
}

function dateDelta(a, b) {
  // Subtract each other's unix time and return difference in days
  var c = b - a;
  return Math.abs(c / 1000 / 60 / 60 / 24);
}

function printDate(date) {
  // Print human readable date
  var options = {year: 'numeric', month: 'long', day: 'numeric'};
  return date.toLocaleDateString("en-US", options);
}

function printDatetime(date) {
  // Print human readable date and time
  var options = {year: 'numeric', month: 'long', day: 'numeric', 
                hour: 'numeric', minute: 'numeric', second: 'numeric'};
  return date.toLocaleDateString("en-US", options);
}