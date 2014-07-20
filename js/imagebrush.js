var OldPaint = window.OldPaint || {};


OldPaint.ImageBrush = (function () {

    var key = 1000;
    var maxPreviewSize = 64;

    var toString = Object.prototype.toString;

    function isString (obj) {
        return toString.call(obj) == '[object String]';
    }

    var ImageBrush = function (image) {
        this.size = image.image.get_size();
        this.shape = "image";
        this.color = null;

        this.key = key++;

        this._image = image;
        this.draw = image.copy();
        this.preview = image.copy();
        this.erase = image.copy();
        // a temporary palette to draw the erase
        var palette = new OldPaint.Palette([[0, 0, 0, 0]]);

        // create image versions; slightly faster than canvas for drawing
        this.drawImage = this.draw.image.get_data_image();
        this.eraseImage = this.erase.image.get_data_image();
        this.previewURL = null;
    };

    ImageBrush.prototype.update = function (palette) {
        // Update the preview with the current palette
        this.preview.image.updateCanvas(this.preview.rect(), palette);

        // update the alpha of the brush, so that transparent
        // parts are not drawn.
        this.draw.image.updateAlpha(this.erase.rect(), palette);
        this.erase.image.updateAlpha(this.erase.rect(), palette);
        this.erase.image.colorize(0);
        this.drawImage = this.draw.image.get_data_image();
        this.eraseImage = this.erase.image.get_data_image();
    };

    ImageBrush.prototype.setColor = function (color, palette) {
        if (color != this.color) {
            console.log("setColor", color, palette);
            this.color = color;
            this.drawImage = this.draw.image.get_data_image();
            //this[this.shape](this.draw, color, palette);
        }
    };

    ImageBrush.prototype.getPreviewSize = function () {
        var ratio = this.size.height / this.size.width, width, height;
        if (this.size.width > maxPreviewSize) {
            if (this.size.height > this.size.width) {
                height = maxPreviewSize, width = height / ratio;
            } else {
                width = maxPreviewSize, height = width * ratio;
            }
        } else if (this.size.height > maxPreviewSize) {
            height = maxPreviewSize, width = height / ratio;
        } else {
            height = this.size.height, width = this.size.width;
        }
        return {width: width, height: height};
    };

    ImageBrush.prototype.renderPreview = function (canvas) {
        var context = canvas.getContext("2d");
        context.drawImage(this.preview.image.get_repr(),
                          0, 0, this.size.width, this.size.height,
                          0, 0, canvas.width, canvas.height);
    };

    return ImageBrush;

})();
