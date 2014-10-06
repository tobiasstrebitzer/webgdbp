(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "UI": UI
        }
    });

    function UI(options) {
        var _self = this;
        var handler = library.get("handler");
        var _options;
        var _defaults = {
            margins: {
                topbar: 23,
                bottombar: 25
            }
        };
        var $statusBar;
        var actions;
        var $handler;
        
        // Editor
        var editor;
        var editorOpened;
        var currentFile;
        var delayTimer;
        var isResize;
        
        var variablesTree;
        var browserTree;
        var events = {
            collapse: function(event) {
                chrome.app.window.current().minimize();
            },
            expand: function(event) {
                if(chrome.app.window.current().isMaximized()) {
                    chrome.app.window.current().restore();
                }else{
                    chrome.app.window.current().maximize();
                }
            },
            focus: function(event) {
                chrome.app.window.current().focus();
            },
            enable: function(event, actionArray) {
                
                // ensure array
                if(!$.isArray(actionArray)) { actionArray = [actionArray]; }
                
                $(actionArray).each(function() {
                    actions[this].removeClass("disabled");
                });
                
            },
            disable: function(event, actionArray) {

                // ensure array
                if(!$.isArray(actionArray)) { actionArray = [actionArray]; }
                
                $(actionArray).each(function() {
                    actions[this].addClass("disabled");
                });

            },
            step_into: function(event) {
                handler.step_into();
            },
            step_out: function(event) {
                handler.step_out();
            },
            step_over: function(event) {
                handler.step_over();
            },
            run: function(event) {
                handler.run();
            },
            close: function(event) {
                library.get("handler").shutdown();
                library.get("chruby").shutdown();
                chrome.app.window.current().close();
            },
            stop: function(event, message) {
                handler.stop();
            },
            toggleeditor: function(event) {
                
                if(editorOpened) {
                    editorOpened = false;
                }else{
                    if(currentFile == null) {
                        status("Cannot open editor, no file selected!");
                    }else{
                        editorOpened = true;
                    }                 
                }

                redrawViewport();
            }
        }
        
        function onActionClick(event) {
            var action = $(this).data("action");
            
            if($(this).hasClass("disabled")) {
                return false;
            }
            
            $handler.trigger(["ui", action].join(":"), event);
        }
        
        function status(message) {
            var $old = $statusBar.find("span");
            var $new = $("<span />");
            $new.html(message);
            $new.appendTo($statusBar)
            $new.css({
                top: -20,
                opacity: 0
            }).animate({
                top: 0,
                opacity: 1
            }, 100, "swing");
            $old.animate({
                top: 20,
                opacity: 0
            }, 100, "swing", function() { $(this).remove(); });
        }
        
        function delay(callback, ms) {
            clearTimeout(delayTimer);
            delayTimer = setTimeout(callback, ms);
        }
        
        function init() {
            _options = $.extend(true, {}, _defaults, options);
            
            currentFile = null;
            delayTimer = 0;
            isResize = false;
            editorOpened = false;

            initElements();
            initEvents();
            initCodeEditor();
            initVariablesTree();
            initBrowserTree();
            
            redrawViewport();
            
            // handle resize
            $(window).resize(function(event) { 
                if(isResize === false) {
                    isResize = true;
                    $("#xpanel-container").fadeTo(150, 0);
                }
                delay(function(){ 
                    isResize = false;
                    redrawViewport();
                }, 250);
            });
            
        }
        
        function initVariablesTree() {
            variablesTree = new GDBp.VariablesTree($("div#variables-tree"), {});
        }
        
        function initBrowserTree() {
            browserTree = new GDBp.BrowserTree($("div#browser-tree"), {});
        }
        
        function initCodeEditor() {
            editor = CodeMirror($("#code-editor")[0], {
                lineNumbers: true,
                matchBrackets: true,
                mode: "application/x-httpd-php",
                indentUnit: 4,
                indentWithTabs: true,
                enterMode: "keep",
                tabMode: "shift",
                value: "",
                readOnly: true,
                gutters: ["CodeMirror-linenumbers", "breakpoints"],
                value: '<?php\n\n$myarray = array("...");\n\nforeach($myarray as $key => $value) {\necho $key;\n}\n\ndie();\n\n?>\n'
            });
            
            $("#code-editor").css("display", "none");
            
            editor.on("gutterClick", onEditorGutterClick);
            
            library.add("editor", editor);
        }
        
        function openEditor(filename, contents, breakpoints, activeBreakpoint) {

            // Show editor
            $("#code-editor").css("display", "block");
            
            // Remove all breakpoints
            editor.doc.cm.clearGutter("breakpoints");
            
            // Set editor contents
            currentFile = filename;
            editor.setValue(contents);

            // Draw breakpoints
            if(breakpoints) {
                for(var i=0; i<breakpoints.length; i++) {
                    setBreakpoint(breakpoints[i], true);
                }
            }

            // Draw active breakpoint
            if(activeBreakpoint) {
                setBreakpoint(activeBreakpoint, true);
                editor.setCursor(activeBreakpoint.lineno - 1);
            }
            
            // Redraw viewport
            editorOpened = true;
            redrawViewport();
            
        }

        function closeEditor() {
            
            // Redraw viewport
            editorOpened = false;
            redrawViewport();

            
        }
        
        function setBreakpoint(breakpoint, add) {
            var rowId = breakpoint.lineno-1;
            if(add) {
                var $breakpoint = $("<i class='icon-caret-right cm-breakpoint'></i>");
                if(!breakpoint.id) {
                    $breakpoint.addClass("active");
                    editor.doc.cm.addLineClass(rowId, 'background', 'line-breakpoint');
                }
                editor.doc.cm.setGutterMarker(rowId, "breakpoints", $breakpoint[0]);
            }else{
                editor.doc.cm.setGutterMarker(rowId, "breakpoints", null);
            }
        }
        
        function onEditorGutterClick(cm, n) {

            var lineNumber = n+1;
            var info = cm.lineInfo(n);
            
            // Ignore active breakpoints
            var activeBreakpoint = library.get("handler").getActiveBreakpoint();
            if(activeBreakpoint && lineNumber == activeBreakpoint.lineno) { return; }
            
            // Ignore empty lines
            if($.trim(info.text) == "") { return; }

            // Add/Remove breakpoints
            if(info.gutterMarkers) {
                // Remove breakpoint
                var breakpoint = library.get("handler").getBreakpointAt(currentFile, lineNumber);
                if(breakpoint) {
                    library.get("handler").breakpoint_remove({d: breakpoint.id}, function(breakpointRemoveResult) {});
                }
            }else{
                // Add breakpoint
                library.get("handler").breakpoint_set({t: "line", f: currentFile, n: lineNumber}, function(breakpointSetResult) {});
            }
        }
        
        function makeBreakpointMarker(active) {
            if(active) {
                return $("<i class='icon-caret-right cm-breakpoint active'></i>")[0];
            }else{
                return $("<i class='icon-caret-right cm-breakpoint'></i>")[0];
            }
        }
 
        function initEvents() {
            for(var key in events) {
                $handler.on(["ui", key].join(":"), events[key]);
            }
        }
        
        function getCurrentFile() {
            return currentFile;
        }
        
        function getVariablesTree() {
            return variablesTree;
        }
        
        function getBrowserTree() {
            return browserTree;
        }
        
        function initElements() {
            $handler = $(handler);
            actions = {};
            $statusBar = $("#status-bar");
            $(".action").each(function() {
                var action = $(this).data("action");
                actions[action] = $(this);
            }).click(onActionClick);
        }
        
        function showView(view) {
            
            // hide all views
            $(".view").hide();
            
            // show active view
            $("#"+view+"-view").show();
            
            // redraw
            redrawViewport();
            
        }
        
        
        function redrawViewport() {
                        
            // calculate viewport height
            var viewportHeight = $(window).height() - _options.margins.topbar - _options.margins.bottombar;
            
            // fade in container
            $("#xpanel-container").fadeTo(150, 1);
            
            // editor toggle
            if(editorOpened) {
                $(".editor-toggle i").addClass("icon-collapse");
                $(".editor-toggle i").removeClass("icon-collapse-top");
                $("#browser-tree").parent().addClass("top");
                $("#variables-tree").parent().addClass("top");
                $("#code-editor").css("display", "block");
                editor.refresh();
            }else{
                $(".editor-toggle i").addClass("icon-collapse-top");
                $(".editor-toggle i").removeClass("icon-collapse");
                $("#browser-tree").parent().removeClass("top");
                $("#variables-tree").parent().removeClass("top");
                $("#code-editor").css("display", "none");
            }
            
            // set focus / active rows
            variablesTree.redraw();
            browserTree.redraw();

        }
        
        function showInfoScreen(callback) {
            $("#info-overlay").fadeIn(500, callback);
        }
        
        function hideInfoScreen() {
            $("#info-overlay").fadeOut();
        }
                
        init();

        $.extend(this, {
            "init": init,
            "status": status,
            "openEditor": openEditor,
            "closeEditor": closeEditor,
            "setBreakpoint": setBreakpoint,
            "showView": showView,
            "showInfoScreen": showInfoScreen,
            "hideInfoScreen": hideInfoScreen,
            // getters
            "getVariablesTree": getVariablesTree,
            "getBrowserTree": getBrowserTree,
            "getCurrentFile": getCurrentFile
        });
    }
})(jQuery);
