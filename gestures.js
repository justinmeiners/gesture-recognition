"use strict";
// Created by Justin Meiners (2020)
// License MIT (See README)

function clamp(a, b, t) {
    if (t < a) {
        return a; 
    } else if (t > b) {
        return b;
    } else {
        return t;
    }
}

function packVal(t) {
    return clamp(0, 255, Math.round(t * 255));
}

function unpackVal(x) {
    return (x / 255.0);
}

function Vec(x, y) {
    this.x = x;
    this.y = y;
}

Vec.prototype.lenSqr = function() {
    return this.x * this.x + this.y * this.y;
};

Vec.prototype.len = function() {
    return Math.sqrt(this.lenSqr());
};

Vec.prototype.inBounds = function(min, max) {
    return this.x >= min.x && this.y >= min.y &&
           this.x <= max.x && this.y <= max.y;
};

Vec.prototype.inCircle = function(o, r) {
    return Vec.distSqr(this, o) < r * r;
};

Vec.prototype.add = function(b) {
    this.x += b.x;
    this.y += b.y;
    return this;
};

Vec.prototype.normed = function() {
    return Vec.scale(this, 1 / this.len())
};

/*
Glyph.toVec = function(entry) {
    var angle = (entry[0] / 255) * 2.0 * Math.PI
    var len = (entry[1] / 255)
    return new Vec(Math.cos(angle) * len, Math.sin(angle) * len);
}

Glyph.fromVec = function(vec) {
    var len = vec.len()
    var angle = 0;

    if (len > 0) {
        angle = Math.atan2(vec.y, vec.x)
    }

    if (angle < 0) {
        angle = Math.PI * 2 + angle;
    }

    return [ Math.round(angle / (Math.PI * 2) * 255), Math.round(len * 255) ]
}
*/



Vec.prototype.pack = function() {
    var len = this.len();
    var angle = 0;

    if (len > 0) {
        angle = Math.atan2(this.y, this.x)
    }

    if (angle < 0) {
        angle = Math.PI * 2 + angle;
    }

    angle /= (Math.PI * 2);
    return (packVal(len) << 8) | packVal(angle);
}

Vec.unpack = function(d) {
    var angle = unpackVal(d & 0xFF) * 2.0 * Math.PI;
    var len = unpackVal((d >> 8) & 0xFF);

    return new Vec(
        Math.cos(angle) * len,
        Math.sin(angle) * len
    );
}

Vec.add = function(a, b) {
    return new Vec(a.x + b.x, a.y + b.y);
};

Vec.sub = function(a, b) {
    return new Vec(a.x - b.x, a.y - b.y);
};

Vec.scale = function(a, s) {
    return new Vec(a.x * s, a.y * s);
};

Vec.distSqr = function(a, b) {
    return Vec.sub(a, b).lenSqr();
};

Vec.dist = function(a, b) {
    return Math.sqrt(Vec.distSqr(a, b));
};

Vec.min = function(a, b) {  
    return new Vec(Math.min(a.x, b.x), Math.min(a.y, b.y));
};

Vec.max = function(a, b) {
    return new Vec(Math.max(a.x, b.x), Math.max(a.y, b.y));
}

Vec.dot = function(a, b) {
    return a.x * b.x + a.y * b.y;
};

function lerp(a, b, t) {
    return (1 - t) * a + t * b;
};

