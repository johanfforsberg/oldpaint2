var OldPaint = window.OldPaint || {};


OldPaint.ViewPort = (function () {

    function ViewPort(spec) {
        //console.log("ViewPort", spec);
        this.scale = spec.scale;
        this.image_width = spec.image_width;
        this.image_height = spec.image_height;
        this.top = spec.top;
        this.left = spec.left;
        this.width = spec.width;
        this.height = spec.height;

        this.recalculate();
    }

    ViewPort.prototype.recalculate = function () {
        this.visibleImageRect = OldPaint.Util.visible(this);  //.visible();
    };

    ViewPort.prototype.set_zoom = function (zoom) {
        this._zoom = zoom;
        this.scale(Math.pow(2, zoom));
    };

    ViewPort.prototype.change_zoom = function (delta, pos) {
        pos = pos || {x: this.width/2,
                      y: this.height/2};
        var img_pos = this.to_image_coords(pos);
        this.set_zoom((this._zoom || 0) + delta);
        this.center_on(img_pos, pos);
    };

    ViewPort.prototype.center = function () {
        var current_pos = this.from_image_coords({x: this.image_width/2, y:this.image_height/2});
        this.left = Math.round(this.left - (current_pos.x - this.width/2));
        this.top = Math.round(this.top - (current_pos.y - this.height/2));
        this.recalculate();
    };

    ViewPort.prototype.center_on = function (image_pos, mouse_pos) {
        var current_pos = this.from_image_coords(image_pos);
        this.left = Math.round(this.left - (current_pos.x - mouse_pos.x));
        this.top = Math.round(this.top - (current_pos.y - mouse_pos.y));
    };

    ViewPort.prototype.to_image_coords = function (pos) {
        var res = {x: Math.floor((pos.x - this.left) / this.scale),
                   y: Math.floor((pos.y - this.top) / this.scale)};
        return res;
    };

    ViewPort.prototype.from_image_coords = function (pos) {
        return {x: pos.x * this.scale + this.left,
                y: pos.y * this.scale + this.top};
    };

    ViewPort.prototype.from_image_rect = function (rect) {
        return {left: Math.floor(rect.left * this.scale + this.left),
                top: Math.floor(rect.top * this.scale + this.top),
                width: Math.ceil(rect.width * this.scale),
                height: Math.ceil(rect.height * this.scale)};
    };

    ViewPort.prototype.in_image = function (pos) {
        return ((pos.x >= 0) && (pos.x < this.image_width) &&
                (pos.y >= 0) && (pos.y < this.image_height));
    };

    ViewPort.prototype.visible = function () {
        var topleft = this.to_image_coords({x: 0, y: 0}),
            botright = this.to_image_coords(
                {x: this.width, y: this.height}),
            left = Math.max(0, topleft.x),
            top = Math.max(0, topleft.y),
            width = Math.min(this.image_width, botright.x + 1) - left,
            height = Math.min(this.image_height, botright.y + 1) - top;
        if (width > 0 && height > 0)
            return OldPaint.Util.rect(Math.floor(left), Math.floor(top),
                                      Math.ceil(width), Math.ceil(height));
        else
            return null;
    };

    Object.defineProperty(ViewPort.prototype, "zoom", {
        get: function() {return this._zoom; },
        set: function(z) { this.set_zoom(z); }
    });

    return ViewPort;

})();
