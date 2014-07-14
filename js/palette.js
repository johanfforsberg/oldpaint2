var OldPaint = window.OldPaint || {};


OldPaint.Palette = (function () {

    function color32 (color) {
        return ((color[3] << 24) |
                (color[2] << 16) |
                (color[1] << 8) |
                color[0]);
    }
    
    var Palette = function (colors) {
        this.colors = colors;
        this.colors32 = new Int32Array(this.colors.length);
        for (var i=0; i<this.colors.length; i++) {        
            this.colors32[i] = color32(this.colors[i]);
        }
    };
    
    return Palette;
    
})();
