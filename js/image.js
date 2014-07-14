var OldPaint = window.OldPaint || {};


OldPaint.Image = (function () {

    // var Image = Model("Image")
    //         .attr("title")
    //         .attr('last_rect', Util.EventedRect);

    var key = 0;

    var Image = function (spec) {
        this.key = key;
        key += 1;
        this.title = spec.title;
        this.image = new OldPaint.IndexedImage(spec);
        console.log("hej");

        this.bus = new Bacon.Bus();

        this.visible = true;
    };

    Image.prototype.rect = function () {
        var size = this.image.get_size();
        return OldPaint.Util.rect(0, 0, size.width, size.height);
    };

    Image.prototype.draw = function (cmd, args, brush) {
        var //command = arguments[0],
            //args = Array.prototype.slice.call(arguments, 1),
            rect = this.image["draw_" + cmd].apply(this.image, args);
        this.last_rect = rect;
        return rect;
    };

    Image.prototype._draw = function () {
        var rect = this._draw.apply(this, arguments);
        // this.bus && this.bus.push(rect);
        return rect;
    };

    Image.prototype.draw_ephemeral = function () {
        var last_rect = this.restore_last(),
            rect = this._draw.apply(this, arguments);
        //this.bus && this.bus.push(Util.union(rect, last_rect));
        return rect;
    };

    return Image;

})();