Vec.lerp = function(a, b, t) {
    return new Vec(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
};

(function() {
    var v = new Vec(0.5, 0.25);
    var vprim = Vec.unpack(v.pack());

    if (Math.abs(Vec.dist(v, vprim)) > 0.02) {
        console.log(vprim);
        throw new Error("invalid pack");
    }
})();



/*

Vec.bezier = function(t, p1, cp1, cp2, p2) {
    var inv_t = 1.0 - t;
    var a = Vec.scale(p1, inv_t * inv_t * inv_t);
    var b = Vec.scale(cp1, 3.0 * inv_t * inv_t * t);
    var c = Vec.scale(cp2, 3.0 * inv_t * t * t);
    var d = Vec.scale(p2, t * t * t);
    return Vec.add(a, Vec.add(b, Vec.add(c, d)));
};
*/

Vec.centroid = function(pts) {
    var sum = pts.reduce(function(acc, x) {
        return Vec.add(acc, x);
    });

    return Vec.scale(sum, 1 / pts.length);
}

Vec.pathLen = function(path) {
    var sum = 0;
    var i;
    for (i = 1; i < path.length; ++i) {
        sum += Vec.sub(path[i], path[i-1]).len();
    }

    return sum;
}


function lineIntegral(path, func) {
    var sum = 0;

    var i;
    for (i = 1; i < path.length; ++i) {
        var r = path[i - 1];
        var v = func(r);

        var dr = Vec.sub(path[i], path[i - 1]);
        sum += Vec.dot(v, dr);
    }
    return sum;
}


function smoothGlyph(glyph) {
    var smoothed = new Glyph(glyph.cols, glyph.rows);
    smoothed.origin = glyph.origin;
    smoothed.pathLen = glyph.pathLen;
    
    var row, col;

    for (col = 0; col < glyph.cols; ++col) {
        for (row = 0; row < glyph.rows; ++row) {
            var i = row * glyph.cols + col;
            var val = glyph.data[i];

            //if (Math.abs(val.x) < 0.0001 && 
            //    Math.abs(val.y) < 0.0001) {

                var sum = val;
                var n = 0;
                if (col > 0) {
                    sum = Vec.add(sum, glyph.data[i - 1]);
                    ++n;
                }
                if (col < glyph.cols - 1) {
                    sum = Vec.add(sum, glyph.data[i + 1]);
                    ++n;
                }

                if (row > 0) {
                    sum = Vec.add(sum, glyph.data[i - glyph.cols]);
                    ++n;
                }
                if (row < glyph.rows - 1) {
                    sum = Vec.add(sum, glyph.data[i + glyph.cols]);
                    ++n;
                }
                sum = Vec.scale(sum, 1.0 / n);
                if (sum.lenSqr() > 1) {
                    sum = val.normed();
                }
                val = sum;
            //}           

            smoothed.data[i] = val;
        }
    }

    console.log(smoothed);

    return smoothed;
}

function nudgeGlyph(path, glyph) {
    var i;
    for (i = 1; i < path.length; ++i) {
        var dr = Vec.sub(path[i], path[i - 1]);
        var v = glyph.at(path[i - 1]);
        v = Vec.add(v, Vec.scale(dr, 7.5));
        if (v.lenSqr() > 1) {
            v = v.normed();
        }

        glyph.set(path[i - 1], v);
    }
}

function Glyph(cols, rows, opt_data) {
    this.cols = cols;
    this.rows = rows;
    if (opt_data) {
        this.data = opt_data;
    } else {
        this.data = Array.apply(null, Array(cols * rows)).map(function (x, i) {
            return new Vec(0, 0);
            //return [i % 255, 255];
        })
    }

    this.cell = new Vec(1 / this.cols, 1 / this.rows);
    this.origin = new Vec(0, 0);
    this.pathLen = 0;
}

Glyph.prototype.at = function(v) {
    var ix = Math.floor(v.x / this.cell.x);
    var iy = Math.floor(v.y / this.cell.y);

    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) {
        return new Vec(0, 0);
    }

    return this.data[ix + iy * this.cols];
}

Glyph.prototype.set = function(v, dir) {
    var ix = Math.floor(v.x / this.cell.x);
    var iy = Math.floor(v.y / this.cell.y);

    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) {
        return;
    }

    this.data[ix + iy * this.cols] = dir;
}

Glyph.prototype.toFunc = function(shift) {
    var glyph = this;
    return function(v) {
       if (shift) {
           v = Vec.sub(v, shift);
       }

       return glyph.at(v);
    };
}

var MAX_PATH_LEN = 2.6;

Glyph.prototype.save = function() {
    var d = [];

    function write(val) {
        d.push(val);
    }

    // add placeholder for the data length
    write(0);

    write(this.cols);
    write(this.rows);

    write(this.origin.pack());
    write(packVal(this.pathLen / MAX_PATH_LEN));
    write(this.data.length);

    var i;
    for (i = 0; i < this.data.length; ++i) {
        write(this.data[i].pack());
    }

    // prefix the data with the length so that load can detect malformed data
    d[0] = d.length;

    var arr16 = new Uint16Array(d);
    var arr8 = new Uint8Array(arr16.buffer);
    var str = String.fromCharCode.apply(null, arr8);
    return btoa(str);
};

