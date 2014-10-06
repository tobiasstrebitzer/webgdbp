(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "Keyboard": Keyboard
        }
    });

    function Keyboard(options) {
        var _self = this;
        var _options;
        var _defaults = {
            commands: [{
                macro: "alt > right",
                fn: function(event, keysPressedArray, keyComboString) {
                    library.get("handler").run();
                }
            },{
                macro: "alt > down",
                fn: function(event, keysPressedArray, keyComboString) {
                    library.get("handler").step_into();
                }
            },{
                macro: "alt > up",
                fn: function(event, keysPressedArray, keyComboString) {
                    library.get("handler").step_out();
                }
            },{
                macro: "alt > left",
                fn: function(event, keysPressedArray, keyComboString) {
                    library.get("handler").step_over();
                }
            },{
                macro: "escape",
                fn: function(event, keysPressedArray, keyComboString) {
                    library.get("handler").stop();
                }
            }]
        };
        
        function initCommands() {
            for (var i=0; i<_options.commands.length; i++) {
                var command = _options.commands[i];
                KeyboardJS.on(command.macro, command.fn);
            }
        }
        
        function init() {
            _options = $.extend(true, {}, _defaults, options);
            initCommands();
        }
        
        init();

        $.extend(this, {
            "init": init
        });
    }
})(jQuery);



