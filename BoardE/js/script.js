var server = new WebSocket("ws://localhost:9041");

server.onopen = function()
{
    server.send(JSON.stringify({type: "new"}));
};

// Constructor for Shape objects to hold data for all drawn objects.
// For now they will just be defined as rectangles.
function Shape(x, y, r, fill, id)
{
    // This is a very simple and unsafe constructor. All we're doing is checking if the values exist.
    // "x || 0" just means "if there is a value for x, use that. Otherwise use 0."
    // But we aren't checking anything else! We could put "Lalala" for the value of x 
    this.x = x || 0;
    this.y = y || 0;
    this.r = r || 1;
    this.fill = fill || '#AAAAAA';
    this.id = id;
}

// Draws this shape to a given context
Shape.prototype.draw = function (ctx) {
    ctx.fillStyle = this.fill;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
};

// Determine if a point is inside the shape's bounds
Shape.prototype.contains = function (mx, my) {
    // All we have to do is make sure the Mouse X,Y fall in the area between
    // the shape's X and (X + Width) and its Y and (Y + Height)
    var xs = (mx - this.x) * (mx - this.x);
    var ys = (my - this.y) * (my - this.y);
    var sq = Math.sqrt(xs + ys);

    if (sq <= this.r) {
        return true;
    }
    else {
        return false;
    }
};

function CanvasState(canvas) {
    // **** First some setup! ****
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.ctx = canvas.getContext('2d');

    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = 'black';

    // This complicates things a little but but fixes mouse co-ordinate problems
    // when there's a border or padding. See getMouse for more detail
    var stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;
    if (document.defaultView && document.defaultView.getComputedStyle) {
        this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
        this.stylePaddingTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10) || 0;
        this.styleBorderLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10) || 0;
        this.styleBorderTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10) || 0;
    }
    // Some pages have fixed-position bars (like the stumbleupon bar) at the top or left of the page
    // They will mess up mouse coordinates and this fixes that
    var html = document.body.parentNode;
    this.htmlTop = html.offsetTop;
    this.htmlLeft = html.offsetLeft;

    // **** Keep track of state! ****

    this.valid = false; // when set to false, the canvas will redraw everything
    this.shapes = [];  // the collection of things to be drawn
    this.dragging = false; // Keep track of when we are dragging
    // the current selected object. In the future we could turn this into an array for multiple selection
    this.selection = null;
    this.dragoffx = 0; // See mousedown and mousemove events for explanation
    this.dragoffy = 0;

    // **** Then events! ****

    // This is an example of a closure!
    // Right here "this" means the CanvasState. But we are making events on the Canvas itself,
    // and when the events are fired on the canvas the variable "this" is going to mean the canvas!
    // Since we still want to use this particular CanvasState in the events we have to save a reference to it.
    // This is our reference!
    var myState = this;

    var myX;
    var myY;

    //fixes a problem where double clicking causes text to get selected on the canvas
    canvas.addEventListener('selectstart', function (e) { e.preventDefault(); return false; }, false);
    // Up, down, and move are for dragging
    canvas.addEventListener('mousedown', function (e) {
        if(canPaint)
        {
            var mouse = myState.getMouse(e);
            myState.ctx.beginPath();
            myState.ctx.moveTo(mouse.x, mouse.y);

            canvas.addEventListener('mousemove', onPaint, false);
        }
        else
        {
            var mouse = myState.getMouse(e);
            var mx = mouse.x;
            var my = mouse.y;
            var shapes = myState.shapes;
            var l = shapes.length;
            for (var i = l - 1; i >= 0; i--) {
                if (shapes[i].contains(mx, my)) {
                    var mySel = shapes[i];
                    // Keep track of where in the object we clicked
                    // so we can move it smoothly (see mousemove)
                    myState.dragoffx = mx - mySel.x;
                    myState.dragoffy = my - mySel.y;
                    myState.dragging = true;
                    myState.selection = mySel;
                    myState.valid = false;
                    return;
                }
            }
            // havent returned means we have failed to select anything.
            // If there was an object selected, we deselect it
            if (myState.selection) {
                myState.selection = null;
                myState.valid = false; // Need to clear the old selection border
            }
        }
    }, true);
    canvas.addEventListener('mousemove', function (e) {
        if(canPaint)
        {
            var mouse = myState.getMouse(e);
            mouse.x = e.pageX - this.offsetLeft;
            mouse.y = e.pageY - this.offsetTop;
        }
        else
        {
            if (myState.dragging) {
                var mouse = myState.getMouse(e);
                // We don't want to drag the object by its top-left corner, we want to drag it
                // from where we clicked. Thats why we saved the offset and use it here
                myState.selection.x = mouse.x - myState.dragoffx;
                myState.selection.y = mouse.y - myState.dragoffy;
                myState.valid = false; // Something's dragging so we must redraw

                var shape  = myState.shapes;

                for(var k = 0; k < shape.length; k++)
                {
                    server.send(JSON.stringify({type: "realTimePosition", posX: shape[k].x, posY: shape[k].y, rad: shape[k].r, color: shape[k].fill, id: shape[k].id, stage: actualStage}));
                }
            }
        }
    }, true);
    canvas.addEventListener('mouseup', function (e) {
        if(canPaint)
        {
            var mouse = myState.getMouse(e);
            canvas.removeEventListener('mousemove', onPaint, false);
        }
        else {
            var mouse = myState.getMouse(e);
            var mx = mouse.x;
            var my = mouse.y;
            var shapes = myState.shapes;
            var l = shapes.length;
            for (var i = l - 1; i >= 0; i--) {
                if (shapes[i].contains(mx, my)) {
                    var mySel = shapes[i];
                    // Keep track of where in the object we clicked
                    // so we can move it smoothly (see mousemove)
                    myState.dragoffx = mx - mySel.x;
                    myState.dragoffy = my - mySel.y;
                    myState.dragging = true;
                    myState.selection = mySel;
                    myState.valid = false;

                    myX = mx;
                    myY = my;

                    break;
                }
            }

            myState.dragging = false;
            if (myState.selection !== null) {
                actualPosition(myX, myY, myState.selection.id);
            }
        }
    }, true);

    var onPaint = function(e) {
        if(canPaint)
        {
            var mouse = myState.getMouse(e);
            myState.ctx.lineTo(mouse.x, mouse.y);
            myState.ctx.stroke();
        }
    };

    // **** Options! ****

    this.selectionColor = '#CC0000';
    this.selectionWidth = 2;
    this.interval = 30;
    setInterval(function () { myState.draw(); }, myState.interval);
}