Glyph.load = function(base64) {
    var str;
    var i;

    try {
        str = atob(base64);
    } catch (e) {
        // a base64 error occurred
        return false;
    }

    var arr8 = new Uint8Array(str.length);

    for (i = 0; i < str.length; ++i) {
        arr8[i] = str.charCodeAt(i);
    }

    var d = new Uint16Array(arr8.buffer);
    var cursor = -1;

    function read() {
        return d[++cursor];
    }

    if (read() != d.length) {
        console.log("wtF");
        return false;
    }


    var cols = read();
    var rows = read();

    var g = new Glyph(cols, rows);
    g.origin = Vec.unpack(read());
    g.pathLen = unpackVal(read()) * MAX_PATH_LEN;

    var n = read();
    g.data = new Array(n);

    for (i = 0; i < g.data.length; ++i) {
        g.data[i] = Vec.unpack(read());
    }

    return g;
};

function getMousePos(canvas, e) {
    var rect = canvas.getBoundingClientRect();
    return new Vec(e.clientX - rect.left, e.clientY - rect.top);
}

var GLYPH_SIZE = 16;

function Sim() {
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.canvas.onmousedown = this.mouseDown.bind(this);
    this.canvas.onmouseup = this.mouseUp.bind(this);
    this.canvas.onmouseout = this.mouseOut.bind(this);
    this.canvas.onmousemove = this.mouseMove.bind(this);
    
    this.glyph = new Glyph(GLYPH_SIZE, GLYPH_SIZE);

    this.shift = new Vec(0, 0);
    this.symbols = {};
};

Sim.prototype.mouseDown = function(e) {
    var mp = getMousePos(this.canvas, e);
    this.path = []
    this.path.push(mp);
    this.dragging = true;

    // Calling preventDefault ensures that if the user drags outside of the
    // canvas, they won't start selecting text in the document.
    e.preventDefault();
};


Sim.prototype.mouseMove = function(e) {
    var mp = getMousePos(this.canvas, e);

    if (this.dragging) {
        var lp = this.path[this.path.length - 1];

        if (!mp.inCircle(lp, 6)) {
            this.path.push(mp)
            drawSim();
        }
    }
}

Sim.prototype.mouseUp = function(e) {
    if (!this.dragging) {
        return;
    }

    var mp = getMousePos(this.canvas, e);
    this.path.push(mp);

    this.endDrag(e);
}

Sim.prototype.mouseOut = function(e) {
    if (!this.dragging) {
        return;
    }

    this.endDrag(e);
}

Sim.prototype.endDrag = function(e) {
    this.dragging = false;

    var w = this.canvas.width;
    var h = this.canvas.height;

    var scaledPath = this.path.map(function(v) {
        return new Vec(v.x / w, v.y / h);
    });

    var centroid = Vec.centroid(scaledPath);

    if (e.shiftKey) {
        nudgeGlyph(scaledPath, this.glyph);
        this.glyph.origin = Vec.lerp(this.glyph.origin, centroid, 0.5);
        //var score = Vec.pathLen(scaledPath) - lineIntegral(scaledPath, this.glyph.toFunc(shift));
        this.glyph.pathLen = lerp(this.glyph.pathLen, Vec.pathLen(scaledPath) , 0.5);
        console.log(this.glyph.pathLen);
    } else {
        var best = 0.0;
        var bestSymbol = null;

        for (var sym in sim.symbols) {
            var testGlyph = sim.symbols[sym];
            var shift = Vec.sub(centroid, testGlyph.origin);
            var cost =  Math.abs(Vec.pathLen(scaledPath) - testGlyph.pathLen);
            var score = lineIntegral(scaledPath, testGlyph.toFunc(shift)) - cost;


            console.log(sym, cost);
            //score /= testGlyph.pathLen;
            //console.log(sym, score);

            if (score > best) {
                best = score;
                bestSymbol = sym;
            }
        }

        if (bestSymbol) {
            var label = document.getElementById("score-label");
            label.innerText = 'Guess: ' + bestSymbol + " Score: " + best.toFixed(3);
            this.glyph = sim.symbols[bestSymbol];
            this.shift = Vec.sub(centroid, this.glyph.origin);
        }
   }

   drawSim();
}

