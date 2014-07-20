var OldPaint = window.OldPaint || {};


OldPaint.Brush = (function () {

    var key = 0;

    var toString = Object.prototype.toString;

    function isString (obj) {
        return toString.call(obj) == '[object String]';
    }

    var Brush = function (size, shape) {
	this.size = size;
        this.shape = shape;
        this.color = null;

        this.key = key++;


        // shape is e.g. "ellipse"

        var spec = {indexed: false, size: size};
        // shown by the UI preview
	this.preview = new OldPaint.Image(spec);
        // used for drawing
	this.draw = new OldPaint.Image(spec);
        // used for erasing
	this.erase = new OldPaint.Image(spec);

        // a temporary palette to draw the preview
        var palette = new OldPaint.Palette([[0, 0, 0, 255]]);

	this[shape](this.preview, 0, palette);

        // TODO: erase-brush should be drawn on the fly
	this[shape](this.erase, 0, palette);

        // create image versions; slightly faster than canvas for drawing
        this.drawImage = this.draw.image.get_data_image();
        this.eraseImage = this.erase.image.get_data_image();
        this.previewURL = this.preview.image.get_repr().toDataURL();
    };

    Brush.prototype.setColor = function (color, palette) {
        if (color != this.color) {
            console.log("setColor", color, palette);
            this.color = color;
            this[this.shape](this.draw, color, palette);
            this.drawImage = this.draw.image.get_data_image();
        }
    };


    Brush.prototype.getPreviewSize = function () {
        var ratio = this.size.height / this.size.width,
            width = Math.min(64, this.size.width);
        return {width: width, height: Math.round(ratio * width)};
    };

    Brush.prototype.renderPreview = function (canvas) {
        var context = canvas.getContext("2d");
        context.drawImage(this.preview.image.get_repr(),
                          0, 0, this.size.width, this.size.height,
                          0, 0, canvas.width, canvas.height);
    };

    Brush.prototype.ellipse = function (image, color, palette) {
        console.log(palette);
	image.image.draw_filled_ellipse(
	    {x: Math.floor(this.size.width / 2),
	     y: Math.floor(this.size.height / 2)},
            {x: Math.floor(this.size.width / 2),
             y: Math.floor(this.size.height / 2)}, color, palette);
    };

    Brush.prototype.rectangle = function (image, color, palette) {
        image.image.draw_filled_rectangle(
            {x: 0, y: 0}, {x: this.size.width, y: this.size.height},
            color, palette);
    };

    return Brush;

})();