CanvasState.prototype.addShape = function (shape) {
    this.shapes.push(shape);
    this.valid = false;
};

CanvasState.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.width, this.height);
};

// While draw is called as often as the INTERVAL variable demands,
// It only ever does something if the canvas gets invalidated by our code
CanvasState.prototype.draw = function () {
    // if our state is invalid, redraw and validate!
    if (!this.valid) {
        var ctx = this.ctx;
        var shapes = this.shapes;
        this.clear();

        // draw all shapes
        var l = shapes.length;
        for (var i = 0; i < l; i++) {
            var shape = shapes[i];
            shapes[i].draw(ctx);
        }

        this.valid = true;
    }
};


// Creates an object with x and y defined, set to the mouse position relative to the state's canvas
// If you wanna be super-correct this can be tricky, we have to worry about padding and borders
CanvasState.prototype.getMouse = function (e) {
    var element = this.canvas, offsetX = 0, offsetY = 0, mx, my;

    // Compute the total offset
    if (element.offsetParent !== undefined) {
        do {
            offsetX += element.offsetLeft;
            offsetY += element.offsetTop;
        } while ((element = element.offsetParent));
    }

    // Add padding and border style widths to offset
    // Also add the <html> offsets in case there's a position:fixed bar
    offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
    offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

    mx = e.pageX - offsetX;
    my = e.pageY - offsetY;

    // We return a simple javascript object (a hash) with x and y defined
    return { x: mx, y: my };
};

// If you dont want to use <body onLoad='init()'>
// You could uncomment this init() reference and place the script reference inside the body tag
var divStage;

var s = new CanvasState(document.getElementById('canvas'));

