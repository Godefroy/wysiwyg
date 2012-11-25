
(function(jQuery){
  var defaultOptions = {
    toolbar: true,
    inline: false
  };

  var currentEditor;

  jQuery(document).ready(function(){
    var toolbar = jQuery("#wysiwyg-toolbar").attr("contentEditable", false);

    var buttons = {
      bold: {
        command: "bold",
        element: jQuery("#wysiwyg-button-bold"),
        testNode: function(node){
          return /^(STRONG|B)$/.test(node.prop("nodeName").toUpperCase()) || /^(bold|700)$/.test(node.css("font-weight"));
        }
      },
      italic: {
        command: "italic",
        element: jQuery("#wysiwyg-button-italic"),
        testNode: function(node){
          return /^(EM|I)$/.test(node.prop("nodeName").toUpperCase()) || node.css("font-style") == "italic";
        }
      },
      underline: {
        command: "underline",
        element: jQuery("#wysiwyg-button-underline"),
        testNode: function(node){
          return /^U$/.test(node.prop("nodeName").toUpperCase()) || node.css("text-decoration") == "underline";
        }
      },
      format: {
        element: jQuery("#wysiwyg-button-format"),
        init: function(){
          this.element.on("change", function(){
            currentEditor.formatBlock(this.value);
            this.value = "";
          });
        }
      },
      justifyLeft: {
        command: "justifyLeft",
        element: jQuery("#wysiwyg-button-justifyLeft"),
        testNode: function(node){
          return node.css("text-align") == "left";
        }
      },
      justifyCenter: {
        command: "justifyCenter",
        element: jQuery("#wysiwyg-button-justifyCenter"),
        testNode: function(node){
          return /^CENTER$/.test(node.prop("nodeName").toUpperCase()) || node.css("text-align") == "center";
        }
      },
      justifyRight: {
        command: "justifyRight",
        element: jQuery("#wysiwyg-button-justifyRight"),
        testNode: function(node){
          return node.css("text-align") == "right";
        }
      },
      justifyFull: {
        command: "justifyFull",
        element: jQuery("#wysiwyg-button-justifyFull"),
        testNode: function(node){
          return node.css("text-align") == "justify";
        }
      },
      unorderedList: {
        command: "insertUnorderedList",
        element: jQuery("#wysiwyg-button-unorderedList"),
        testNode: function(node){
          return /^UL$/.test(node.prop("nodeName").toUpperCase());
        }
      },
      orderedList: {
        command: "insertOrderedList",
        element: jQuery("#wysiwyg-button-orderedList"),
        testNode: function(node){
          return /^OL$/.test(node.prop("nodeName").toUpperCase());
        }
      }
    };

    for(var buttonName in buttons){
      (function(){
        var button = buttons[buttonName];
        if(button.init){
          button.init();
        }else{
          button.element.on("click", function(){
            currentEditor.execute(button.command);
          });
        }
        if(!button.toggle){
          button.toggle = function(bool){
            this.element.toggleClass("enabled", bool);
          };
        }
      })();
    }


    WYSIWYG = function(element, options){
      this.options = jQuery.extend({}, defaultOptions, options);
      this.element = jQuery(element).first();
      this.enable();
      this._repositionToolbar();
    };

    WYSIWYG.prototype = {

      /* Enable WYSIWYG on a block
       */
      enable: function(){
        var that = this;
        this.element.attr("contentEditable", true);
        this.element.on("focus", function(event){
          that._onfocus(event);
        });
        this.element.on("blur", function(event){
          that._onblur(event);
        });
        this.element.on("keydown", function(event){
          that._onkeydown(event);
        });
        this.element.on("keydown keyup paste change mouseup", function(event){
          that._onchange(event);
        });
      },

      /* Disable WYSIWYG on a block
       */
      disable: function(){
        this.element.attr("contentEditable", false);
        this.element.off("focus blur keydown keyup paste change mouseup");
      },

      /* Change tag of the block
       *
       * @param tagName h1, h2, h3, p, pre, blockquote
       */
      formatBlock: function(tagName){
        this.execute("formatBlock", tagName);
      },

      /* Execute a command
       *
       * @param command
       * @param value (optional)
       */
      execute: function(command, value){
        document.execCommand(command, false, value);
        this.element.focus();
        this._refreshButtons();
      },

      _getRange: function() {
        var range, userSelection;
        if (jQuery.browser.msie) {
          range = document.selection.createRange();
        } else {
          if (window.getSelection) {
            userSelection = window.getSelection();
          } else if (document.selection) {
            userSelection = document.selection.createRange();
          } else {
            throw "Your browser does not support selection handling";
          }
          if (userSelection.rangeCount > 0) {
            range = userSelection.getRangeAt(0);
          } else {
            range = userSelection;
          }
        }
        return range;
      },

      _onchange: function(event){
        var range = this._getRange();
        this._refreshButtons(range);
      },

      _onkeydown: function(event){
        var range = this._getRange();

        // Enter key
        if (event.which == 13) {
          // No newline if inline mode
          if (this.options.inline) {
            event.preventDefault();
            event.stopPropagation();

          // No DIV tags, use P instead
          }else{
            if(range && range.startContainer.nodeName.toUpperCase() == "DIV"){
              this.formatBlock("P");
            }
          }
        }
      },

      _onfocus: function(){
        currentEditor = this;
        toolbar.css("display", this.options.toolbar ? "block" : "");
        this._repositionToolbar();
      },

      _onblur: function(event){
        if(event.target != this.element[0]){
          toolbar.css("display", "none");
        }
      },

      _refreshButtons: function(range){
        if(!range){
          range = this._getRange();
        }
        if(range){
          var buttonsStates = {};
          var node = jQuery(range.startContainer);
          if(!node.nodeName){
            node = node.parent();
          }
          jQuery.merge(node, node.parentsUntil(this.element)).each(function(){
            for(var buttonName in buttons){
              var button = buttons[buttonName];
              if(buttonsStates[buttonName] || !button.testNode)
                continue;
              buttonsStates[buttonName] = button.testNode(jQuery(this));
            }
          });
          for(var buttonName in buttonsStates){
            var button = buttons[buttonName];
            button.toggle(buttonsStates[buttonName]);
          }
        }
      },

      _repositionToolbar: function(){
        this.element.prepend(toolbar);
        toolbar.css("top", (-toolbar.height()) + "px");
      }

    };


    // Prefer tags to CSS styles
    try {
      return document.execCommand('styleWithCSS', 0, false);
    } catch (e) {
      try {
        return document.execCommand('useCSS', 0, true);
      } catch (e) {
        try {
          return document.execCommand('styleWithCSS', false, false);
        } catch (e) {}
      }
    }

  });

})(jQuery);
