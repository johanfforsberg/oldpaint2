var OldPaint = window.OldPaint || {};

OldPaint.Patch = (function () {

    var Patch = function (rect, canvas) {
        this.rect = rect;
        this.canvas = OldPaint.Util.copy_canvas(canvas, rect);
    };

    Patch.prototype.blit = function (canvas, clear) {
        if (clear) {
            canvas.clearRect(this.rect.left, this.rect.top,
                             this.rect.width, this.rect.height);
        }
        canvas.drawImage(this.canvas, this.rect.left, this.rect.top);
    };

    return Patch;

})();
