(function($) {
    // register namespace
    $.extend(true, window, {
        "Socket": {
            "Handler": Handler
        }
    });

    function Handler(options) {
        var _self = this;
        var _options;
        var _defaults = {
            port: 9000,
            address: "127.0.0.1",
            onAccept: function(onAcceptResult) {},
            onDisconnect: function(onDisconnectResult) {}
        };
        var connection;
        var server;
        var info;
        var transactionId;
        var callbackRegistry;
        var $handler;
        var breakpoints;
        var requests;
        var activeBreakpoint;
        var buffer;
        var chainRegistry;

        function init() {
            _options = $.extend(true, {}, _defaults, options);
            $handler = $(_self);
            chainRegistry = {};
            buffer = new GDBp.Buffer();
            server = new SocketServer(_options.address, _options.port);
            initEvents();
            start();
        }
                
        function registerCommand(command, event) {
            $handler.on(["gdbp", command].join(":"), event);
            _self[command] = function() {
                var options, callback;
                if(arguments.length == 1) {
                    options = {};
                    callback = arguments[0];
                }else{
                    options = arguments[0];
                    callback = arguments[1];
                }
                $handler.trigger(["gdbp", command].join(":"), [options, callback]);
            }
        }
        
        function initEvents() {
            registerCommand("run", onSimpleEvent);
            registerCommand("stop", onSimpleEvent);
            registerCommand("context_get", onSimpleEvent);
            registerCommand("context_names", onSimpleEvent);
            registerCommand("breakpoint_set", onSimpleEvent);
            registerCommand("breakpoint_remove", onSimpleEvent);
            registerCommand("step_into", onSimpleEvent);
            registerCommand("step_over", onSimpleEvent);
            registerCommand("step_out", onSimpleEvent);
            registerCommand("stack_depth", onSimpleEvent);
            registerCommand("stack_get", onSimpleEvent);
            registerCommand("source", onSimpleEvent);
            registerCommand("detach", onSimpleEvent);
        }

        function onSimpleEvent(event, options, callback) {
            var type = event.type;
            var command = type.split(":")[1];
            sendCommand(command, options, callback);
        }
        
        function start() {
            
            // Reset variables
            transactionId = 1;
            activeBreakpoint = false;
            breakpoints = {};
            requests = {};
            callbackRegistry = {};
            
            // Disconnect (if server exists)
            if (server && server.isConnected()) { server.disconnect(); }
            
            // Start server
            server.listen(onAcceptCallback, onDisconnectCallback, onDataRead);
        }
        
        function restart() {
            start();
        }
        
        function shutdown() {
            if (connection) { connection.disconnect(); }
            if (server && server.isConnected()) { server.disconnect(); }
        }
        
        function state() {
            if (server) {
                return {isConnected: server.isConnected(),
                    addr: server.addr,
                    port: server.port
                };
            } else {
                return {isConnected: false};
            }
        }

        function onAcceptCallback(tcpConnection, socketInfo) {
            connection = tcpConnection;
            info = socketInfo;
            library.get("ui").status("connection established");
            $handler.trigger("ui:focus");
            
            // Reset variables
            transactionId = 1;
            activeBreakpoint = false;
            breakpoints = {};
            requests = {};
            callbackRegistry = {};
            
        }
        
        function onDisconnectCallback() {
            
            // Update UI
            library.get("ui").status("connection closed");
            library.get("ui").closeEditor();
            
        }
        
        function sendCommand(command, options, callback) {
            
            // Send false if no connection exists
            if(!connection) {
                if(callback) { callback(false); }
                return false;
            }
            
            options = options || {};
            
            // Register callback
            if(callback) {
                callbackRegistry[transactionId] = callback;
            }
            
            // Build command array
            options["i"] = transactionId;
            for(var key in options) {
                command += " -"+key+" "+options[key];
            }
            
            // Store request
            requests[transactionId] = {command: command, options: options};
            
            // Send actual command
            // console.log("-- dbg <", command);
            connection.sendMessage(command);
            
            transactionId++;
        }
        
        function onDataRead(data) {
            var responses = buffer.feed(data);
            if(responses) {
                $(responses).each(function() {
                    handleResponse(this);
                });
            }
        }
        
        function chain(stack, callback) {
            // {command: "context_get", options: {d: 0, c: 0} }
            
            // Register chain callback
            var chainId = transactionId;
            chainRegistry[chainId] = callback;
            var callbackCount = 0;
            var callbackArguments = [];
            
            for (var i = 0; i < stack.length; i++) {
                $handler.trigger(["gdbp", stack[i].command].join(":"), [stack[i].options, function(stackResponse) {
                    callbackCount++;
                    callbackArguments.push(stackResponse);
                    
                    // Check if all callbacks received a result
                    if(callbackCount == stack.length) {
                        callback.apply(_self, callbackArguments);
                    }
                    
                }]);
            }
            
        }

        function handleResponse(response) {

            if(response.type == "init") {
                _options.onAccept.call(_self, response);
                library.get("ui").hideInfoScreen();
            }else if(response.type == "response") {
                
                // Fetch callback
                var callback = function() {};
                if(callbackRegistry[response.transaction_id]) {
                    callback = callbackRegistry[response.transaction_id];
                    callbackRegistry[response.transaction_id] = null;
                }
                
                // Get request data
                var request = requests[""+response.transaction_id];
                
                switch (response.command) {
                case "run":
                case "step_into":
                case "step_out":
                case "step_over":
                    
                    if(response.status == "break") {
                        // Breakpoint reached: collect information
                        _self.stack_depth(function(stackDepthResult) {
                            var depth = stackDepthResult.depth;
                            this.stack_get({d: 0}, function(stackGetResult) {
                                var filename = stackGetResult._children.stack[0].filename;
                                this.source({f: filename}, function(onSourceResult) {
                                    callback.call(_self, response);
                                });
                                
                                // Load variables
                                this.fetch_property_data(function(data) {
                                    library.get("ui").getVariablesTree().load(data);
                                })
                                
                            });
                        });
                    }else if(response.status == "stopping") {
                        // End reached
                        _self.stop();
                    }else{
                        callback.call(_self, response);
                    }
                    break;
                case "breakpoint_set":
                    var breakpoint = registerBreakpoint(request.options.f, request.options.n, response.id);
                    library.get("ui").status("set breakpoint on line "+request.options.n+" in "+request.options.f);
                    
                    // Check if current file
                    if(library.get("ui").getCurrentFile() == request.options.f) {
                        library.get("ui").setBreakpoint(breakpoint, true);
                    }

                    callback.call(_self, response);
                    break;
                case "breakpoint_remove":
                    var id = request.options.d;
                    var breakpoint = getBreakpointById(id);
                    if(breakpoint) {
                        library.get("ui").status("removed breakpoint on line "+breakpoint.lineno+" in "+breakpoint.filename);
                        
                        // Check if current file
                        if(library.get("ui").getCurrentFile() == breakpoint.filename) {
                            library.get("ui").setBreakpoint(breakpoint, false);
                        }
                        
                        unlinkBreakpoint(id);
                    }
                    callback.call(_self, response);
                    break;
                case "source":
                    var filename = request.options.f;
                    var fileBreakpoints = breakpoints[filename] || false;
                    if(response._value) {
                        library.get("ui").openEditor(filename, response._value, fileBreakpoints, (activeBreakpoint.filename == filename ? activeBreakpoint : null));
                    }
                    callback.call(_self, response);
                    break;
                case "stop":
                    if(response.status == "stopping") {
                        // End reached
                        _self.stop();
                    }
                    break;
                default:
                    callback.call(_self, response);
                }

                // Handle break status
                if(response.status == "break") {
                    
                    // Check if error occured
                    if(response._children && response._children.error) {
                        library.get("ui").status(response._children.error[0]._children.message[0]._value);
                    }else{
                        // Register active breakpoint
                        activeBreakpoint = {
                            filename: response._children.message[0].filename,
                            lineno: parseInt(response._children.message[0].lineno)
                        };
                    
                        // Update UI
                        library.get("ui").status("breaking on line "+activeBreakpoint.lineno+" in "+activeBreakpoint.filename);
                        $handler.trigger("ui:enable", [["run", "step_into", "step_out", "step_over", "stop"]]);
                    }

                }
                
                // Handle stopped status
                if(response.status == "stopped") {
                    $handler.trigger("ui:disable", [["run", "step_into", "step_out", "step_over", "stop"]]);

                    // Update UI
                    library.get("ui").showInfoScreen(function() {
                        library.get("ui").getVariablesTree().load([]);
                        library.get("ui").closeEditor();
                    });
                }
                
            }else{
                // console.log("-- !invalid data", response);
            }

        }
        
        function fetch_property_data(callback) {
            
            this.context_names({d: 0}, function(contextNamesResult) {
                
                var commands = [];
                $(contextNamesResult._children.context).each(function() {
                    commands.push({command: "context_get", options: {d: 0, c: this.id}});
                });
                
                // Get context variables
                this.chain(commands, function() {
                    var properties = [];
                    for (var i = 0; i < arguments.length; i++) {
                        if(arguments[i]._children && arguments[i]._children.property) {
                            properties = $.merge( properties, arguments[i]._children.property );
                        }
                    }
                    var data = prepareGridData(properties);
                    callback(data);
                });
                
            });
        }
                
        function addGridDataChildren(data, properties, i, indent, parent) {
            $(properties).each(function() {
                var property = this;
                var record = {
                    id: "item-"+(i+1),
                    variable: property.name,
                    value: "",
                    type: property.type,
                    indent: indent,
                    parent: parent,
                    parentId: "item-"+(parent+1),
                    hasChildren: false
                };
                data.push(record);
                i++;
                
                // create children
                if(property._children) {
                    record.hasChildren = true;
                    record.value = "["+property.numchildren+"]";
                    indent++;
                    record._collapsed = true;
                    i = addGridDataChildren(data, property._children.property, i, indent, i-1);
                    indent--;
                }else{
                    if(property.numchildren) {
                        record.value = "["+property.numchildren+"]";
                    }else{
                        record.value = this._value;
                    }
                    
                }
                
            });
            
            return i;
        }
        
        function prepareGridData(properties) {
            var data = [];
            var i = 0;
            var indent = 0;
            var parent = null;
            addGridDataChildren(data, properties, i, indent, parent);
            return data;
        }
        
        function registerBreakpoint(filename, lineno, id) {
            var breakpoint = { id: id, filename: filename, lineno: lineno };
            if(breakpoints[filename] == undefined) {
                breakpoints[filename] = [];
            }
            breakpoints[filename].push(breakpoint);
            return breakpoint;
        }
        
        function unlinkBreakpoint(id) {
            for(var filename in breakpoints) {
                for(var i in breakpoints[filename]) {
                    if(breakpoints[filename][i].id == id) {
                        breakpoints[filename].splice(i, 1);
                        return true;
                    }
                }
            }
            return false;

        }
        
        
        function getBreakpointAt(filename, lineno) {
            if(breakpoints[filename]) {
                for(var i in breakpoints[filename]) {
                    if(breakpoints[filename][i].lineno == lineno) {
                        return breakpoints[filename][i];
                    }
                }
            }
            return false;
        }
        
        function getBreakpointById(id) {
            for(var filename in breakpoints) {
                for(var i in breakpoints[filename]) {
                    if(breakpoints[filename][i].id == id) {
                        return breakpoints[filename][i];
                    }
                }
            }
            return false;
        }
        
        function getActiveBreakpoint() {
            return activeBreakpoint;
        }
        
        function getBreakpoints() {
            return breakpoints;
        }
        
        function getServer() {
            return server;
        }
        
        function getConnection() {
            return connection;
        }
        
        init();

        $.extend(this, {
            // methods
            "init": init,
            "start": start,
            "restart": restart,
            "shutdown": shutdown,
            "state": state,
            "chain": chain,
            "prepareGridData": prepareGridData,
            // special methods
            "fetch_property_data": fetch_property_data,
            // getters
            "getBreakpoints": getBreakpoints,
            "getBreakpointById": getBreakpointById,
            "getBreakpointAt": getBreakpointAt,
            "getActiveBreakpoint": getActiveBreakpoint,
            "getServer": getServer,
            "getConnection": getConnection
        });
    }
})(jQuery);
