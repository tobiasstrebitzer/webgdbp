(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "Chruby": Chruby
        }
    });

    function Chruby(options) {
        var _self = this;
        var _options;
        var _defaults = {
            filename: "",
            host: "127.0.0.1",
            port: 9002,
            enabled: true,
            onConnect: function() {},
            onDisconnect: function() {},
        };
        var client;
        var callbackRegistry = {};
        var transactionId = 1;
        var tcpClient;
        var buffer;

        function init() {
            _options = $.extend(true, {}, _defaults, options);
            buffer = "";
            
            if(_options.enabled) {
                connect();
            }
        }
        
        function connect() {
            tcpClient = new TcpClient(_options.host, _options.port);
            tcpClient.connect(function(resultCode) {
                if(resultCode >= 0) {
                    _options.onConnect();
                    _options.enabled = true;
                    tcpClient.addResponseListener(responseListener);
                }else{
                    shutdown();
                }
            });
        }
        
        function shutdown() {
            if(tcpClient) {
                _options.enabled = false;
                _options.onDisconnect();
                tcpClient.disconnect();
                tcpClient = null;                
            }
        }
        
        function responseListener(response) {
            if($.trim(response) != "") {
                buffer += response;
                
                if(buffer.charAt(buffer.length-1) == '\n') {
                    buffer.slice(0, -1);
                    var response = jQuery.parseJSON(buffer);
                    buffer = "";
                    if(callbackRegistry[response.transactionId]) {
                        callbackRegistry[response.transactionId].call(_self, response);
                    }                    
                }
                
            }
        }
        
        function api(command, options, callback) {
            
            if(!tcpClient) {
                callback();
                return false;
            }
            
            callbackRegistry[transactionId] = callback;
            var request = {
                command: command,
                options: options,
                transactionId: transactionId
            };
            tcpClient.sendMessage(JSON.stringify(request), function() {} );
            transactionId++;
        }
        
        function isEnabled() {
            return _options.enabled;
        }
        
        function disable() {
            _options.enabled = false;
        }
        
        init();

        $.extend(this, {
            "init": init,
            "api": api,
            "disable": disable,
            "isEnabled": isEnabled,
            "shutdown": shutdown,
            "connect": connect
        });
    }
    
})(jQuery);



