var OldPaint = window.OldPaint || {};

console.log("hrer");
OldPaint.setupInput = function (element, view, drawStroke, drawEphemeral) {


    // Make bacon from mouse input events
    var mouse_down = Bacon.fromEventTarget(element, "mousedown").map(".button"),
        mouse_up = Bacon.fromEventTarget(document, "mouseup").map(false),
        mouse_button = mouse_down.map(true)
            .merge(mouse_up).toProperty(false),
        // mouse coordinates in element space
        mouse_move = Bacon.fromEventTarget(document, "mousemove", function (evt) {
            evt.preventDefault();
            var bb = element.parentNode.getBoundingClientRect();  // not very neat
            return {x: evt.pageX - bb.left,
                    y: evt.pageY - bb.top};}).toProperty(),
        // mouse coords in image space
        mouse_image = mouse_move
            .map(view.to_image_coords)
            .filter(function (p) {return !!p;})
            .skipDuplicates(OldPaint.Util.compare),
        mouse_out = Bacon.fromEventTarget(element, "mouseout").map(false),
        wheel_event = (document.onmousewheel !== undefined ? "mousewheel" : "wheel"),
        mouse_wheel = Bacon.fromEventTarget(document, wheel_event)
            // Note: this may only cover FF and webkit
            .map(function (e) {return OldPaint.Util.sign(wheel_event == "wheel" ?
                                                -e.deltaY : e.wheelDeltaY);});


    var window_resize = Bacon.fromEventTarget(window, "resize");

    // Keyboard input events
    Mousetrap.bind("+", function () {view.change_zoom(1);});
    Mousetrap.bind("-", function () {view.change_zoom(-1);});

    Mousetrap.bind("left", function () {view.pan({x: 50, y: 0});});
    Mousetrap.bind("right", function () {view.pan({x: -50, y: 0});});
    Mousetrap.bind("up", function () {view.pan({x: 0, y: 50});});
    Mousetrap.bind("down", function () {view.pan({x: 0, y: -50});});

    Mousetrap.bind("z", function () {view.undo();});
    Mousetrap.bind("y", function () {view.redo();});


    // === Event handling ===

    // draw / pan
    mouse_down.onValue(function (button) {
        // Every time a mouse button is pressed...
        var coords;
        if (button == 1) {
            // ...if it's the middle button we start panning
            coords = mouse_move.takeUntil(mouse_up);
            pan(coords);
        } else {
            // ...otherwise we start a "stroke"; the stream of
            // mouse points (in image coords) from now
            // until the button is released.
            coords = mouse_image.takeUntil(mouse_up);
            drawStroke({erase: button == 2, coords: coords});
        }
    });

    // handle panning by moving the view with the difference
    // between successive mouse positions
    function pan(coords) {
        coords.throttle(100).slidingWindow(2, 2)
            .onValues(function (p1, p2) {view.pan(OldPaint.Util.diff(p1, p2));});
    }

    // if no button is pressed, we draw a "preview" of the brush
    mouse_image.filter(mouse_button.not())
        .onValue(drawEphemeral);

    // zoom
    mouse_wheel.zip(mouse_wheel.map(mouse_move))
        .onValues(function (wheel, pos) {
            view.change_zoom(wheel, pos);
        });

    // resize browser window
    window_resize.onValue(function () {view.redraw();});

};
