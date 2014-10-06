(function($) {
    // register namespace
    $.extend(true, window, {
        "GDBp": {
            "VariablesTree": VariablesTree
        }
    });

    function VariablesTree($element, options) {
        var _self = this;
        var _options;
        var _defaults = {
            columns: [
                {id: "variable", name: "Variable", field: "variable", width: 220, cssClass: "cell-variable", formatter: nameFormatter},
                {id: "value", name: "Value", field: "value", width: 220, cssClass: "cell-value"},
                {id: "type", name: "Type", field: "type", width: 160, cssClass: "cell-type"}
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
            grid.onActiveCellChanged.subscribe(onGridActiveCellChanged);
        }
        
        function onDataViewRowsChangedEvent(e, args) {
            grid.invalidateRows(args.rows);
            grid.resizeCanvas();
            grid.render();
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
                    if(item._collapsed !== false) {
                        var parentRow = dataView.getRowById(item.parentId);
                        if(parentRow >= 0) {
                            grid.setActiveCell(parentRow, 0);
                        }
                    }else{
                        item._collapsed = true;
                        dataView.updateItem(item.id, item);
                    }
                }else{
                    if(item.hasChildren && item._collapsed !== false) {
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
            // $element.find(".slick-viewport").height($element.height() - 22);
            grid.resizeCanvas();
        }

        function init() {
            _options = $.extend(true, {}, _defaults, options);

            initDataView();
            initGrid();
            
            /* Test: fill grid
            load([
                {id: "item-1", variable: "$myarray", value: [8], type: "array", indent: 0, _collapsed: true},
                {id: "item-2", variable: "item1", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-3", variable: "item2", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-4", variable: "item3", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-5", variable: "item4", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-6", variable: "item5", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-7", variable: "item6", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-8", variable: "item7", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-9", variable: "item8", value: "works nice", type: "string", indent: 1, parent: 0},
                {id: "item-10", variable: "$test1", value: "works nice", type: "string", indent: 0},
                {id: "item-11", variable: "$test2", value: "works nice", type: "string", indent: 0},
                {id: "item-12", variable: "$test3", value: "works nice", type: "string", indent: 0},
                {id: "item-13", variable: "$test4", value: "works nice", type: "string", indent: 0},
                {id: "item-14", variable: "$test5", value: "works nice", type: "string", indent: 0},
                {id: "item-15", variable: "$test6", value: "works nice", type: "string", indent: 0},
                {id: "item-16", variable: "$test7", value: "works nice", type: "string", indent: 0},
                {id: "item-17", variable: "$test8", value: "works nice", type: "string", indent: 0},
                {id: "item-18", variable: "$test9", value: "works nice", type: "string", indent: 0}
            ]);
            */
            
        }
        
        
        init();

        $.extend(this, {
            "init": init,
            "load": load,
            "redraw": redraw,
            "focus": focus
        });
    }
})(jQuery);
