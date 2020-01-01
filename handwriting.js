"use strict";
// Created by Justin Meiners

// LICENSE GPL v3.0
// https://raw.githubusercontent.com/justinmeiners/neural-nets-sim/master/LICENSE

// VIEW
// ------------------------

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
        v = Vec.add(v, Vec.scale(dr, 5.0));
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
            return new Vec(0, 0);
            //return [i % 255, 255];
        })
    }

    this.cell = new Vec(1 / this.cols, 1 / this.rows);
    this.origin = new Vec(0, 0);
    this.pathLen = 0;
}

Glyph.prototype.lookup = function(v) {
    var ix = Math.floor(v.x / this.cell.x);
    var iy = Math.floor(v.y / this.cell.y);

    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows) {
        return new Vec(0, 0);
    }

    return this.data[ix + iy * this.cols]
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

       return glyph.lookup(v);
    };
}

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
            this.shift = Vec.sub(centroid, this.glyph.origin);
        }
   }

   drawSim();
}

var btn = document.getElementById("save");
btn.onclick = function() {
    var entry = document.getElementById("char");
    sim.symbols[entry.value] = sim.glyph;
    console.log(sim.glyph.save());
};

btn = document.getElementById("new");
btn.onclick = function() {
    sim.glyph = new Glyph(16, 16);
    sim.shift = new Vec(0.0, 0.0);
    drawSim();
};

