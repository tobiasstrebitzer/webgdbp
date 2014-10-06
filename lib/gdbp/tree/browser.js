(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "BrowserTree": BrowserTree
        }
    });

    function BrowserTree($element, options) {
        var _self = this;
        var _options;
        var _defaults = {
            columns: [
                {id: "name", name: "Name", field: "name", width: 220, cssClass: "cell-name", formatter: nameFormatter}
                /*,{id: "breakpoints", name: "BP", field: "breakpoints", width: 220, cssClass: "cell-breakpoints"}*/
            ],
            dataView: {},
            grid: {
                enableColumnReorder: false,
                autoHeight: true,
                forceFitColumns: true,
                rowHeight: 19,
                headerRowHeight: 18
            }
        };
        var dataView;
        var grid;
        var data;
        
        function focus() {
            if(!grid.getActiveCell()) { grid.setActiveCell(0, 0); }
            grid.focus();
        }
        
        function load(newData) {

            // Set new data if provided
            if(newData) { data = newData; }
            
            // Update dataview
            dataView.beginUpdate();
            dataView.setItems(data);
            dataView.setFilter(treeFilter);
            dataView.endUpdate();
            
            // Render grid
            grid.invalidateAllRows();
            grid.resizeCanvas();
            grid.render();
            
            focus();
            
        }
        
        function initDataView() {
            dataView = new Slick.Data.DataView(_options.dataView);
            dataView.onRowsChanged.subscribe(onDataViewRowsChangedEvent);
        }
        
        function initGrid() {
            grid = new Slick.Grid($element, dataView, _options.columns, _options.grid);            
            grid.onClick.subscribe(onGridClickEvent);
            grid.onKeyDown.subscribe(onGridKeyDownEvent);
            grid.onDblClick.subscribe(onGridDblClickEvent);
            grid.onActiveCellChanged.subscribe(onGridActiveCellChanged);
        }
        
        function onDataViewRowsChangedEvent(e, args) {
            grid.invalidateRows(args.rows);
            grid.resizeCanvas();
            grid.render();
        }
        
        function onGridKeyDownEvent(e, args) {
            
            // Cancel command keys
            if(e.altKey === true) {
                e.preventDefault();
                return false;
            }
            
            var item = dataView.getItem(args.row);
            if(e.keyCode == 37 || e.keyCode == 39) {
                if(e.keyCode == 37) {
                    // Check if already collapsed
                    if(item._collapsed === true) {
                        var parentRow = dataView.getRowById(item.parent);
                        if(parentRow >= 0) {
                            grid.setActiveCell(parentRow, 0);
                        }
                    }else{
                        item._collapsed = true;
                        dataView.updateItem(item.id, item);
                    }
                }else{
                    if(item.type == "folder" && item._collapsed === true) {
                        item._collapsed = false;
                        dataView.updateItem(item.id, item);
                    }
                }
                e.stopImmediatePropagation();
            }
        }
        
        function onGridActiveCellChanged() {
            
            if(grid.getActiveCell()) {
                var $parent = $element.parent();
                var activeTop = grid.getActiveCellPosition().top - 24;
                var activeBottom = activeTop + 19;
                if(activeBottom > $parent.height()) {
                    $parent.scrollTop($parent.scrollTop() + activeBottom - $parent.height());
                }else if(activeTop < 0) {
                    $parent.scrollTop($parent.scrollTop() + activeTop + 1);
                }
            }
            
        }
        
        function onGridDblClickEvent(e, args) {
            var item = dataView.getItem(args.row);
            if(item.type == "file" && library.get("ui").getCurrentFile() != item.path) {
                library.get("handler").source({f: item.path}, function() {});
            }
        }
        
        function onGridClickEvent(e, args) {
            if ($(e.target).hasClass("toggle")) {
                var item = dataView.getItem(args.row);
                
                if (item) {
                    if (!item._collapsed) {
                        item._collapsed = true;
                    } else {
                        item._collapsed = false;
                    }
                    dataView.updateItem(item.id, item);
                }
                e.stopImmediatePropagation();
            }
        }

        function treeFilter(item) {
            var data = dataView.getItems();
            if (item.parent != null) {
                var parent = data[item.parent];
                while (parent) {
                    if (parent._collapsed) {
                        return false;
                    }
                    parent = data[parent.parent];
                }
            }
            return true;
        }
        
        // Create toggle behaviour
        function nameFormatter(row, cell, value, columnDef, dataContext) {
            value = value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            var spacer = "<span style='display:inline-block;height:1px;width:" + (15 * dataContext["indent"]) + "px;float: left;'></span>";
            var idx = dataView.getIdxById(dataContext.id);
            
            // Add browser type
            value = "<span class='browser-type browser-type-"+dataContext.type+"'>"+value+"</span>";
            
            if (data[idx + 1] && data[idx + 1].indent > data[idx].indent) {
                if (dataContext._collapsed) {
                    return spacer + " <i class='toggle icon-caret-right'></i>" + value;
                } else {
                    return spacer + " <i class='toggle icon-caret-down'></i>" + value;
                }
            } else {
                return spacer + " <i class='toggle'></i>" + value;
            }
        }
        
        function redraw() {
            // $element.find(".grid-canvas").height($element.height() - 22);
            grid.resizeCanvas();
        }

        function init() {
            _options = $.extend(true, {}, _defaults, options);

            initDataView();
            initGrid();
            
        }
        
        function getGrid() {
            return grid;
        }
        
        init();

        $.extend(this, {
            "init": init,
            "load": load,
            "redraw": redraw,
            "focus": focus,
            "getGrid": getGrid
        });
    }
})(jQuery);
