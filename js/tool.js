var OldPaint = window.OldPaint || {};

OldPaint.Tools = (function () {

    var Tool = function (name, icon, drawFunc, showEphemeral) {
        this.name = name;
        this.icon = icon;
        this.draw = drawFunc;
        this.showEphemeral = showEphemeral;
    };

    // The most basic tool, drawing lines along the path of the mouse
    var pencil = function (layer, brush, color, update, before, after,
                           setRegion, setCoords, stroke) {

        // take a stream of points, do whatever modifications to the
        // drawing are appropriate, and return the modified image rects
        // as a stream.
        function tool(pts) {
            // for each pair of points, draw a line between them
            return pts
                .slidingWindow(2)
                .map(layer.draw_line.bind(layer), _brush);
        }

        // take the correct version of the brush
        var _brush = stroke.erase? brush.eraseImage : brush.drawImage;

        before();

        stroke.coords.throttle(200).onValue(setCoords);
        var stream = tool(stroke.coords);
        //stream.onValue(update);  // update the layer view while drawing
        stream
            .fold(null, OldPaint.Util.union)  // make a rect of the changed part
            .onValue(after, stroke);  // finally send the entire "dirty" rectangle
        return stream
            .map(function (r) {return {layer: layer, rect: r};});
    };

    var rectangle = function (layer, brush, color, update, before, after,
                              setRegion, setCoords, stroke) {

        var oldRect = null;  // Exercise: make this unnecessary

        function tool(pts) {
            return pts.take(1)  // use the starting point as one corner
                .combine(pts, function(p0, p1) {  // together with the latest
                    layer.restore(oldRect);
                    var rect = layer.draw_rectangle.bind(
                        layer)(_brush, p0, OldPaint.Util.diff(p0, p1));
                    return OldPaint.Util.union(rect, oldRect);
                });
        }

        // take the correct version of the brush
        var _brush = stroke.erase? brush.eraseImage : brush.drawImage;

        var stream = tool(stroke.coords.throttle(20));
        // throttling seems like a hack, but it makes things smoother in FF
        // because it prevents the stream from saturating if drawing is slow.
        // using "backpressure" might be better, but not doable in bacon..?

        stream.onValue(function(rect) {
            oldRect = rect;
        });

        stream
            .fold(null, OldPaint.Util.union)  // make a rect of the changed part
            .onValue(after, stroke);  // finally send the entire "dirty" rectangle

        return stream.map(function (r) {return {layer: layer, rect: r};});
    };

    var ellipse = function (layer, brush, color, update, before, after,
                            setRegion, setCoords, stroke) {

        var oldRect = null;  // Exercise: make this unnecessary

        function tool(pts) {
            return pts.take(1)  // use the starting point as center
                .combine(pts, function(p0, p1) {  // together with the latest
                    layer.restore(oldRect);
                    var rect = layer.draw_ellipse.bind(layer)(
                        _brush, p0, OldPaint.Util.diff(p0, p1));
                    return OldPaint.Util.union(rect, oldRect);
                });
        }

        // take the correct version of the brush
        var _brush = stroke.erase? brush.eraseImage : brush.drawImage;

        var stream = tool(stroke.coords.throttle(20));
        
        stream.onValue(function(rect) {oldRect = rect;});  // hack

        stream
            .fold(null, OldPaint.Util.union)  // make a rect of the changed part
            .onValue(after, stroke);  // finally send the entire "dirty" rectangle

        return stream.map(function (r) {return {layer: layer, rect: r};});        
    };

    var line = function (layer, brush, color, update, before, after,
                         setRegion, setCoords, stroke) {

        var oldRect = null;  // Exercise: make this unnecessary

        function tool(pts) {
            return pts.take(1)  // use the starting point
                .combine(pts, function(p0, p1) {  // together with the latest
                    layer.restore(oldRect);
                    var rect = layer.draw_line.bind(layer)(_brush, [p0, p1]);
                    return OldPaint.Util.union(rect, oldRect);
                });
        }

        // take the correct version of the brush
        var _brush = stroke.erase? brush.eraseImage : brush.drawImage;

        var stream = tool(stroke.coords.throttle(20));
        
        stream.onValue(function(rect) {oldRect = rect;});

        stream
            .fold(null, OldPaint.Util.union)  // make a rect of the changed part
            .onValue(after, stroke);  // finally send the entire "dirty" rectangle

        return stream.map(function (r) {return {layer: layer, rect: r};});
    };

    var fill = function (layer, brush, color, update, before, after,
                         setRegion, setCoords, stroke) {

        color = stroke.erase? 0 : color;  // fixme

        function tool(pts) {
            return pts
                .fold(null, function (a, b) {return b;})
                .map(function (p) {
                    return layer.draw_fill.bind(layer)(color, p, stroke.erase);
                });
        }

        var stream = tool(stroke.coords);

        stream
            .onValue(function (r) {
                after(stroke, r);
            });  // finally send the entire "dirty" rectangle
        
        return Bacon.never();  // need to return a stream but no updates
                               // will be needed so we take an empty one.
    };

    var region = function (layer, brush, color, update, before, after,
                           setRegion, setCoords, stroke, corner, rect) {

        var oldRect = null;  // Exercise: make this unnecessary

        function tool(pts) {
            return pts.take(1)  // use the starting point
                .combine(pts, function(p0, p1) {  // together with the latest
                    var rect = OldPaint.Util.rectify(p0, p1);
                    setRegion(rect, false);
                    return rect;
                });
        }

        var stream = tool(stroke.coords);
        stream
            .fold(null, function (v, w) {return w;})
            .onValue(function (r) {
                console.log("finish");
                setRegion(r, true);
            });
    };

    return {
        "pencil": new Tool("Pencil", "images/icons/pencil.png", pencil, true),
        "rectangle": new Tool("Rectangle", "images/icons/rectangle.png",
                              rectangle, true),
        "ellipse": new Tool("Ellipse", "images/icons/ellipse.png", ellipse,
                            true),
        "line": new Tool("Line", "images/icons/line.png", line, true),
        "fill": new Tool("Fill", "images/icons/floodfill.png", fill),
        "region": new Tool("Region", "images/icons/select.png", region)
    };


})();