var btn = document.getElementById("save");
btn.onclick = function() {
    var entry = document.getElementById("char");
    sim.symbols[entry.value] = sim.glyph;
    entry.value = '';
    entry.blur();
    console.log(sim.glyph.save());

    updateGlyphs();

    sim.path = null;
    drawSim();
};

btn = document.getElementById("new");
btn.onclick = function() {
    sim.glyph = new Glyph(GLYPH_SIZE, GLYPH_SIZE);
    sim.shift = new Vec(0.0, 0.0);
    sim.path = null;
    drawSim();
};

btn = document.getElementById("smooth");
btn.onclick = function() {
    sim.glyph = smoothGlyph(sim.glyph);
    drawSim();
};

btn = document.getElementById("delete-all");
btn.onclick = function() {
    sim.symbols = {};
    updateGlyphs();
};


function updateGlyphs() {
    var g = document.getElementById("glyphs");
    var t = "";

    for (var k in sim.symbols) {
        t += "<li>" + k + "</li>";
    }
    g.innerHTML = t;
}

function drawSim() {
    clearCanvas(sim.ctx, sim.canvas);
    drawDataGlyph(sim.ctx, sim.glyph, sim.canvas.width, sim.canvas.height);
    if (sim.path) {
        drawPath(sim.ctx, sim.path);
    }

    drawOrigin(sim.ctx, sim.glyph.origin, sim.canvas.width, sim.canvas.height);
}


function clearCanvas(ctx, canvas) {
    ctx.fillStyle = '#EFF0F1';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.closePath();
    return ctx.fill();
}

function drawOrigin(ctx, v, w, h) {
    ctx.strokeStyle = "#AA8800";
    ctx.beginPath();
    ctx.rect(v.x * w - 4, v.y * h - 4, 8, 8);
    ctx.stroke();
}

function drawDataGlyph(ctx, glyph, w, h) {
    return drawField(ctx, glyph.toFunc(sim.shift), w, h, glyph.cols, glyph.rows);
}

function drawField(ctx, func, w, h, cols, rows) {
    var cell = new Vec(1 / cols, 1 / rows);
    var o = new Vec();
    var unitLength = cell.len() * 0.5;

    var row, col;
    var entry, dir;

    ctx.strokeStyle = "#000000"
    ctx.beginPath() 

    for (row = 0; row < rows; ++row) {
        for (col = 0; col < cols; ++col) {
            o.x = col / cols + cell.x / 2;
            o.y = row / rows + cell.y / 2;
            ctx.rect(o.x * w, o.y * h, 1, 1)
        }
    }
    ctx.stroke()

    ctx.strokeStyle = "#FF0000"
    ctx.beginPath() 

    for (row = 0; row < rows; ++row) {
        for (col = 0; col < cols; ++col) {
            o.x = col / cols + cell.x / 2;
            o.y = row / rows + cell.y / 2;
            ctx.moveTo(o.x * w, o.y * h);
            var dir = Vec.scale(func(o), unitLength);
            
            var end = Vec.add(o, dir);
            ctx.lineTo(end.x * w, end.y * h);
        }
    }
    ctx.stroke()
}

function drawPath(ctx, path) {
    ctx.strokeStyle = "#0000FF";
    ctx.lineWidth = 2;
    ctx.beginPath();

    //console.log(path);

    ctx.moveTo(path[0].x, path[0].y);
    var i;
    for (i = 1; i < path.length; ++i) {
        ctx.lineTo(path[i].x, path[i].y)
    }

    ctx.stroke();
    ctx.lineWidth = 1;
}

var sim = new Sim()
drawSim();

