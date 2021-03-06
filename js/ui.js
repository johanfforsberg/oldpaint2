/** @jsx React.DOM */

var OldPaint = window.OldPaint || {};
var _ = mori;

OldPaint.UI = (function () {

    var bus = {
        update: new Bacon.Bus(),
        stroke: new Bacon.Bus()
    };
    
    var MAX_UNDOS = 10;
    var actionNumber = 0;

    // default palette
    var colors = [[170,170,170,0],[0,0,0,255],[101,101,101,255],[223,223,223,255],[207,48,69,255],[223,138,69,255],[207,223,69,255],[138,138,48,255],[48,138,69,255],[69,223,69,255],[69,223,207,255],[48,138,207,255],[138,138,223,255],[69,48,207,255],[207,48,207,255],[223,138,207,255],[227,227,227,255],[223,223,223,255],[223,223,223,255],[195,195,195,255],[178,178,178,255],[170,170,170,255],[146,146,146,255],[130,130,130,255],[113,113,113,255],[113,113,113,255],[101,101,101,255],[81,81,81,255],[65,65,65,255],[48,48,48,255],[32,32,32,255],[32,32,32,255],[243,0,0,255]];

    function truncate(vec, maxlen) {
        var len = _.count(vec);
        return _.vector.apply(null, _.into_array(
            _.subvec(vec, Math.max(0, len - maxlen), len)));
    }

    var Drawing = React.createClass({

        getInitialState: function() {
            return {
                tools: [OldPaint.Tools.pencil, OldPaint.Tools.rectangle,
                        OldPaint.Tools.ellipse, OldPaint.Tools.line,
                        OldPaint.Tools.fill, OldPaint.Tools.region],
                size: {width: 320, height: 256},
                layers: _.vector(),
                palette: new OldPaint.Palette(colors),
                brushes: _.vector(
                    new OldPaint.Brush({width: 1, height: 1}, "rectangle", 1),
                    new OldPaint.Brush({width: 7, height: 5}, "ellipse", 1),
                    new OldPaint.Brush({width: 3, height: 6}, "rectangle", 1)),
                user_brushes: _.vector(),
                undos: _.vector(), redos: _.list(),
                statusMessages: ["Hello! Welcome to OldPaint2!"]
            };
        },

        componentDidMount: function () {
            this.selectColor(1);
            this.addLayer();
        },

        render: function () {
            // The main components of the UI
            return (
                    <div className="wrapper">
                        <header> 0ldPaint </header>
                        <section>
                            {/* various widgets on the left side */}
                            <nav className="aside-1">

                                <ToolsList ref="tools"
                                           tools={this.state.tools}/>

                                <BrushesList ref="brushes"
                                             brushes={this.state.brushes}
                                             userBrushes={this.state.user_brushes}/>

                                <PaletteView ref="palette"
                                             palette={this.state.palette}
                                             setColor={this.setColor}/>

                                <ActionList undos={this.state.undos}
                                            redos={this.state.redos}
                                            setRegion={this.setRegion}
                                            undo={this.undo}
                                            redo={this.redo}/>
                            </nav>
                            <article>
                                {/* the actual drawing area */}
                                <DrawingView ref="drawing"
                                             size={this.state.size}
                                             layers={this.state.layers}
                                             palette={this.state.palette}
                                             region={this.state.currentRegion}
                                             regionTool={OldPaint.Tools.region}
                                             draw={this.drawStroke}
                                             drawEphemeral={this.drawEphemeral}
                                             undo={this.undo}
                                             redo={this.redo}
                                             makeBrush={this.makeBrush}/>

                            </article>
                            <aside className="aside-2">
                                {/* The list of "mini" layers on the side */}
                                <LayersList ref="layers"
                                            layers={this.state.layers}
                                            add={this.addLayer}
                                            remove={this.removeLayer}
                                            clear={this.clearLayer}
                                            move={this.moveLayer}
                                            hide={this.hideLayer}
                                            show={this.showLayer}/>
                            </aside>

                        </section>
                        <footer>
                            <StatusMessage messages={this.state.statusMessages}/>
                            <Coordinates ref="coords"/>
                        </footer>
                    </div>
            );
        },

        // whatever may need to be done prior to drawing a stroke
        prepareStroke: function (erase) {
            return this.clearEphemeral();
        },

        // Draw a stroke using the current tool. The stroke contains a
        // stream of mouse coordinates. It is up to the tool to handle
        // these appropriately until the stream ends, e.g. by joining them
        // with lines.
        drawStroke: function (stroke, update) {
            var tool = this.refs.tools.getCurrent();
            bus.update.plug(
                tool.draw(this.refs.layers.getCurrent(),
                          this.refs.brushes.getCurrent(),
                          this.refs.palette.getCurrent(),
                          update.bind(null, this.refs.layers.getCurrent()),
                          this.prepareStroke, this.finishStroke,
                          this.setRegion, this.setCoords, stroke));
        },

        // after a stroke is done, we need to create an undo action and
        // some other bookkeeping probably
        finishStroke: function (stroke, rect) {
            var layer = this.refs.layers.getCurrent(),
                patch = layer.patchFromBackup(rect),
                action = ["draw", {patch: patch, layer: layer,
                                   type: "tool",
                                   tool: this.refs.tools.getCurrent(),
                                   brush: this.refs.brushes.getCurrent().previewURL,
                                   color: this.state.palette.colors[
                                       stroke.erase? 0 :
                                           this.refs.palette.getCurrent()],
                                   n: actionNumber++}];
            this.pushUndo(action);
            layer.backup();
            bus.stroke.push(stroke);
        },

        cleanup: function () {
            this.clearEphemeral();
            //this.refs.layers.updatePreview();            
        },
        
        // draw something temporary, such as the brush "preview"
        drawEphemeral: function (pt, update) {
            if (this.refs.tools.getCurrent().showEphemeral) {
                var oldRect = this.clearEphemeral(),
                    brush = this.refs.brushes.getCurrent(),
                    color =  this.refs.palette.getCurrent(),
                    layer =  this.refs.layers.getCurrent();
                // make sure the brush has the current color (inefficient?)
                brush.setColor(color, this.state.palette);
                this._ephemeralRect = layer.draw_brush(brush.drawImage, pt);
                bus.update.push({
                    layer: layer,
                    rect: OldPaint.Util.union(oldRect, this._ephemeralRect)
                });
            }
        },

        clearEphemeral: function (update) {
            if (this._ephemeralRect) {
                var rect = this.refs.layers.getCurrent().restore(
                    this._ephemeralRect);
                this._ephemeralRect = null;
                return rect;
            }
        },

        addLayer: function () {
            var newLayer = new OldPaint.Layer({indexed: true,
                                               palette: this.state.palette,
                                               size: this.state.size}),
                nextLayers = _.conj(this.state.layers, newLayer);
            this.setState({layers: nextLayers});
            this.refs.layers.select(newLayer);
        },

        removeLayer: function () {
            var layer = this.refs.layers.getCurrent();
            if (layer) {
                var nextLayers = _.remove(_.partial(_.equals, layer),
                                          this.state.layers);
                this.setState({layers: _.vector.apply(null,
                                                      _.into_array(nextLayers))});
                this.refs.layers.select(null);
            }
        },

        moveLayer: function (from, to) {
            console.log("moveLayer", from, to);
            var layers = _.into_array(this.state.layers);
            var layer = layers.splice(from, 1)[0];
            layers.splice(to, 0, layer);

            console.log("newLayers", layer, layers);
            this.setState({layers: _.vector.apply(null, layers)});
        },

        selectLayer: function (layer) {
            this.setState({currentLayer: layer});
        },

        hideLayer: function (layer) {
            console.log("hideLayer", layer);
            //var nextLayers = this.state.layers.slice(0);
            layer.visible = false;
            this.setState({layers: this.state.layers});
        },

        showLayer: function (layer) {
            layer.visible = true;
            this.setState({layers: this.state.layers});
        },

        clearLayer: function () {
            var layer = this.refs.layers.getCurrent(),
                patch = layer.patchFromBackup(),
                action = ["draw", {patch: patch, layer: layer,
                                   type: "clear",
                                   tool: this.refs.tools.getCurrent(),
                                   brush: this.refs.brushes.getCurrent().previewURL,
                                   color: this.state.palette.colors[0],
                                   n: actionNumber++}];
            this.refs.drawing.getLayerView(layer).addUpdate(layer.clear());
            this.pushUndo(action);
            layer.backup();
        },

        setRegion: function (rect, release) {
            this.refs.drawing.setRegion(rect, release);
        },

        setCoords: function (coords) {
            // don't want setState on the root during drawing, too heavy
            this.refs.coords.setState(coords);
        },

        selectColor: function (colorN) {
            //this.setState({currentColor: colorN});

            _.each(this.state.brushes,
                   function (b) {b.setColor(colorN, this.state.palette);}
                       .bind(this));
        },

        setColor: function (colorN, value) {
            var colors = this.state.palette.colors;
            colors[colorN] = [value[0], value[1], value[2], 255];  // yes, I'm changing in place. Bad me.
            this.setState(
                {palette: new OldPaint.Palette(colors)}
            );
        },

        makeBrush: function (region) {
            var layer = this.refs.layers.getCurrent(),
                image = layer.subImage(region),
                brush = new OldPaint.ImageBrush(image);
            brush.update(this.state.palette);
            this.setState({user_brushes: truncate(
                _.conj(this.state.user_brushes, brush), 5)});
            this.refs.tools.select(_.get(this.state.tools, 0));
            this.refs.brushes.select(brush);
        },

        // put an action on the undo stack
        pushUndo: function (action) {
            var new_undos = _.conj(this.state.undos, action);
            this.setState({undos: truncate(new_undos, MAX_UNDOS),
                           redos: _.empty(this.state.redos)});
        },

        pushRedo: function (action) {
            this.setState({redos: _.conj(this.state.redos, action)});
        },

        // undo the latest action
        undo: function (cb) {
            console.log("undo");
            if (_.count(this.state.undos) > 0) {
                this.clearEphemeral();
                var action = _.peek(this.state.undos),
                    result = this.performAction.apply(this, action);
                console.log("undo", result);
                this.setState({undos: _.pop(this.state.undos),
                               redos: _.conj(this.state.redos, result)}, cb);
            }
            this.cleanup();
        },

        // redo the latest undo
        redo: function (cb) {
            if (_.count(this.state.redos) > 0) {
                this.clearEphemeral();
                var action = _.peek(this.state.redos),
                    result = this.performAction.apply(this, action);
                this.setState({redos: _.pop(this.state.redos),
                               undos: _.conj(this.state.undos, result)}, cb);
            }
            this.cleanup();            
        },

        // An "action" represents a change. Performing it returns a
        // new action that undoes the change. This is the basis of
        // the undo system.
        performAction: function (type, data, invert) {
            // The different types of actions available
            var palette = this.state.palette;
            var types = {
                draw: function (data, invert) {
                    data.patch = data.layer.swapPatch(data.patch, palette);
                    return data;
                },
                // add_layer: function (data, invert) {
                //     if (invert) {
                //         drawing.layers.add(data.layer, {index: data.index});
                //     else drawing.layers.remove(data.layer);
                //     return data;
                // },
                // remove_layer: function (data, invert) {
                //     if (invert) drawing.layers.remove(data.layer);
                //     else drawing.layers.add(data.layer, {index: data.index});
                //     return data;
                // },
                // merge_layer: function (data, invert) {
                //     var lower = drawing.layers.at(data.index-1);
                //     if (invert) {
                //         data.patch = lower.swap_patch(data.patch);
                //         drawing.merge_layers(drawing.layers.at(data.index),
                //                              drawing.layers.at(data.index-1), true);
                //     } else {
                //         drawing.layers.add(data.layer, {index: data.index});
                //         data.patch = lower.swap_patch(data.patch);
                //     }
                //     return data;
                // },
                // flip: function (data, invert) {
                //     if (data.horizontal) data.layer.flip_x();
                //     else data.layer.flip_y();
                //     return data;
                // }
            };
            var action = types[type];
            return [type, action(data, invert), !invert];
        }

    });


    var DrawingView = React.createClass({

        getInitialState: function () {
            return { viewport: null };
        },

        componentDidMount: function () {
            // stuff that needs to be setup after initial render
            this.updateViewPort(this.props.size);
            this._dirtyRect = null;
            this._scheduledRedraw = null;
            //var node = this.getDOMNode().parentNode;
            var node = this.refs.frame.getDOMNode();
            console.log("node", node);
            OldPaint.setupInput(node, this, this.drawStroke, this.drawEphemeral);
            bus.update.onValue(this.update);
        },

        componentDidUpdate: function () {
            // if the
            this.updateFrame();
        },

        render: function() {
            var layers =  _.map(function (l, i) {
                return <LayerView ref={l.key} key={l.key} data={l}
                                  palette={this.props.palette}
                                  viewport={this.state.viewport} n={i}/>;
            }.bind(this), this.props.layers, _.range(_.count(this.props.layers)));
            var classes = React.addons.classSet({frame: true});
            // tmp = _.zipmap(this.props.layers, _.range()),
            // tmpIndex = _.get(tmp, this.props.current) * 2 + 11;

            return (
                <div className="drawing">
                    <div ref="frame" className={classes}/>
                    {_.into_array(layers)}
                    <Region ref="region" viewport={this.state.viewport}
                            finish={this.makeBrush}
                            cancel={this.cancelBrush}/>
                </div>
            );
        },

        // === OldPaint methods ===

        getLayerView: function (layer) {
            return this.refs[layer.key];
        },

        updateViewPort: function (size) {
            var node = this.getDOMNode().parentNode,
                bbox = node.getBoundingClientRect();

            this._dirtyRect = null;
            this._scheduledRedraw = null;

            var viewport = new OldPaint.ViewPort({
                scale: 2,
                top: 0, left: 0,
                width: bbox.width, height: bbox.height,
                image_width: size.width,
                image_height: size.height
            });

            viewport.center();
            this.setState({viewport: viewport});
        },

        redraw: function () {
            this.updateViewPort(this.props.size);
        },

        updateFrame: function () {
            if (this.state.viewport) {
                var frame = this.refs.frame.getDOMNode();
                // var rect = this.state.viewport.from_image_rect(
                //     this.state.viewport.visibleImageRect);
                var rect = this.state.viewport.total_rect();
                frame.style.top = rect.top + "px";
                frame.style.left =  rect.left + "px";
                frame.style.width = rect.width + "px";
                frame.style.height = rect.height + "px";
            }
        },

        setRegion: function (rect, release) {
            this.refs.region.setRect(rect, release);
        },

        makeBrush: function (rect) {
            this.props.makeBrush(rect);
        },

        cancelBrush: function () {
            this.refs.region.setRect(null);
        },

        drawStroke: function (stroke) {
            this.props.draw(stroke, this.update);
        },

        drawEphemeral: function (pt) {
            this.props.drawEphemeral(pt, this.update);
        },

        update: function (data) {
            this.refs[data.layer.key].addUpdate(data.rect);
        },

        undo: function () {
            this.props.undo();
        },

        redo: function () {
            this.props.redo();
        },

        pan: function (delta) {
            var vp = new OldPaint.ViewPort(this.state.viewport);
            vp.left += delta.x;
            vp.top += delta.y;
            vp.recalculate();
            this.setState({viewport: vp});
        },

        change_zoom: function (delta, pos) {
            // Urrgh
            if (this.state.viewport.scale + delta > 0) {
                if (!pos) {
                    var vis = this.state.viewport.visibleImageRect;
                    img_pos = {x: vis.left + vis.width/2, y: vis.top + vis.height/2};
                    pos = this.state.viewport.from_image_coords(img_pos);
                }
                var vp = new OldPaint.ViewPort(this.state.viewport);
                vp.scale += delta;
                var img_pos = OldPaint.Util.to_image_coords(this.state.viewport, pos);
                var center = OldPaint.Util.center_on(vp, img_pos, pos);
                vp.left = center.left;
                vp.top = center.top;
                vp.recalculate();
                this.setState({viewport: vp});
            }
        },

        to_image_coords: function (pos) {
            return OldPaint.Util.to_image_coords(this.state.viewport, pos);
        },

        from_image_coords: function (pos) {
            return OldPaint.Util.from_image_coords(this.state.viewport, pos);
        }
    });


    var LayerView = React.createClass({

        getInitialState: function () {
            return {
                context: null,
                dirty: null,
                scheduledRedraw: null
            };
        },

        componentDidMount: function () {
            this.redraw();
        },

        componentDidUpdate: function () {
            this.redraw();
        },

        render: function () {
            //console.log("render layer", this.props.data.key);
            console.log("render layer");
            var cx = React.addons.classSet;
            var classes = cx({layer: true, invisible: !this.props.data.visible});
            return <canvas ref="canvas" className={classes}/>;
        },

        addUpdate: function (rect) {
            this._dirtyRect = OldPaint.Util.union(this._dirtyRect, rect);
            // batch updates so that we don't redraw more than once per frame.
            // (is this a premature optimization, I wonder...)
            if (!this._scheduledUpdate) {
                this._scheduledRedraw = window.requestAnimationFrame(
                    this.performUpdate);
            }
        },

        // tell the current layer to redraw the dirty part
        performUpdate: function () {
            // make sure we're not attempting to redraw outside the drawing
            var rect = this._dirtyRect;
            if (rect) {
                this.update(rect, true);
                this._dirtyRect = this._scheduledUpdate = null;
            }
        },

        // redraw part of the canvas
        update: function (rect, updateCanvas) {
            var visRect = OldPaint.Util.intersect(
                this.props.viewport.visibleImageRect, rect);
            if (rect) {
                var original = this.props.data.image.image;
                if (updateCanvas) original.updateCanvas(rect, this.props.palette);

                if (visRect) {
                    // if all the action is out of view, we don't redraw
                    var canvas = this.refs.canvas.getDOMNode(),
                        context = canvas.getContext("2d"),
                        dest_rect = this.props.viewport.from_image_rect(visRect);

                    context.clearRect(dest_rect.left, dest_rect.top,
                                      dest_rect.width, dest_rect.height);
                    context.drawImage(original.get_repr(),
                                      visRect.left, visRect.top,
                                      visRect.width, visRect.height,
                                      dest_rect.left, dest_rect.top,
                                      dest_rect.width, dest_rect.height);
                }
            }
        },

        // redraw the entire canvas, also updating size
        redraw: function () {
            var canvas = this.refs.canvas.getDOMNode(),
                context = canvas.getContext("2d");
            canvas.width = this.props.viewport.width;
            canvas.height = this.props.viewport.height;
            OldPaint.Util.set_smooth(context, false);
            this.update(this.props.data.image.rect(), true);
        }

    });


    var Region = React.createClass({

        getInitialState: function () {
            return {rect: null, released: false};
        },

        render: function () {
            // TODO: maybe make the handles into own component?
            if (this.props.viewport && this.state.rect) {
                var rect = this.props.viewport.from_image_rect(this.state.rect);
                return (
                    <div ref="background" className={React.addons.classSet({
                            region: true,
                            inert: this.state.released})}>
                        <div className="outer"
                            style={{
                                top: rect.top + "px",
                                left: rect.left + "px",
                                width: rect.width + "px",
                                height: rect.height + "px"
                            }}>
                            <div className={React.addons.classSet({
                                    handle: true, topleft: true,
                                    invisible: !this.state.released})}
                                 onMouseDown={this.handleGrabbed}/>
                            <div className={React.addons.classSet({
                                    handle: true, topright: true,
                                    invisible: !this.state.released})}
                                 onMouseDown={this.handleGrabbed}/>
                            <div className={React.addons.classSet({
                                    handle: true, bottomright: true,
                                    invisible: !this.state.released})}
                                 onMouseDown={this.handleGrabbed}/>
                            <div className={React.addons.classSet({
                                    handle: true, bottomleft: true,
                                    invisible: !this.state.released})}
                                 onMouseDown={this.handleGrabbed}/>
                            <div className="inner-1"></div>
                            <div className="inner-2" onClick={this.finish}/>
                        </div>
                    </div>
                );
            } else {
                return <div className="region invisible"></div>;
            }
        },

        setRect: function (rect, release) {
            if (!this.state.released && rect.width > 0 && rect.height > 0) {
                // don't allow the region to extend outside the image
                var correct = OldPaint.Util.intersect(
                    rect, this.props.viewport.image_rect());
                this.setState({rect: correct, released: release});
            } else {
                this.setState({rect: null, released: false});
            }
        },

        // finish the region (e.g. to create a brush);
        finish: function () {
            console.log("finish");
            this.props.finish(this.state.rect);
            this.setRect(null);
        },

        // The user has stopped modifying the region (released the mouse button)
        release: function () {
            this.setState({released: true});
            this.refs.background.getDOMNode().removeEventListener(
                "mousemove", this.handleMoved);
            this._dragstart = this._corner = null;
        },

        // return whichever corner the element represents
        _get_corner: function (el) {
            if (el.classList.contains("topleft")) return "topleft";
            if (el.classList.contains("topright")) return "topright";
            if (el.classList.contains("bottomright")) return "bottomright";
            if (el.classList.contains("bottomleft")) return "bottomleft";
            return null;
        },

        // return the corner and the opposite corner's points
        _get_points: function (rect, corner) {
            switch (corner) {
            case "topleft":
                return [{x: rect.left, y: rect.top},
                        {x: rect.left + rect.width, y: rect.top + rect.height}];
            case "topright":
                return [{x: rect.left + rect.width, y: rect.top},
                        {x: rect.left, y: rect.top + rect.height}];
            case "bottomright":
                return [{x: rect.left + rect.width, y: rect.top + rect.height},
                        {x: rect.left, y: rect.top}];
            case "bottomleft":
                return [{x: rect.left, y: rect.top + rect.height},
                        {x: rect.left + rect.width, y: rect.top}];
            }
            return null;
        },

        // The user is grabbing a corner handle
        handleGrabbed: function (event) {
            this._corner = this._get_corner(event.target);
            console.log("handleGrabbed", this._corner);
            this.setState({released: false});
            this.refs.background.getDOMNode().addEventListener(
                "mousemove", this.handleMoved);
            document.addEventListener("mouseup", this.release);
        },

        // the user is dragging one of the corner handles
        handleMoved: function (event) {
            if (!this._dragstart) {
                var points = this._get_points(this.state.rect, this._corner);
                this._dragstart = {
                    handle: this._corner,
                    point: points[0],
                    opposite_point: points[1],
                    x: event.clientX,
                    y: event.clientY};
            } else {
                var scale = this.props.viewport.scale,
                    deltaX = Math.round((event.clientX - this._dragstart.x) /
                                        scale),
                    deltaY = Math.round((event.clientY - this._dragstart.y) /
                                        scale),
                    point = {x: this._dragstart.point.x + deltaX,
                             y: this._dragstart.point.y + deltaY};
                this.setRect(OldPaint.Util.rectify(
                    this._dragstart.opposite_point, point));
            }
        }

    });


    var LayersList = React.createClass({

        getInitialState: function () {
            return {current: null};
        },

        componentWillReceiveProps: function (props) {
            if (this.state.current === null)
                this.setState({current: _.get(props.layers, 0)});
        },

        render: function () {

            this._placeholder = document.createElement("div");
            this._placeholder.className = "placeholder";

            var layers = _.map(function(l, i) {
                return (
                    <div key={l.key} data-id={i}
                         draggable="true"
                         onDragEnd={this.dragEnd}
                         onDragStart={this.dragStart}>
                        <LayerPreview key={l.key} ref={"layer-" + l.key}
                            data={l} selected={l === this.state.current}
                            select={this.select}
                            show={this.props.show}
                            hide={this.props.hide}/>
                    </div>
                );
            }.bind(this), this.props.layers, _.range());

            return (
                <div className="layers">
                    <div className="title"> Layers </div>
                    <div className="container">
                        <div className="layers" onDragOver={this.dragOver}>
                            {_.into_array(_.reverse(layers))}
                        </div>
                        <div className="subcontainer">
                            <button onClick={this.props.add}> Add </button>
                            <button onClick={this.props.remove}> Remove </button>
                            <button onClick={this.props.clear}> Clear </button>
                        </div>
                    </div>
                </div>
            );
        },

        select: function (l) {
            this.setState({current: l});
        },

        getCurrent: function () {
            return this.state.current;
        },

        updatePreview: function () {
            console.log("refs", this.refs, "layer-", this.state.current.key);
            var preview = this.refs["layer-" + this.state.current.key];
            preview.update();
        },

        // Drag'n drop

        dragStart: function(e) {
            this.dragged = e.currentTarget;
            this.siblings = this.dragged.parentNode.children;

            for(var i=0; i<this.siblings.length; i++) {
                this.siblings[i].classList.add("droppable");
            }

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.dropEffect = "move";
            e.dataTransfer.setData("text/html", e.currentTarget);
        },

        dragOver: function(e) {

            e.preventDefault();

            if(e.target.className == "placeholder" ||
               !e.target.classList.contains("droppable")) return;
            this.dragged.style.display = "none";
            this.over = e.target;

            // make drop zone depend on where we are on the target
            var relY = e.clientY - this.over.offsetTop,
                height = this.over.offsetHeight / 2,
                parent = e.target.parentNode;

            if(relY > height) {
                this.nodePlacement = "after";
                parent.insertBefore(this._placeholder, e.target.nextElementSibling);
            }
            else if(relY < height) {
                this.nodePlacement = "before";
                parent.insertBefore(this._placeholder, e.target);
            }
        },

        dragEnd: function(e) {

            this.dragged.style.display = "block";
            this.dragged.parentNode.removeChild(this._placeholder);

            for(var i=0; i<this.siblings.length; i++) {
                this.siblings[i].classList.remove("droppable");
            }

            var from = Number(this.dragged.dataset.id),
                to = Number(this.over.dataset.id);

            if (from > to) {to++;}
            if (this.nodePlacement == "after") {to--;}

            this.props.move(from, to);
        }

    });


    var LayerPreview = React.createClass({

        componentDidMount: function () {
            var container = this.refs.container.getDOMNode(),
                image = this.props.data.image.image.get_data_image();
            container.appendChild(image);
            bus.stroke.onValue(this.update);
        },

        componendDidUpdate: function () {
            this.update();
        },
        
        render: function () {
            var cx = React.addons.classSet,
                classes = cx({"layer-preview": true,
                              selected: this.props.selected});
            return (<table draggable="false">
                        <tr className={classes} onClick={this.select}>
                            <td ref="container">
                            </td>
                            <td>
                                <input type="checkbox"
                                       checked={this.props.data.visible}
                                       onChange={this.visibilityChange}/>
                            </td>
                        </tr>
                    </table>);
        },

        update: function () {
            var image = this.refs.container.getDOMNode().firstChild;
            image.src = this.props.data.image.image.get_repr().toDataURL();
        },
        
        select: function () {
            this.props.select(this.props.data);
        },

        visibilityChange: function(event) {
            var value = event.target.checked;
            console.log("visibilityChange", event.target);
            if (value) {
                this.props.show(this.props.data);
            } else {
                this.props.hide(this.props.data);
            }
        }

    });


    var ToolsList = React.createClass({

        getInitialState: function () {
            return {current: null};
        },

        componentWillMount: function () {
            this.setState({current: this.props.tools[0]});
        },

        render: function () {
            var select = this.select, current = this.state.current,
                cx = React.addons.classSet,
                tools = this.props.tools.map(function (t) {
                    var classes = cx({tool: true,
                                      selected: t == current});
                    return <button key={t.name} className={classes}
                                   onClick={function () {select(t);}}>
                               <img src={t.icon}/>
                           </button>;
            }.bind(this));

            return <div>
                       <div className="title"> Tools </div>
                       <div className="container tools">
                           {tools}
                       </div>
                   </div>;
        },

        select: function (tool) {
            this.setState({current: tool});
        },

        getCurrent: function () {
            return this.state.current;
        }

    });


    var BrushesList = React.createClass({

        getInitialState: function () {
            return {current: null};
        },

        componentWillMount: function () {
            this.setState({current: _.get(this.props.brushes, 0)});
        },

        render: function () {
            var brushes = _.map(function (b) {
                return <BrushPreview key={b.key} brush={b}
                selected={this.state.current === b}
                select={this.select}/>;
            }.bind(this), _.concat(this.props.brushes, this.props.userBrushes));
            return (
                <div>
                    <div className="title"> Brushes </div>
                    <div className="container brushes">
                        {_.into_array(brushes)}
                    </div>
                </div>
            );
        },

        select: function (b) {
            this.setState({current: b});
        },

        getCurrent: function () {
            return this.state.current;
        }
    });


    var BrushPreview = React.createClass({

        componentDidMount: function () {
            this.props.brush.renderPreview(this.refs.canvas.getDOMNode());
            // var context = this.refs.canvas.getDOMNode().getContext("2d");
            // context.drawImage(this.props.brush.preview.image.get_repr(),
            //                   0, 0, this.props.brush.size.width,
            //                   this.props.brush.size.height);
        },

        render: function () {
            var cx = React.addons.classSet;
            var classes = cx({"brush-container": true,
                              "selected": this.props.selected}),
                size = this.props.brush.getPreviewSize();
            return (<table className="brush">
                    <tr key={this.props.key} className={classes}
                        onClick={this.select}>
                        <td>
                            <canvas ref="canvas" className="brush-preview"
                                    width={size.width}
                                    height={size.height}/>
                        </td>

                        <td className="description">
                            {this.props.brush.shape + " [" +
                             this.props.brush.size.width + "·" +
                             this.props.brush.size.height + "]"}
                        </td>
                    </tr>
                   </table>);
        },

        select: function () {
            this.props.select(this.props.brush);
        }
    });


    var PaletteView = React.createClass({

        getInitialState: function () {
            return {showEditor: false, current: 1};
        },

        render: function () {
            var columns = 8,
                rows = Math.ceil(this.props.palette.colors.length / columns),
                table = [], current = this.state.current, select = this.select;

            function makeSwatch(c, i) {
                var hex = OldPaint.Util.colorToHex(c),
                    classes = React.addons.classSet(
                        {swatch: true, selected: current == i});
                return <td key={i} className={classes}
                           onClick={function () {select(i);}}>
                           <div className={classes}
                                style={{backgroundColor: "#" + hex}}> </div>
                       </td>;
            }

            var colors = _.map(
                function (r, i) {
                    return (
                        <tr key={i} className="row">
                            {_.into_array(_.map(makeSwatch,
                                                      r, _.range(i, i+columns)))}
                        </tr>);
                },
                _.partition(columns, columns, [0,0,0,0],
                               this.props.palette.colors),
                _.range(0, this.props.palette.colors.length, columns));

            var getCurrentColor = function () {
                var rgba = this.props.palette.colors[this.state.current];
                return "#" + OldPaint.Util.colorToHex(rgba);
            }.bind(this);

            return(
                <div className="palette">
                    <div className="title"> Palette </div>
                    <div className="container">
                        <table className="palette">
                            {_.into_array(colors)}
                        </table>
                        <input type="color" value={getCurrentColor()}
                               onChange={this.colorChanged}>
                        </input>
                    </div>
                </div>
            );
        },

        toggleEditor: function () {
            this.setState({showEditor: !this.state.showEditor});
        },

        select: function (color) {
            this.setState({current: color});
        },

        getCurrent: function () {
            return this.state.current;
        },

        getCurrentRGB: function () {
            return this.props.palette.colors[this.state.current];
        },

        colorChanged: function (event) {
            var value = OldPaint.Util.hexStringToRGB(event.target.value.slice(1));
            this.props.setColor(this.props.current, value);
        }

    });

    var ColorEditor = React.createClass({

        getInitialState: function () {
            return {red: 0, green: 0, blue: 0};
        },

        componentWillMount: function () {
            this.setState({red: this.props.red,
                           green: this.props.green,
                           blue: this.props.blue});
        },

        render: function () {
            var classes = React.addons.classSet(
                {"invisible": !this.props.visible}), sliderMoved = this.sliderMoved;

            return (
                <div className={classes}>
                    <div className="color-editor">
                        <input className="color red" value={this.state.red}
                               ref="redSlider" type="range" min="0" max="255"
                               onInput={function (e) {sliderMoved(0, e)}}/>
                        <input className="color red"
                               ref="redSlider" type="range" min="0" max="255"
                               onInput={function (e) {sliderMoved(1, e)}}/>
                    </div>
                </div>
            );
        },

        sliderMoved: function (n, evt) {
            var colorValue = parseInt(evt.target.value);
            console.log("color", n, colorValue);
        }

    });


    var ActionList = React.createClass({

        render: function () {

            console.log("ActionList");

            var undos = _.map(function (a, i) {
                var data = a[1];
                return <Action key={data.n} data={data} redo={false}
                               setRegion={this.props.setRegion}
                               act={this.props.undo} n={i}/>;
            }.bind(this), this.props.undos,
                          _.range(_.count(this.props.undos), 0, -1));

            var redos = _.map(function (a, i) {
                var data = a[1];
                return <Action key={data.n} data={data} redo={true}
                               setRegion={this.props.setRegion}
                               act={this.props.redo} n={i+1}/>;
            }.bind(this), this.props.redos, _.range());

            return (
                <div className="actions">
                    <div className="title"> Actions </div>
                    <div className="container">
                        <table>
                            { _.into_array(undos) }
                            { _.into_array(redos) }
                        </table>
                    </div>
                </div>
            );
        }

    });


    var Action = React.createClass({
        render: function () {
            var classes = React.addons.classSet({action: true,
                                                 redo: this.props.redo});
            return (
                <tr className={classes} onClick={this.act}
                          onMouseEnter={this.hover}
                          onMouseLeave={this.unHover}>
                    <td> {this.props.data.n} </td>
                    <td className="desc"> {this.props.data.type} </td>
                    <td className="icon">
                        <img src={this.props.data.tool.icon}/>
                    </td>
                    <td className="brush">
                        <img src={this.props.data.brush}/>
                    </td>
                    <td className="swatch"
                         style={{backgroundColor: "#" + OldPaint.Util.colorToHex(this.props.data.color)}}>
                    </td>
                </tr>
            );
        },

        act: function () {
            var setRegion = this.props.setRegion, act = this.props.act,
                inner = function (n) {
                    console.log("act", n);
                    if (n > 0) {
                        act(inner.bind(this, n-1));
                    } else {
                        setRegion(null);
                    }
                };
            inner(this.props.n);
        },

        hover: function () {
            //this.props.setRegion(this.props.data.patch.rect);
        },

        unHover: function () {
            //this.props.setRegion(null);
        }


    });


    var StatusMessage = React.createClass({
        render: function () {
            return (
                <div className="message">
                    {_.last(this.props.messages)}
                </div>
            );
        }
    });


    var Coordinates = React.createClass({

        getInitialState: function () {
            return {x: null, y: null};
        },

        render: function () {
            return (
                <div className="coordinates">
                    {"x: " + this.state.x + " y: " + this.state.y}
                </div>
            );
        }
    });


    React.renderComponent(
            <Drawing/>,
        document.querySelector('body')
    );

})();
