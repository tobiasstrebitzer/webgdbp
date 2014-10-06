(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "PanelFactory": PanelFactory
        }
    });

    function PanelFactory(options, $container) {
        var _self = this;
        var _options;
        var _defaults = {
            
        };
        var items;
        var active;
        
        function clear() {
            $container.html("");
            items = {};
        }
        
        function addItem(id, title, template, callback) {

            var $panelbox = $("<div>");
            $panelbox.addClass("panelbox");
            $panelbox.data("id", id);
            $panelbox.hide();
            $container.append($panelbox);

            var $panelboxinner = $("<div>");
            $panelboxinner.addClass("panelbox-inner");
            $panelbox.append($panelboxinner);

            var $title = $("<h2>");
            $title.html(title);
            $panelboxinner.append($title);

            var $content = $("<div>");
            $content.addClass("content");
            $panelboxinner.append($content);

            // Load panel data
            $content.load("views/"+template+".html", function() {
                $panelbox.fadeIn("fast");
                callback($panelbox);
            });

            items[id] = $panelbox;

        }

        function getItem(id) {
            return items[id];
        }
        
        function getItems() {
            return items;
        }

        function init() {
            items = {};
        }
        
        init();

        $.extend(this, {
            "init": init,
            "clear": clear,
            "addItem": addItem,
            "getItem": getItem,
            "getItems": getItems
        });
    }
})(jQuery);