function updateGlyphs() {
    var g = document.getElementById("glyphs");
    var t = "";

    for (var k in sim.symbols) {
        t += "<div>" + k + "</data>";
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

    var row, col;
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

var sim = new Sim()
drawSim();

sim.symbols["1"] = Glyph.load("BQEQABAAI8gAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ/9A/0AoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPv9C/0L/Tp8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABC/z//Qf9F/2MuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEL/Pv9A/0lXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPv8+/0D/QZ8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+/z7/QP9CqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//P/9A/0O0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP+89/0D/WBIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABASz7/Rf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQP9B/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9/0P/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD5pT5EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuR6/DwAAAAAAAAAAAAAAAAAA");

sim.symbols["2"] = Glyph.load("BQEQABAAH6UAAQAAAAAAAAAAAAAALQBLB4kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD0qvr/Av8R/xJ0KHcAAAAAAAAAAAAAAAAAAAAAAAAAAO7/7P8C/xD/Gv8k1DJqAAAAAAAAAAAAAAAAAAAAAAAA4P/7ZAM8G+om/zT/PdwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABbOUexPf9B9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFBMW/9S/1T6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAGW1Yv9e/1z/AAAAAAAAAAAAAAAAAAAAAAAAAABjJ2rLY/9k/2P/ZFkAAAAAAAAAAAAAAAAAAAAAAABWL1XQY/9k/1//VGcAAAAAAAAAAAAAAAAAAAAAAAAAAEJpSP9M/2fMQH0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAMdAp/yX/B/8F/wP/Bv8AZAAAAAAAAAAAAAAAAAAAAAAlWQ3/Cf8O/wf/B/8D/98OAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD0UJdQRfGhkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

sim.symbols["3"] = Glyph.load("BQEQABAAG7EAAQAAAAAAAAAAAAD0cvzIAf8K3RpEAAAAAAAAAAAAAAAAAAAAAAAAAADvJu7/+f8H/xf/F/8i8AAAAAAAAAAAAAAAAAAAAAAAAAAA6f/xiRm9Gf4k/y3/LtEAAAAAAAAAAAAAAAAAAAAAAAC9aZ8jAAAgXC//Of867QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHE6XP9P/01PQFoAAAAAAAAAAAAAAAAAAAAAAAAMeGG+cPlh/2P/bMBgIwAAAAAAAAAAAAAAAAAAAAD7hw3/N/4s/xjZLP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA9DkYYSPvIP8j/yHFJkQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJCAd1Cn/M/E17gAAAAAAAAAAAAAAAAAAvwoAAAAAAAAAAFt5Of9D/znAAAAAAAAAAAAAAAAAAACckYJajS96S3KtdlJf/2D/T8cAAAAAAAAAAAAAAAAAAAAAk8uJ/3//e/91/2v/a7BqUEtJAAAAAAAAAAAAAAAAgAVvTIz/g/97/3hqakVnqW0tAAAAAAAAAAAAAAAAAAAAAAAAAACXiXqheJ13RwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

sim.symbols["4"] = Glyph.load("BQEQABAAHLsAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPCW8f/8/yb/NGgAAAAAAAAAAAAAAAAAAAAA5lbu//H/6//s/xL/Nv86ugAAAAAAAAAAAAAAAAAA1i/j/+b/7f/r/++ROMY//zzwAAAAAAAAAAAAAAAAAADg/9r/4f/nwXhRgEZI/0T/VLBx1Xi8e+JwNgAAAAAAALmmr/+J/33/f/+A/3z/XP94/3j/e/96/wAAAAAAAAAAAAAAAJB9gKmAqYBGP/9B/0DHRGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA1kH/QItCUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAED/Q/9BvVAmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQMJD/0L+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA/0D/ReIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEHqQP9BqQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMxBB/1YdAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADhvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbQsAAAAAAAAAAAAA");

sim.symbols["5"] = Glyph.load("BQEQABAAHqwAAQAAAAAAAAAAAAAAAHczgGSARoBQgDyARoBLAAAAAAAAAAAAAAAARC1gRmrWeKeDeIPIiT6A/gAAAAAAAAAAAAAAAAAAAABAX0b/Yf9y/37/fv9+/37/gtIAAAAAAAAAAAAAAAAAADpGP/9M/0/Qf/9//4D/gv96xHtVAAAAAAAAAAAAAAAAAAA//zv/QcwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADj/Jv8P/wj/Dp8cJwAAAAAAAAAAAAAAAAAAAAAAAAAAEP8F/wn/Ef8S/xP/E9QiSgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAa2Rr/F/8c/yX1GyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAh/yv/Lf834QAAAAAAAAAAAAAAAAAAAACiPAAAAAAAAAAAQv9G/0L/AAAAAAAAAAAAAAAAAAC9/5Halb6JPoBkYqZg/1L/S/QAAAAAAAAAAAAAAAAAAKT/kv+S/4b/e/90/2j/Z/9beQAAAAAAAAAAAAAAAAAAm46P/4b/gP9//3z/dv9ySlsgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

sim.symbols["6"] = Glyph.load("BQEQABAAJqsAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmVnp0dv9zRAAAAAAAAAAAAAAAAAAAAAAAAAAAAABkzW7/bf92/4BGgCMAAAAAAAAAAAAAAAAAAAAAWzlh/2j/bf+AkIG4kjgAAAAAAAAAAAAAAAAAAAAAAABa/13/ZfkAAAAAAAC3TAAAAAAAAAAAAAAAAAAAAABV/1T/W1kAAAAAAAAAALRJAAAAAAAAAAAAAAAAAABSXlL/Uv8AAIJGgEaMRAAAAAAAAAAAAAAAAAAAAAAAAEOMTP9ianP/ff+B/4TIjdORR40fAAAAAAAAAAAAAAAAQv9L/3D/dv+A/4H/g/+S/5HGpUsAAAAAAAAAAAAAAAA//z7/U0N1XYBVjkWAVbv/tf+t/wAAAAAAAAAAAAAAADH/Mf8gBwAAAAAAAMC4yP/M/8b/AAAAAAAAAAAAAAAAL0wi/xj/DS8AAOMn3P/W/9H+zYQAAAAAAAAAAAAAAAAAAB6pFP8N/wD/9f/l/9j/25zIcAAAAAAAAAAAAAAAAAAALSETowdWA//6//f/5uHYaAAAAAAAAAAAAAAAAAAAAAAAAAAAD0UJQvta9EnnNgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

sim.symbols["7"] = Glyph.load("BQEQABAAGa4AAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcwH/A/8A/wL/Af8C/xL/UyEAAAAAAAAAAAAAAAAAAAAA+P/4/wH/Av8C/wb/FP87/00/AAAAAAAAAAAAAAAAAAD2bAA8AEYAVQBQTfFL/03/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVShN/0//T/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABNiUz/UP9LxQAAAAAAAAAAAAAAAAAAAAAAAAAAAABTOE+LVf9P/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEuMTP9V/1T/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAT7VW/1P/SyQAAAAAAAAAAAAAAAAAAAAAAAAAAAAATV5P/1L/T/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIM1T/T+tZKwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFVFUJxcJwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

sim.symbols["8"] = Glyph.load("BQEQABAAIJ8AAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcP90/33/hv+LaAAAAAAAAAAAAAAAAAAAAAAAAF+7Yv9x/3//iP+a/6LptSkAAAAAAAAAAAAAAAAAAAAATP9Q/wAAAADCULX/tv+/VQAAAAAAAAAAAAAAAAAAKyg8/0ZlAAAAAMpyy//I5r8oAAAAAAAAAAAAAAAAAAAAAC//Hv8AAPQk3P/c/9yKvzcAAAAAAAAAAAAAAAAAAAAAFHIM/wL/+v/l/++c5yQAAAAAAAAAAAAAAAAAAAAAAADh/+r/+v8F/xb3HZEAAAAAAAAAAAAAAAAAAAAAAADYetr/560AAAAAJf8q/zErAAAAAAAAAAAAAAAAAAAAANb/zv8AAAAAAAAtITz/Nv8AAAAAAAAAAAAAAAAAAAAAxf+/7wAAAAAAAAAARv9D/0YeAAAAAAAAAAAAAAAAAAC+/6r8m0AAAHIfZf9QmEr/AAAAAAAAAAAAAAAAAAAAALb/o/+R/4PreP9kv2X/V/8AAAAAAAAAAAAAAAAAAAAAo06e/5D/f/97/3P/av9jJwAAAAAAAAAAAAAAAAAAAAAAAAAAkd2C3IDvdnsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

sim.symbols["9"] = Glyph.load("BQEQABAAHJ8AAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYc3aedP9+/4T/gv9KhgAAAAAAAAAAAAAAAAAAAABUVWL7Zv9s/3b/ff94/69BAAAAAAAAAAAAAAAAAABUM1f/XP9dzV5YAADGVgN4Q6UAAAAAAAAAAAAAAAAAAEhHTP9R/1R9AAAAANT/CZ46agAAAAAAAAAAAAAAAAAAOrVD/0PcAAAAAORA1v8etD/RAAAAAAAAAAAAAAAAAAAreC7/L9/6gu766P/Z/z3/QO8AAAAAAAAAAAAAAAAAAAAAI7gI//3/7f/p/9eQQ/9B7wAAAAAAAAAAAAAAAAAAAAAVRQhm/r34p+J4QlBE/0H/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEWkT/QscAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEOHQ/9AkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQNFC/z6VAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABFxED/PMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEM8PP88aQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");


updateGlyphs();
