
(function(jQuery){

  var defaultOptions = {
    toolbar: true,
    inline: false
  };

  var currentEditor;

  jQuery(document).ready(function(){

    /* Instanciate a WYSIWWYG on an element or a set of elements
     * or get instances if already existing
     *
     * @example getWYSIWYG(".editable");
     * @example getWYSIWYG("#editor", {inline: true});
     * @example getWYSIWYG($("#editor"));
     *
     * @param element Selector of jQuery set of elements
     * @param options Options, overriding defaultOptions
     */
    getWYSIWYG = function(elements, options){
      var instances = [];
      jQuery(elements).each(function(){
        var element = jQuery(this);
        var instance;
        if(!(instance = element.data("wysiwyg"))){
          instance = new WYSIWYG(element, options);
          element.data("wysiwyg", instance);
        }
        instances.push(instance);
      });
      return instances;
    };


    var toolbar = jQuery("#wysiwyg-toolbar").attr("contentEditable", false);

    // Toolbars' buttons list
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
          return /^(U|INS)$/.test(node.prop("nodeName").toUpperCase()) || node.css("text-decoration") == "underline";
        }
      },
      strikeThrough: {
        command: "strikeThrough",
        element: jQuery("#wysiwyg-button-strikeThrough"),
        testNode: function(node){
          return /^(S|STRIKE|DEL)$/.test(node.prop("nodeName").toUpperCase()) || node.css("text-decoration") == "line-through";
        }
      },
      // Format: <select> button
      format: {
        element: jQuery("#wysiwyg-button-format"),
        init: function(){
          this.element.on("change", function(){
            currentEditor.formatBlock(this.value);
            this.value = "";
          });
        }
      },
      // Format: Separate buttons
      formatBtns: {
        element: jQuery(".wysiwyg-button-format"),
        init: function(){
          this.element.each(function(){
            var element = jQuery(this);
            element.on("click", function(){
              currentEditor.formatBlock(element.data("format"));
            });
          });
        },
        testNode: function(node){
          var m = node.prop("nodeName").toUpperCase().match(/^(H[1-6]|P|PRE|BLOCKQUOTE)$/);
          if(m){
            this.value = m[1];
            return true;
          }else{
            delete this.value;
            return false;
          }
        },
        toggle: function(bool){
          var value = this.value;
          this.element.each(function(){
            var element = jQuery(this);
            element.parent().toggleClass("active", element.data("format") == value);
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
            this.element.toggleClass("active", bool);
          };
        }
      })();
    }


    /* Constructor
     *
     * @example new WYSIWYG(jQuery("#editor"));
     * @example new WYSIWYG(jQuery("#editor"), {inline: true});
     *
     * @param element jQuery single element
     * @param options Options, overriding defaultOptions
     */
    var WYSIWYG = function(element, options){
      this.element = element;
      this.options = jQuery.extend({}, defaultOptions, options);
      this.events = [];
      this.enabled = false;
      // Init
      this.enable();
      this._repositionToolbar();
    };

    WYSIWYG.prototype = {

      /* Enable WYSIWYG on a block
       */
      enable: function(){
        if(!this.enabled){
          this.enabled = true;
          this.element.attr("contentEditable", true);
          // Container
          this.container = jQuery("<div></div>")
            .insertBefore(this.element)
            .css("position", "relative");
          this.container.prepend(this.element);
          // Events
          this._addEvent(this.element, "focus", this._onfocus);
          this._addEvent(this.element, "blur", this._onblur);
          this._addEvent(this.element, "keydown", this._onkeydown);
          this._addEvent(this.element, "keydown keyup paste change mouseup", this._onchange);
        }
      },

      /* Disable WYSIWYG on a block
       */
      disable: function(){
        if(this.enabled){
          this.enabled = false;
          this._removeEvents();
          if(currentEditor == this){
            currentEditor = null;
            this._toggleToolbar(false);
            jQuery(document.body).append(toolbar);
          }
          this.element.attr("contentEditable", false);
          // Remove container
          this.element.insertBefore(this.container);
          this.container.remove();
        }
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
        this.focus();
        document.execCommand(command, false, value);
        this._refreshButtons();
      },

      /* Set focus on the editor
       */
      focus: function(){
        this.element.focus();
        if(this.lastSelection){
          this._restoreRange(this.lastSelection);
        }
      },

      /* Add an event on a element or a set of elements
       *
       * @param element jQuery set of elements
       * @param type Event type
       * @param fn Event function
       */
      _addEvent: function(element, type, fn){
        var that = this;
        fn = fn.bind(this);
        element.each(function(){
          that.events.push({
            element: this,
            type: type,
            fn: fn
          });
          jQuery(element).on(type, fn);
        });
      },

      /* Remove some events
       *
       * @param element jQuery set of elements (optional)
       * @param type Event type (optional)
       */
      _removeEvents: function(elements, type){
        var that = this;
        if(!elements){
          elements = [false];
        }
        for(var i = elements.length - 1; i >= 0; i--){
          var element = elements[i];
          for(var j = this.events.length - 1; j >= 0; j--){
            var event = this.events[j];
            if((!element || event.element == element)
              && (!type || event.type == type)){
              jQuery(event.element).off(event.type, event.fn);
              this.events.splice(j, 1);
            }
          }
        }
      },

      /* Get range of current selection
       */
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

      /* Restore Range as it was before blur
       */
      _restoreRange: function(range) {
        if (jQuery.browser.msie) {
          return range.select();
        } else {
          window.getSelection().removeAllRanges();
          return window.getSelection().addRange(range);
        }
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
        this._toggleToolbar(this.options.toolbar);
        this._repositionToolbar();
        // Blur event
        this._addEvent(jQuery(document.documentElement), "mousedown", function(event){
          if(!jQuery.contains(this.container.get(0), event.target) && currentEditor == this){
            this._toggleToolbar(false);
            this._removeEvents(jQuery(document.documentElement));
          }
        });
      },

      _onblur: function(event){
        this.lastSelection = this._getRange();
      },

      /* Show / hide toolbar
       *
       * @param bool true = show, false = hide
       */
      _toggleToolbar: function(bool){
        toolbar.css("display", bool ? "block" : "none");
      },

      /* Update buttons state according to the current range
       */
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

      /* Reposition toolbar in the current editor
       */
      _repositionToolbar: function(){
        this.container.prepend(toolbar);
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

  // Function.prototype.bind polyfill
  if(!Function.prototype.bind){

    Function.prototype.bind = function(obj){
      if(typeof this !== 'function') // closest thing possible to the ECMAScript 5 internal IsCallable function
        throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');

      var slice = [].slice,
          args = slice.call(arguments, 1),
          self = this,
          nop = function(){},
          bound = function(){
            return self.apply(this instanceof nop ? this : (obj || {}),
                              args.concat( slice.call(arguments)));
          };
      bound.prototype = this.prototype;
      return bound;
    };
  }

})(jQuery);
