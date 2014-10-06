(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "Library": Library
        }
    });

    function Library(options) {
        var _self = this;
        var _options;
        var _defaults = {};
        var components;

        function add(id, component) {
            components[id] = component;
            return component;
        }

        function remove(id) {
            delete(components[id]);
        }
        
        function clear() {
            components = {};
        }

        function get(id) {
            return components[id];
        }

        function init() {
            components = {};
        }
        
        init();

        $.extend(this, {
            "init": init,
            "clear": clear,
            "add": add,
            "get": get,
            "remove": remove
        });
    }
})(jQuery);



