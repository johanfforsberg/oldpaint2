var OldPaint = window.OldPaint || {};

OldPaint.Layer = (function () {

    var key = 0;

    var Layer = function (spec, image) {
        //this.title = title;
        this.visible = true;

        console.log("creating layer");

        this.image = image || new OldPaint.Image(spec);

        this.backup();

        this.key = key;
        key += 1;
    };

    Layer.prototype.draw_brush = function (brush, p) {
        return this.image.image.draw_brush(p, brush);
    };

    // draw a line between two points
    Layer.prototype.draw_line = function (brush, pts) {
        var p0 = pts[0], p1 = pts[1];
        return this.image.image.draw_line(p0, p1, brush);
    };

    Layer.prototype.draw_rectangle = function (brush, p0, size) {
        return this.image.image.draw_rectangle(p0, size, brush);
    };

    Layer.prototype.draw_ellipse = function (brush, p0, size) {
        return this.image.image.draw_ellipse(p0, size, brush);
    };

    Layer.prototype.draw_fill = function (color, p, erase) {
        return this.image.image.draw_fill(p, color, erase);
    };

    Layer.prototype.backup = function (rect) {
        if (rect) {
            this._backup_context.clearRect(rect.left, rect.top,
                                           rect.width, rect.height);
            this._backup_context.drawImage(this.image.image.get_data(),
                                           rect.left, rect.top,
                                           rect.width, rect.height,
                                           rect.left, rect.top,
                                           rect.width, rect.height);
        } else {
            if (this._backup) {
                this._backup.width = this._backup.width;  // clear all
                this._backup_context.drawImage(this.image.image.get_data(), 0, 0);
            } else {
                this._backup = OldPaint.Util.copy_canvas(this.image.image.get_data());
            }
            this._backup_context = this._backup.getContext('2d');
        }
    };

    Layer.prototype.restore = function (rect) {
        //rect = rect || this._rect();
        if (rect && this._backup) {
            this.image.image.blit(this._backup, rect, rect, true);
        }
        return rect;
    };

    Layer.prototype.restore_last = function () {
        if (this.last_rect) {
            var rect = this.restore(this.last_rect);
            this.last_rect = rect;
            return rect;
        }
        return null;
    };

    Layer.prototype.subImage = function (rect) {
        var truncrect = OldPaint.Util.intersect(rect, this.image.rect());
        var sub = OldPaint.Util.copy_canvas(this.image.image.get_data(), rect);
        return new OldPaint.Image({indexed: true, size: rect,
                                   image: sub});
    };

    Layer.prototype.patchFromBackup = function (rect) {
        var truncrect = OldPaint.Util.intersect(rect, this.image.rect());
        return new OldPaint.Patch(truncrect, this._backup);
    };

    Layer.prototype.swapPatch = function (patch) {
        var image = this.image.image;
        var patch2 = new OldPaint.Patch(patch.rect, image.get_data());
        image.blit(patch.canvas,
                   {left: 0, top: 0, width: patch.canvas.width,
                    height: patch.canvas.height}, patch.rect, true);
        this.backup();
        return patch2;
    };

    Layer.prototype.updateAlpha = function (rect, palette) {
        this.image.image.updateAlpha(rect, palette);
    };

    return Layer;


})();