sim.symbols["1"] = Glyph.load("BgEQABAAIK87AAABAAAAAAAAAAAAAAAAAAA8EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8GT5MPBkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8DT5cPv9EkTwNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8QP2xA/0WiPxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPxA/cD//P3A/EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+EEBwP/9AcD4QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEEQP3A//z9wQRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPhBAcD//QHA+EAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAED9wQf9AgUAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4QQHA+/0GBQSEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQBBAaj//QXxAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8Cz9bQP8/WzwLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPBZBqjwWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

sim.symbols["2"] = Glyph.load("BgEQABAAG7iPAAABAAAAAAAAAADyLvhf+5ABqQWcCosTZRs7HRAAAAAAAAAAAAAAAADyKPVf9cH78wH/Bf8O5hq+I28pKB0FAAAAAAAAAADyEPQw8pfw//n/+/8E/xD/Hv8s+DM9OgwAAAAAAAAAAAAA8iDwYeva8L76oAujH+Es/zP/O5pABwAAAAAAAAAAAAAAAOkS5kPiO+syHjw7nUL/Qv9F4UsQAAAAAAAAAAAAAAAAAAC/CdgTywRZS1K+V/9Q/05kSRAAAAAAAAAAAAAAAAAAAAAAvwRgQFylW/9e/1n/U1JQBAAAAAAAAAAAAAAAAAAAAABjVGGfYP9h/1//WZRYG1YFAAAAAAAAAAAAAAAATwZgXWOxY/9k/1//XJJbLFYKAAAAAAAAAAAAAAAATwxBQVurYf9e/1azRWUhMAsXBAUAAAAAAAAAAAAATwYcNThoQL5O/zeXFqUHygG4AlUHGQkFAAAAAAAAAAAEEA4uD6Aaqg3/CP8D////Af8GsQltDQkNAgAAAAAAAAAABCAIPglvB28EbwFwAHACZQQvDQ4NAwAAAAAAAAAAAAAAAAQQBBAEEAIQARACEAAQDQUNAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");


sim.symbols["3"] = Glyph.load("BgEQABAAGrGHAAABAAAAAAAA+B33W/ue/aoDqgepDZYSZRYSAAAAAAAAAAAAAAAA+An0Nffd+v/9/wL/BP8S/xX/IWohCwAAAAAAAAAAAADrCfVC9qPz//7/CP8Q/xf/If8t/zBJLQQAAAAAAAAAAAAA6xL2SPliA2INbRmXJf8n/0P/P2I7EAAAAAAAAAAAAAAAAOsJ/Bg7BEAWUFtLs1b/Uf9Va04QAAAAAAAAAAAAAAAABRYkC0gfa41q/23/Z/9g01xNZhAAAAAAAAAAAAAAChYLKhJVQZE+91TqXP9cuVxtZykAAAAAAAAAAAAADwgLGQtYEIEW/x//Iv8k/yv1OFcdEAAAAAAAAAAAAAAAAA8PCi0NaBeFHdgj/yH/NP8xkTcwGwMAAAAAAAAAAAAAAAAPCA4aGEAoVyzIMv9D/0C1Qz9DDgAAAAAAAAAAAAAAAJUPf0B4UmNnYedf/1b/V6dRPV0KAAAAAAAAAAAAAKIZhnF7/4H/e/9y/2v/Zv9ha2UjAAAAAAAAAAAAAKcMmSSUY4j/fv93/3P/cZ9tXmspAAAAAAAAAAAAAAAAAACnGJIyiVJ9ZndvdFByMG8QAAAAAAAAAAAAAAAAAAAAAAAApwyCEH0QdxByEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

sim.symbols["4"] = Glyph.load("BgEQABAAHq+iAAABAAAAAAAAAAAAAAAA5AsfLCVBOkczCwAAAAAAAAAAAAAAAAAAAAAAAAAA5APsLvhmJ5IrWjsnMwMAAAAAAAAAAAAAAAAAAAAAAADbL+GgAf8q/zKsMzlACAAAAAAAAAAAAAAAAAAAAADVENuP2v/y8Cv/PP9CU0AQAAAAAAAAAAAAAAAAAAAAAN5/3v/c/+2cPP9E/0RWSQkAAAAAAAAAAAAAAAAAAN5u2ffX/9awM0s//0i/UT5kF20EAAAAAAAAAAAAANsu1JrW/8r/pU9cfUP/WrJvfXtjeDxtBwAAAAAAAAAAxDLEubH/iP+B/3z/V/98/4D/fv9//3vpbQQAAAAAAACqELdgmbOM4IH/bu5D/2rqeeZ8rXxofRWIBQAAAAAAAAAAqiChPo1le29djUH/W5Z0W3xCgRaICgAAAAAAAAAAAAAAAKoQhBBgFkVxQv9Fc10XgASIBQAAAAAAAAAAAAAAAAAAAAAAAD8QP3A+/z9wPxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQRBAcD7/QHBBEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAED5dP/8+XUAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMkCPhw4SD4cyQIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADJBzsPyQcAAAAAAAAAAAAAAAA=");

sim.symbols["5"] = Glyph.load("BgEQABAAHp2MAAABAAAAAAAASBJZJ3MygDqAOoA6gTqALoEgAAAAAAAAAAAAAAAASAxPNVl0dIl9lX+ZgJmAlYCMgGqCIgAAAAAAAAAASARKH019Vf9v/37/gP9//4D/gP+A/oBQgg8AAAAAAAA/BEIoQ5JA/1riccd9z3/OgMaAq4B8gieAAQAAAAAAAD8EPig7lTr/OcpAWWAxdUF7RYA8gSOABAAAAAAAAAAAOAQzJS2JJf8P/w7/E68ZgSI8NxSABAAAAAAAAAAAAAAUBBodHWUW0Qj/Bv8T/x3/IbwnWi8ZAAAAAAAAAAAAAAAAFAsRNA9rCJQKpxnTJf8r/zO1NUM9DAAAAAAAAAAAAAAAABQLCh4DIxAwImUv0Tb/OuhAbD4WUAIAAAAAAAAAAAAAnwGPDYwcfyRWQEy1SP9I9UZwSxotAQAAAAAAAAAAnwGOFYpJh4SBlnW7ZOxZ/1PSU15OEVgCAAAAAAAAnwCNCYotiYWH/37/e/92/2blYJRcNF4KAAAAAAAAAAAAAJ8BjhWKSYiDg5J+lXSQbXNlPmQRAAAAAAAAAAAAAAAAAACfAZARiiCGJ30neCZsHmkMAAAAAAAAAAAAAAAAAAAAAAAAnwCTBIYEfgR1BG0DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

sim.symbols["6"] = Glyph.load("BgEQABAAIrKdAAABAAAAAAAAAAAAAAAAZAliJnBVdFV7NwAAAAAAAAAAAAAAAAAAAAAAAAAAYBhiQ2h3bZdr/3b/gE0AAAAAAAAAAAAAAAAAAAAAVyNcYWG0Zv9p/2//fGOCGJIFAAAAAAAAAAAAAAAAThtTWVfMXf9i/2n/c2V+KJIKAAAAAAAAAAAAAAAARwlMKk+kUP9a/2DTZ0N4EJIFAAAAAAAAAAAAAAAAAABKBElKTLZV/1b/anKAOIsclg0AAAAAAAAAAAAAAAAAAEYQRlhK/0z/Y/99/4SkjIKVT5kgAAAAAAAAAAAAAAAAQRBEb0H/Sf9h/3j/fv+V/5nGoF+dGAAAAAAAAAAAAABBED5mPP9E/2P/dv+H/5H/nP+l/7A2pQUAAAAAAAAAADgQNm0w/zv/QnxvT5SBpNK3/6z/sk67DwAAAAAAAAAAKhAuVyzhJv8f/wqD6GzS49L/uv+9SrMLAAAAAAAAAAAgBSI3IpAZ/xH/Bf/2/+//4//Oe8coywQAAAAAAAAAAAAAIAkZPxJ2Cr8B4Pjb76bjaNcxywgAAAAAAAAAAAAAAAAAACAFDSEHQQBg+VfyN+cYywQAAAAAAAAAAAAAAAAAAAAAAAAAAAgJARD4EO8EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

sim.symbols["7"] = Glyph.load("BgEQABAAGrJOAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOARD/EP4Q/hD+EAwQLBBcBAAAAAAAAAAAAAAAAAAc/1T+bv9w/nD9cAJvG2krQzgnXAgAAAAAAAAAAAAO/k//////Av////7/A/8g/zS7QFVDG1wEAAAAAAAA+wv/U/76/f8B/wH//v8J/yz/RP9LfFYgWAQAAAAAAAAAAPsW/1X+a/9wAmkgZjyxTv9V/1VRWBIAAAAAAAAAAAAAAAD7C/4QABBGKU+PTv9N/1GPVSkAAAAAAAAAAAAAAAAAAAAAAABTF1FUUNtL/0r/TGROCwAAAAAAAAAAAAAAAAAAAABOBU8ZUYdT/0z/S/9ORQAAAAAAAAAAAAAAAAAAAAAAAAAATShNkkr/Sv9KmUcQAAAAAAAAAAAAAAAAAAAAAAAATAdPNU2nS/9J/0hoRhAAAAAAAAAAAAAAAAAAAAAAAABOC004S9NG/0XDQkc9CQAAAAAAAAAAAAAAAAAAAAAAAEYDTB1PmER0QVs5ITAGAAAAAAAAAAAAAAAAAAAAAAAAAABGB0sSQx04GDAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARgMAADAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

sim.symbols["8"] = Glyph.load("BgEQABAAH6fTAAABAAAAAAAAAAAAAFArZV1uk3u0g76Dd4Q5AAAAAAAAAAAAAAAAAAAAAEslVmdi/3L/gv+K/4y3hziGEAAAAAAAAAAAAAAAAEcPTExK/1r/av+T/6X/nbecT5AEAAAAAAAAAAAAAAAASBBFbEL/TP9vcbLtuv+z/7RUsRAAAAAAAAAAAAAAAAA6EDloNv8u/wI0zv/P/8PRv1a9EAAAAAAAAAAAAAAAACIQKkwn/xz/Cf/d/9r/zpHLN9wGAAAAAAAAAAAAAAAAAAABRgSXDP/z//3/B8r9QdwMAAAAAAAAAAAAAAAAAADgNeB76f/l/+//FP8i/zSyMS8AAAAAAAAAAAAAAADdH9ls5f/j/+f/BIUm1y//Nf85TzUQAAAAAAAAAADZB9A+07HS/9T/3aoSMjeVPf8+/0BtQBAAAAAAAAAAAMkQyk3H/8T/y/++QmIiTIhK+0v/Sl9NEAAAAAAAAAAAwgjCPr+uuP+6/5J+dINhtGD/Wf9VQVwJAAAAAAAAAAAAALgetHmw/5r/hv93/27/ZP9ecGEiAAAAAAAAAAAAAAAArAeqQaOYlf+G/3v/cZBoXWQpAAAAAAAAAAAAAAAAAAAAAKwPnjqTV4NtfE90L2YQAAAAAAAAAAAAAAAAAAAAAAAAAACsCpAVgRV5FQAAAAAAAAAAAAAAAAAAAAA=");

sim.symbols["9"] = Glyph.load("BgEQABAAFaqQAAABAAAAAAAAAAAAAGEXaChwOX05dzJmHUsSAAAAAAAAAAAAAAAAAAAAAFsXXjxmfnCNdv98/3/eVyJLDAAAAAAAAAAAAAAAAFcQUztW8Wj/c/96/33/b/9dy0gUSwQAAAAAAAAAAFIERxpKekr/VP9mpIN+e1MVgz7/OiUpBAAAAAAAAAAANwQ8JTSELP8z0SE92W3h/wnaOv80IT4EAAAAAAAAAAAmBCchKnYi/xL/Af/r/+H/Of84uz8oQAQAAAAAAAAAAA0BHRIcTxisD//9//L/BJc//z3/QChCBAAAAAAAAAAAAAANAxgcEk8Jev2M+3kpdD3/Q/9CKEIEAAAAAAAAAAAAAAAADQMTEggg/iYdJz2KPf8//0EoQgQAAAAAAAAAAAAAAAAAAA0BDwQcBT0mP5ZA/0D/QCg/BAAAAAAAAAAAAAAAAAAAAAAAAEAEPig/jkD/PdY+KEAEAAAAAAAAAAAAAAAAAAAAAAAAPAQ/HD5kQf8+Zz8fPAQAAAAAAAAAAAAAAAAAAAAAAABDAj4QPzZDyT84PhBDAgAAAAAAAAAAAAAAAAAAAAAAAAAAQwU/FUArPxVDBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEMFQAhDBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABDAgAAAAAAAAAAAAA=");

updateGlyphs();