var actualStage = 1;
var maxStage = 5;
var lastStage = 1;

var actualPositions = [];


divStage = document.createElement("h3");
divStage.className = "actualStage";
divStage.innerHTML = "Stage: " + actualStage;

var stg = document.getElementById("stage");
stg.appendChild(divStage);

init();

function init()
{


    //var s = new CanvasState(document.getElementById('canvas'));

    actualPositions[0] = {x: 350, y: 600, rad: 15, color: '#ff7200', id: 0};
    s.addShape(new Shape(350, 600, 15, '#ff7200', 0));

    var positionX = 50;

    for(var i = 1; i < 6; i++)
    {
        actualPositions[i] = {x: positionX, y: 600, rad: 20, color: 'green', id: i};
        s.addShape(new Shape(positionX, 600, 20, 'green', i));
        positionX += 50;
    }

    positionX = 450;

    for(var j = 6; j < 11; j++)
    {
        actualPositions[j] = {x: positionX, y: 600, rad: 20, color: 'yellow', id: j};
        s.addShape(new Shape(positionX, 600, 20, 'yellow', j));
        positionX += 50;
    }
}

server.onmessage = function(msg)
{
    var msgParsed = JSON.parse(msg.data);

    if(msgParsed.type === "realTimePosition")
    {
        if(msgParsed.stage === actualStage)
        {
            positionRealTime(msgParsed);
        }
    }
    if(msgParsed.type === "NoPositionsStore")
    {
        //init();
    }
};

function actualPosition(posX, posY, id)
{
    for(var i = 0; i < actualPositions.length; i++)
    {
        if(actualPositions[i].id === id)
        {
            actualPositions[i].x = posX;
            actualPositions[i].y = posY;
        }
    }
}

function positionRealTime(msg)
{
    actualPositions[msg.id] = {x: msg.posX, y: msg.posY, rad: msg.rad, color: msg.color, id: msg.id};

    for(var i = 0; i < actualPositions.length; i++)
    {
        s.shapes[i].x = actualPositions[i].x;
        s.shapes[i].y = actualPositions[i].y;
    }

    s.valid = false;
    s.draw();
}

/*function sendPositionsStage()
{
    for(var i = 0; i < actualPositions.length; i++)
    {
        server.send(JSON.stringify({type: "positionStage", posX: actualPositions[i].x, posY: actualPositions[i].y, rad: actualPositions[i].rad, color: actualPositions[i].color, id: actualPositions[i].id, stage: actualStage}));
    }
}*/

function prevStage()
{
    if(actualStage > 1)
        actualStage--;

    divStage.innerHTML = "Stage: " + actualStage;

    server.send(JSON.stringify({type: "getPosition", stage: actualStage}));
}

function nextStage()
{
    if(actualStage < maxStage)
    {
        actualStage++;
        lastStage++;
    }

    divStage.innerHTML = "Stage: " + actualStage;

    server.send(JSON.stringify({type: "getPosition", stage: actualStage}));
}

function playStages()
{

}

function deleteStage()
{
    server.send(JSON.stringify({type: "deleteStage", lastStage: lastStage, stage: actualStage}));

    if(actualStage === lastStage)
        actualStage--;

    lastStage--;

    divStage.innerHTML = "Stage: " + actualStage;
}

function resetBoard()
{
    s.shapes = [];

    server.send(JSON.stringify({type: "resetBoard"}));

    actualStage = 1;
    divStage.innerHTML = "Stage: " + actualStage;
    init();
}

var prev_button = document.getElementById("prev_button");
var next_button = document.getElementById("next_button");
var play_button = document.getElementById("play_button");
var delete_button = document.getElementById("delete_button");
var reset_button = document.getElementById("reset_button");

prev_button.addEventListener("click", prevStage);
next_button.addEventListener("click", nextStage);
play_button.addEventListener("click", playStages);
delete_button.addEventListener("click", deleteStage);
reset_button.addEventListener("click", resetBoard);

var canPaint = false;

document.getElementById("paint").addEventListener("click", allowPainting);

function allowPainting() {
    canPaint = !canPaint;
}