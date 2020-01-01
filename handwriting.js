// Created by Justin Meiners

// LICENSE GPL v3.0
// https://raw.githubusercontent.com/justinmeiners/neural-nets-sim/master/LICENSE

// VIEW
// ------------------------

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
}

Vec.lerp = function(a, b, t) {
    return new Vec(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
}
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
        var dr = Vec.sub(path[i], path[i - 1]);
        var v = func(path[i - 1])
        sum += Vec.dot(v, dr);
    }
    return sum;
}

function nudgeGlyph(path, glyph) {
    var i;
    for (i = 1; i < path.length; ++i) {
        var dr = Vec.sub(path[i], path[i - 1]);
        var v = glyph.lookup(path[i - 1]);
        v = Vec.add(v, Vec.scale(dr, 6.0));
        if (v.lenSqr() > 1) {
            v = v.normed();
        }

        glyph.set(path[i - 1], v);
    }
}

function Glyph(cols, rows, data) {
    this.cols = cols;
    this.rows = rows;
    if (data) {
        this.data = data;
    } else {
        this.data = Array.apply(null, Array(cols * rows)).map(function (x, i) {
            return [0, 0];
            //return [i % 255, 255];
        })
    }

    this.cell = new Vec(1 / this.cols, 1 / this.rows);
    this.origin = new Vec(0, 0);
    this.pathLen = 0;
}


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

Glyph.prototype.lookup = function(v) {
    var ix = Math.floor(v.x / this.cell.x);
    var iy = Math.floor(v.y / this.cell.y);

    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) {
        return new Vec(0, 0);
    }

    var entry = this.data[ix + iy * this.cols] ;
    return Glyph.toVec(entry);
}

Glyph.prototype.set = function(v, dir) {
    var ix = Math.floor(v.x / this.cell.x);
    var iy = Math.floor(v.y / this.cell.y);

    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) {
        return;
    }

    this.data[ix + iy * this.cols] = Glyph.fromVec(dir);
}

Glyph.prototype.toFunc = function(shift) {
    var glyph = this;
    return function(v) {

       if (shift) {
           v = Vec.sub(v, shift);
       }

       return glyph.lookup(v);
    };
}

function getMousePos(canvas, e) {
    var rect = canvas.getBoundingClientRect();
    return new Vec(e.clientX - rect.left, e.clientY - rect.top);
}

function Sim() {
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.canvas.onmousedown = this.mouseDown.bind(this);
    this.canvas.onmouseup = this.mouseUp.bind(this);
    this.canvas.onmousemove = this.mouseMove.bind(this);
    
    this.glyph = new Glyph(16, 16);
    this.shift = new Vec(0, 0);
    this.symbols = {};
};

Sim.prototype.mouseDown = function(e) {
    var mp = getMousePos(this.canvas, e);
    this.path = []
    this.path.push(mp);
    this.dragging = true;


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
    var mp = getMousePos(this.canvas, e);
    this.path.push(mp);
    this.dragging = false;

    var w = this.canvas.width;
    var h = this.canvas.height;

    var scaledPath = this.path.map(function(v) {
        return new Vec(v.x / w, v.y / h);
    });

    var centroid = Vec.centroid(scaledPath);


    if (e.ctrlKey) {
        nudgeGlyph(scaledPath, this.glyph);
        this.glyph.origin = Vec.lerp(this.glyph.origin, centroid, 0.3);
        this.glyph.pathLen = lerp(this.glyph.pathLen, Vec.pathLen(scaledPath), 0.3);
        console.log(this.glyph.pathLen);
    } else {
        var best = 0.0;
        var bestSymbol = null;

        for (var sym in sim.symbols) {
            var testGlyph = sim.symbols[sym];
            var shift = Vec.sub(centroid, testGlyph.origin);
            var score = lineIntegral(scaledPath, testGlyph.toFunc(shift));

            console.log(sym, score);
            //score /= testGlyph.pathLen;
            console.log(sym, score);

            if (score > best) {
                best = score;
                bestSymbol = sym;
            }
        }

        if (bestSymbol) {
            var label = document.getElementById("score-label");
            label.innerText = bestSymbol + " " + best.toFixed(3);
            this.glyph = sim.symbols[bestSymbol];
            console.log(this.glyph);
            this.shift = Vec.sub(centroid, this.glyph.origin);
        }
   }

   drawSim();
}

var btn = document.getElementById("save");
btn.onclick = function() {
    var entry = document.getElementById("char");
    sim.symbols[entry.value] = sim.glyph;
    console.log(JSON.stringify(sim.glyph));
};

btn = document.getElementById("new");
btn.onclick = function() {
    sim.glyph = new Glyph(16, 16);
    drawSim();
};

var sim = new Sim()
drawSim();

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

    var entry, dir;

    ctx.strokeStyle = "#000000"
    ctx.beginPath() 
    for (col = 0; col < cols; ++col) {
        for (row = 0; row < rows; ++row) {
            o.x = col / cols + cell.x / 2;
            o.y = row / rows + cell.y / 2;
            ctx.rect(o.x * w, o.y * h, 1, 1)
        }
    }
    ctx.stroke()

    ctx.strokeStyle = "#FF0000"
    ctx.beginPath() 
    for (col = 0; col < cols; ++col) {
        for (row = 0; row < rows; ++row) {
            o.x = col / cols + cell.x / 2;
            o.y = row / rows + cell.y / 2;
            ctx.moveTo(o.x * w, o.y * h);
            var dir = Vec.scale(func(o), 0.05);
            
            var end = Vec.add(o, dir);
            ctx.lineTo(end.x * w, end.y * h);
        }
    }
    ctx.stroke()
}

function drawPath(ctx, path) {
    ctx.strokeStyle = "#00FF00";
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




