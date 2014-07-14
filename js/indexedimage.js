/*
   An index (palette) based image

   Uses an offscreen canvas (icanvas) to fake an index based image.
   The first (red) channel is used for the index. The alpha channel is
   kept up to date with the transparent colors, since this makes it
   easier to handle image brushes and copying. The green and blue
   channels aren't currently used for anything.

   The view (canvas) should be updated after any editing operation or
   palette change.
*/

var OldPaint = window.OldPaint || {};


OldPaint.IndexedImage = function (data) {

    console.log("IndexedImage", data);

    this.indexed = data.indexed;

    // The "real" indexed, internal canvas
    this.icanvas = document.createElement('canvas');
    this.icanvas.width = data.size.width;
    this.icanvas.height = data.size.height;
    this.icontext = this.icanvas.getContext("2d");

    // the RGBA representation
    this.canvas = document.createElement('canvas');
    this.canvas.width = data.size.width;
    this.canvas.height = data.size.height;
    this.context = this.canvas.getContext("2d");

    //this.palette = data.palette;

    if (data.image) {
        // If the data is a canvas, use it directly...
        if (data.image.nodeName == "CANVAS") {
	    this.icanvas = data.image;
	    this.icontext = this.icanvas.getContext("2d");
	    // ...otherwise load it as raw pixel data
        } else {
	    var pixbuf = this.icontext.getImageData(
                0, 0, this.icanvas.width, this.icanvas.height);
	    for (var i=0; i<data.image.length; i++) {
                pixbuf.data[i*4] = data.image[i];
                pixbuf.data[i*4+3] = 255;
	    }
	    this.icontext.putImageData(pixbuf, 0, 0);
        }
    }

    this.rect = OldPaint.Util.rect(0, 0, data.size.width, data.size.height);

    // this.get_pos = function (pos) {
    //     return {x: this.flip.x ? this.canvas.width - pos.x : pos.x,
    //             y: this.flip.y ? this.canvas.height - pos.y : pos.y};
    // };

    // this.get_rect = function (rect) {
    //     return {left: this.flip.x ?
    //                 this.canvas.width - (rect.left + rect.width) : rect.left,
    //             top: this.flip.y ?
    //                 this.canvas.height - (rect.top + rect.height) : rect.top,
    //             width: rect.width, height: rect.height};
    // };

    this.get_data = function () {
        return this.icanvas;
    };

    this.get_repr = function () {
	return this.indexed? this.canvas : this.icanvas;
    };

    this.get_size = function () {
	return {width: this.icanvas.width, height: this.icanvas.height};
    };

    this.put_data = function (data) {
        var pixbuf = this.icontext.getImageData(
	    0, 0, this.icanvas.width, this.icanvas.height);
        for (var i=0; i<data.length; i++) {
	    pixbuf.data[i] = data[i];
        }
        this.icontext.putImageData(pixbuf, 0, 0);
    };

    // Drawing methods generally take coordinates, a brush and a color (index).
    // Returns a rect of the changed area.

    this.draw_brush = function (pt, brush, color) {
        var width = brush.image.canvas.width, height = brush.image.canvas.height,
	    rect = this.blit(brush.image.icanvas,
			     {left: 0, top: 0, width: width, height: height},
			     {left: pt.x - Math.floor(width / 2),
			      top: pt.y - Math.floor(height / 2),
			      width: width, height: height});
        return rect;
    };

    this.draw_line = function (pt1, pt2, brush) {
        //console.log("draw_line", startPt.x, startPt.y, endPt.x, endPt.y, color);
	//endPt = endPt | startPt;
        //console.log("brush", pt1, pt2, brush);
        var rect = OldPaint.Draw.drawLineWithBrush(this.icontext, pt1.x, pt1.y, pt2.x, pt2.y,
                                                   brush.image.icanvas);
        //this.updateCanvas(rect, palette);
        return rect;
    };

    this.draw_rectangle = function (startpt, size, brush) {
        var rect1 = OldPaint.Draw.drawLineWithBrush(this.icontext, startpt.x, startpt.y,
                                                    startpt.x+size.x, startpt.y,
                                                    brush.image.icanvas),
            rect2 = OldPaint.Draw.drawLineWithBrush(this.icontext,
                                                    startpt.x+size.x, startpt.y,
                                                    startpt.x+size.x, startpt.y+size.y,
                                                    brush.image.icanvas),
            rect3 = OldPaint.Draw.drawLineWithBrush(this.icontext,
                                                    startpt.x+size.x, startpt.y+size.y,
			                            startpt.x, startpt.y+size.y, brush.image.icanvas),
            rect4 = OldPaint.Draw.drawLineWithBrush(this.icontext, startpt.x, startpt.y+size.y,
			                            startpt.x, startpt.y, brush.image.icanvas);

        // this.updateCanvas(rect1, palette);
        // this.updateCanvas(rect2, palette);
        // this.updateCanvas(rect3, palette);
        // this.updateCanvas(rect4, palette);
        var rect = OldPaint.Util.intersect(this.rect, OldPaint.Util.union(rect1, rect2));
        return rect;
    };

    this.draw_filled_rectangle = function (startpt, size, color) {
        this.icontext.fillStyle = "rgb("+color+",0,0)";
        var x0 = Math.min(startpt.x, startpt.x+size.x);
        var y0 = Math.min(startpt.y, startpt.y+size.y);
        var w = Math.max(size.x, -size.x);
        var h = Math.max(size.y, -size.y);
        this.icontext.fillRect(x0, y0, w, h);
        // this.updateCanvas({left:x0, top:y0,
        //                    width:w, height:h}, palette);
        return {left:x0, top:y0,
                width:w, height:h};
    };

    this.draw_ellipse = function (pt, size, brush) {
        var rect = OldPaint.Draw.drawEllipseWithBrush(this.icontext, pt.x, pt.y,
					              size.x, size.y, brush.image.icanvas);
        //this.updateCanvas(rect, palette);
        //return rect;
        return OldPaint.Util.intersect(this.rect, rect);
    };

    this.draw_filled_ellipse = function (pt, radius, color) {
        var rect = OldPaint.Draw.drawFilledEllipse(this.icontext,
					           pt.x, pt.y, radius.x, radius.y, color);
        //this.updateCanvas(rect, palette);
        return OldPaint.Util.intersect(rect, {left:0, top:0,
				     width: this.icanvas.width,
				     height: this.icanvas.height});
    };

    this.blit = function(canvas, fromrect, torect, clear) {
        if (clear) {
	    this.clear(torect);
        }
        try {
            this.icontext.drawImage(canvas,
				    fromrect.left, fromrect.top,
				    fromrect.width, fromrect.height,
				    torect.left, torect.top,
				    torect.width, torect.height);
        }
        catch(e) {
            torect = null;
        }
        //if (torect)
            //this.updateCanvas(torect, palette);
        return torect;
    };

    this.draw_fill = function (pt, color, erase) {
        color = [color, 0, 0, erase? 0 : 255];
        var width = this.icanvas.width, height = this.icanvas.height;
        var pixbuf = this.icontext.getImageData(0, 0, width, height);
        var rect = OldPaint.Draw.bucketfill(pixbuf.data, width, height, pt, color);
        this.update(pixbuf, rect.left, rect.top, rect.width, rect.height, true);
        //this.updateCanvas(rect, palette);
        console.log("filled", rect);
        return rect;
    };

    this.gradientfill = function (pt, colors) {
        colors = _.map(colors, function (color) {
	    return [color, 0, 0, this.palette.colors[color][3]];
        }, this);
        var width = this.icanvas.width, height = this.icanvas.height;
        var pixbuf = this.icontext.getImageData(0, 0, width, height);
        var rect = OldPaint.Draw.gradientfill(pixbuf.data, width, height, pt, colors);
        this.update(pixbuf, 0, 0, width, height, true);
        this.updateCanvas();
        return rect;
    };

    this.flipx = function() {
        var canvas = OldPaint.Util.copy_canvas(this.icanvas, null, {x: true}),
	    rect = OldPaint.Util.rect(0, 0, canvas.width, canvas.height);
        return this.blit(canvas, rect, rect, true);
    };

    this.flipy = function() {
        var canvas = OldPaint.Util.copy_canvas(this.icanvas, null, {y: true}),
	    rect = OldPaint.Util.rect(0, 0, canvas.width, canvas.height);
        return this.blit(canvas, rect, rect, true);
    };

    this.clear = function(rect, color) {
        if (rect) {
	    this.icontext.clearRect(rect.left, rect.top,
				    rect.width, rect.height);
	    this.context.clearRect(rect.left, rect.top,
                                   rect.width, rect.height);
        } else {
	    this.icontext.clearRect(0, 0, this.canvas.width, this.canvas.height);
	    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	    rect = {left: 0, top: 0,
		    width: this.canvas.width, height: this.canvas.height};
        }
        //this.updateAlpha(rect);
        return rect;
    };

    this.update = function (pixbuf, left, top, width, height, clear) {
        if (clear) {
	    this.icontext.clearRect(left, top, width, height);
        }
        this.icontext.putImageData(pixbuf, 0, 0,
                                   left, top, width, height);
    };

    this.updateCanvas = function (rect, palette) {
        rect = OldPaint.Util.intersect(rect, {left:0, top:0,
                                              width: this.canvas.width,
                                              height: this.canvas.height});
        if (rect) {
            var original = this.icontext.getImageData(rect.left, rect.top,
                                                      rect.width, rect.height).data,
                pixbuf = this.context.createImageData(rect.width, rect.height),
                data = new Uint32Array(pixbuf.data.buffer),
                colors = palette.colors32;
            for (var i=0; i<data.length; i++) {
                data[i] = colors[original[i*4]];
            }
            this.context.putImageData(pixbuf, rect.left, rect.top);
        }
        return rect;
    };

    // Older implementation... should do some benchmarking of which
    // one is actually faster. Using typed arrays should be faster but there's
    // still the loop to translate palette to color...
    this.updateCanvasOld = function (rect) {
        if (!this.indexed)
            return;
        rect = OldPaint.Util.intersect(rect, {left:0, top:0,
				     width: this.canvas.width,
				     height: this.canvas.height});
        if (rect) {
	    var indpix = this.icontext.getImageData(rect.left, rect.top,
						    rect.width, rect.height).data;
	    var pixbuf = this.context.createImageData(rect.width, rect.height),
                color, data = pixbuf.data, index, yinc = rect.width * 4, x, y;

	    for (y=0; y<rect.height*rect.width*4; y+=yinc) {
                for (x=y; x<y+yinc; x+=4) {
		    color = this.palette.colors[indpix[x]];
		    data[x] = color[0];
		    data[x+1] = color[1];
		    data[x+2] = color[2];
		    data[x+3] = color[3];
                }
	    }
	    this.context.putImageData(pixbuf, rect.left, rect.top);
        }
    };

    // make sure the alpha channel reflects the actual drawn parts.
    // Note that this destroys the color info in transparent parts!
    this.updateAlpha = function (rect) {
        if (!this.indexed)
            return;
        rect = OldPaint.Util.intersect(rect,
			      {left:0, top:0,
			       width: this.icanvas.width,
			       height: this.icanvas.height});
        console.log("updateAlpha: ", rect.left, rect.top, rect.width, rect.height);
        if (rect) {
	    var indpix = this.icontext.getImageData(rect.left, rect.top,
						    rect.width, rect.height);
	    for (var i=0; i<indpix.data.length; i+=4) {
                indpix.data[i+3] = this.palette.colors[indpix.data[i]][3];
	    }
	    this.icontext.putImageData(indpix, rect.left, rect.top);
        }
    };

    this.colorize = function (color, update) {
        // change the color of all non-transparent pixels
        var pixbuf = this.icontext.getImageData(0, 0,
						this.canvas.width,
						this.canvas.height);
        for (var i=0; i<pixbuf.data.length; i+=4) {
	    if (pixbuf.data[i+3] > 0) {
                pixbuf.data[i] = color;
	    }
        }
        this.icontext.putImageData(pixbuf, 0, 0);
        if (update) {
	    this.updateCanvas();
        }
        return this.canvas;
    };

    this.getpixel = function (x, y) {
        return this.icontext.getImageData(x, y, 1, 1).data[0];
    };

    // Return a PNG, as base64 or as blob
    this.make_png = function (blob) {
        var p = new PNGlib(this.canvas.width, this.canvas.height,
                           this.palette.colors.length);
        var pixbuf = this.icontext.getImageData(0, 0,
						this.canvas.width,
						this.canvas.height);
        console.log("transparent color:", this.palette.colors[0]);
        p.set_palette(this.palette.colors);
        for (var x=0; x<this.canvas.width; x++) {
	    for (var y=0; y<this.canvas.height; y++) {
                p.buffer[p.index(x, y)] =  String.fromCharCode(
		    pixbuf.data[y * this.canvas.width * 4 + x * 4]);
	    }
        }
        if (blob) {
	    var uri = "data:image/png;base64," + p.getBase64();
	    return OldPaint.Util.convertDataURIToBlob(uri);
        } else {
	    return p.getBase64();
        }
    };

    // Return an internal representation that can be saved
    this.get_raw = function () {
        return OldPaint.Util.convertDataURIToBlob(this.icanvas.toDataURL());
    };

    //this.updateCanvas();

    console.log("heh");
};
