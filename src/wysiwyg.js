
(function(jQuery){

  var defaultOptions = {
    toolbar: true,
    inline: false,
    cleanup: true,
    raw: false
  };

  var currentEditor;

  jQuery(document).ready(function(){

    /**
     * Instanciate a WYSIWWYG on an element or a set of elements
     * or get instances if already existing
     *
     * @example getWYSIWYG(".editable");
     * @example getWYSIWYG("#editor", {inline: true});
     * @example getWYSIWYG($("#editor"));
     *
     * @param string|jQuery element Selector of jQuery set of elements
     * @param object        options Options, overriding defaultOptions
     * @return array WYSIWYG instances
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

    // Tool bar
    var toolbar = jQuery("#wysiwyg-toolbar").attr("contentEditable", false);

    // List of elements used by WYSIWYG
    var toolElements = [toolbar];

    // Tags that are blocks
    var blockTags = "h[1-6]|p|pre|blockquote|div|ul|ol|li";

    // Toolbars' buttons list
    var formattings = {

      /** Example:
      formatName: {
        command: "commandName",
        button: jQuery("#toolbar-button"),  // Button in the toolbar
        preferred: {  // Configuration to create a tag corresponding to the formatting
          tag: "tagName",     // If defined, use this tagName
          style: "property: value;",      // If defined, apply these styles
          keepAttrs: ["attr1", "attr2"],  // If defined, keep these attributes
          onlyIfBlock: true,  // If true, keep the format style only if the tag is a block
          keepTag: true       // If true, keep the current tag (whatever it is) and delete its attributes
        },
        rules: {  // Configuration to detect a tag corresponding to the formatting
          tags: "tagName1|tagName2|...",           // tagName matching
          style: ["property1": "value1|value2"],   // styles matching
        }
      }
      */

      bold: {
        command: "bold",
        button: jQuery("#wysiwyg-button-bold"),
        preferred: {tag: "strong"},
        rules: {
          tags: "strong|b",
          style: ["font-weight", "bold|700"]
        }
      },
      italic: {
        command: "italic",
        button: jQuery("#wysiwyg-button-italic"),
        preferred: {tag: "em"},
        rules: {
          tags: "em|i",
          style: ["font-style", "italic"]
        }
      },
      underline: {
        command: "underline",
        button: jQuery("#wysiwyg-button-underline"),
        preferred: {style: "text-decoration: underline;"},
        rules: {
          tags: "u|ins",
          style: ["text-decoration", "underline"]
        }
      },
      strikeThrough: {
        command: "strikeThrough",
        button: jQuery("#wysiwyg-button-strikeThrough"),
        preferred: {style: "text-decoration: line-through;"},
        rules: {
          tags: "s|strike|del",
          style: ["text-decoration", "line-through"]
        }
      },

      link: {
        button: jQuery("#wysiwyg-button-link"),
        preferred: {
          tag: "a",
          keepAttrs: ["href"]
        },
        rules: {tags: "a"},
        init: function(){
          var modal = jQuery("#wysiwyg-modal-link");
          toolElements.push(modal);
          var input = modal.find("input[type=text]");
          var form = modal.find("form");
          var deleteBtn = jQuery("#wysiwyg-modal-link-delete");
          this.button.on("click", function(){
            var range = currentEditor._getRange();
            var emptyRange = currentEditor._isEmptyRange(range);

            // If a link already exists, fill the form
            var node = jQuery(range.startContainer);
            var existingLink;
            input.attr("value", "");
            if(!node.nodeName){
              node = node.parent();
            }
            jQuery.merge(node, node.parentsUntil(currentEditor.element)).each(function(){
              if(this.nodeName.toUpperCase() == "A"){
                input.attr("value", this.getAttribute("href"));
                existingLink = this;
                return false;
              }
            });

            if(existingLink || !emptyRange){
              var position = currentEditor._getCaretPosition(range);
              modal.show().css({
                top: position.top - modal.height(),
                left: position.left
              });
              input.focus();
              deleteBtn.toggle(!!existingLink).on("click", function(){
                if(emptyRange){
                  jQuery(existingLink).replaceWith(jQuery(existingLink).contents());
                }else{
                  currentEditor.execute("unlink");
                }
                modal.hide();
              });
              form.off("submit");
              form.on("submit", function(){
                var url = input.attr("value");
                if(emptyRange){
                  if(url == ""){
                    currentEditor.execute("unlink");
                  }else{
                    existingLink.href = url;
                  }
                }else{
                  currentEditor.execute("unlink");
                  currentEditor.execute("createLink", url);
                }
                modal.hide();
              });
            }
          });
        }
      },

      // Format: <select> button
      format: {
        button: jQuery("#wysiwyg-button-format"),
        preferred: {keepTag: true},
        rules: {
          tags: "h[1-6]|p|pre|blockquote"
        },
        init: function(){
          this.button.on("change", function(){
            currentEditor.formatBlock(this.value);
            this.value = "";
          });
        }
      },

      // Format: Separate buttons
      formatBtns: {
        button: jQuery(".wysiwyg-button-format"),
        rules: {
          tags: "h[1-6]|p|pre|blockquote"
        },
        init: function(){
          if(this.button.first().prop("nodeName") == "SELECT"){
            this.button.on("change", function(){
              currentEditor.formatBlock(this.value);
              this.value = "";
            });

          }else{
            this.button.each(function(){
              var button = jQuery(this);
              button.on("click", function(){
                currentEditor.formatBlock(button.data("format"));
              });
            });
            this.testNode = function(node){
              var m = node.prop("nodeName").toLowerCase().match(new RegExp("^("+this.rules.tags+")$"));
              if(m){
                this.value = m[1];
              }else{
                delete this.value;
              }
              return !!m;
            };
            this.toggle = function(bool){
              var value = this.value;
              this.button.each(function(){
                var button = jQuery(this);
                button.parent().toggleClass("active", button.data("format") == value);
              });
            };
          }
        },
      },

      justifyLeft: {
        command: "justifyLeft",
        button: jQuery("#wysiwyg-button-justifyLeft"),
        preferred: {
          style: "text-align: left;",
          onlyIfBlock: true
        },
        rules: {
          style: ["text-align", "left"]
        }
      },
      justifyCenter: {
        command: "justifyCenter",
        button: jQuery("#wysiwyg-button-justifyCenter"),
        preferred: {
          style: "text-align: center;",
          onlyIfBlock: true
        },
        rules: {
          tags: "center",
          style: ["text-align", "center"]
        }
      },
      justifyRight: {
        command: "justifyRight",
        button: jQuery("#wysiwyg-button-justifyRight"),
        preferred: {
          style: "text-align: right;",
          onlyIfBlock: true
        },
        rules: {
          style: ["text-align", "right"]
        }
      },
      justifyFull: {
        command: "justifyFull",
        button: jQuery("#wysiwyg-button-justifyFull"),
        preferred: {
          style: "text-align: justify;", 
          onlyIfBlock: true
        },
        rules: {
          style: ["text-align", "justify"]
        }
      },

      unorderedList: {
        command: "insertUnorderedList",
        button: jQuery("#wysiwyg-button-unorderedList"),
        preferred: {tag: "ul"},
        rules: {tags: "ul"}
      },
      orderedList: {
        command: "insertOrderedList",
        button: jQuery("#wysiwyg-button-orderedList"),
        preferred: {tag: "ol"},
        rules: {tags: "ol"}
      },
      listItem: {
        preferred: {tag: "li"},
        rules: {tags: "li"}
      },

      div: {
        preferred: {tag: "p"},
        rules: {tags: "div"}
      }

    };

    var authorized_styles = [];

    for(var formattingName in formattings){
      (function(){
        var formatting = formattings[formattingName];
        if(formatting.init){
          formatting.init();
        }else if(formatting.button){
          formatting.button.on("click", function(){
            currentEditor.execute(formatting.command);
          });
        }
        if(formatting.rules.style){
          authorized_styles.push(formatting.rules.style);
        }
        if(!formatting.testNode){
          formatting.testNode = function(node){
            return (typeof(this.rules.tags) != "undefined"
                    && new RegExp("^("+this.rules.tags+")$").test(node.prop("nodeName").toLowerCase()))
                || (typeof(this.rules.style) != "undefined"
                    && typeof(node.attr("style")) != "undefined"
                    && new RegExp("(^|\\s|;)"+this.rules.style[0]+" *: *("+this.rules.style[1]+")[;\\s]").test(node.attr("style")));
          };
        }
        if(!formatting.toggle && formatting.button){
          formatting.toggle = function(bool){
            this.button.toggleClass("active", bool);
          };
        }
      })();
    }


    /**
     * Constructor
     *
     * @example new WYSIWYG(jQuery("#editor"));
     * @example new WYSIWYG(jQuery("#editor"), {inline: true});
     *
     * @param jQuery element  jQuery single element
     * @param object options  Options overriding defaultOptions
     */
    var WYSIWYG = function(element, options){
      this.element = element;
      this.options = jQuery.extend({}, defaultOptions, options);
      this.instanceEvents = jQuery({});
      this.events = [];
      this.enabled = false;
      this._blurEventDefined = false;
      // Init
      this.enable();
      this._repositionToolbar();
    };

    WYSIWYG.prototype = {

      /**
       * Enable WYSIWYG on a block
       */
      enable: function(){
        if(!this.enabled){
          this.enabled = true;
          this.element.attr("contentEditable", true);
          // Events
          this._addEvent(this.element, "focus", this._onfocus);
          this._addEvent(this.element, "blur", this._onblur);
          this._addEvent(this.element, "keydown", this._onkeydown);
          this._addEvent(this.element, "keydown keyup paste change mouseup", this._onchange);
          this._addEvent(this.element, "paste", function(){
            setTimeout(function(){
              currentEditor.cleanup();
            }, 0);
          });
        }
      },

      /**
       * Disable WYSIWYG on a block
       */
      disable: function(){
        if(this.enabled){
          this.enabled = false;
          this._blurEventDefined = false;
          this._removeEvents();
          if(currentEditor == this){
            currentEditor = null;
            this._toggleToolbar(false);
            jQuery(document.body).append(toolbar);
          }
          this.element.attr("contentEditable", false);
        }
      },

      /**
       * Change tag of the block
       *
       * @param string tagName h1, h2, h3, p, pre, blockquote
       */
      formatBlock: function(tagName){
        this.execute("formatBlock", tagName);
      },

      /**
       * Execute a command
       *
       * @param string command
       * @param string value (optional)
       */
      execute: function(command, value){
        this.focus();
        document.execCommand(command, false, value);
        this._refreshButtons();
      },

      /**
       * Set focus on the editor
       */
      focus: function(){
        this.element.focus();
        if(this.lastSelection){
          this._restoreRange(this.lastSelection);
        }
      },

      /**
       * Clean up the code
       */
      cleanup: function(){
        if(this.options.raw){
          this.element.text(this.element.text());
          return;
        }

        var nodes = this.element/*.contents().detach()*/.find("*").each(function(){
          var node = jQuery(this);

          // If empty, delete node
          if(node.html() == ""){
            node.remove();
            return;
          }

          var nodeName = node.prop("nodeName").toLowerCase();
          var replacement_tags = [];
          var replacement_styles = "";
          var replacement_block_styles = "";
          var hasBlock = false;

          for(var formattingName in formattings){
            var formatting = formattings[formattingName];
            if(formatting.preferred && formatting.testNode(node)){
              var preferredTagName = false;
              // Do we use a predefined tag?
              if(formatting.preferred.tag){
                preferredTagName = formatting.preferred.tag;
              // Or do we keep the current tag?
              }else if(formatting.preferred.keepTag){
                preferredTagName = nodeName;
              }

              if(preferredTagName){
                var preferredTag = jQuery("<"+preferredTagName+"></"+preferredTagName+">");

                // Keeping some attributes?
                if(formatting.preferred.keepAttrs){
                  for(var i = formatting.preferred.keepAttrs.length - 1; i >= 0; i--){
                    var attr = node.attr(formatting.preferred.keepAttrs[i]);
                    if(attr){
                      preferredTag.attr(formatting.preferred.keepAttrs[i], attr);
                    }
                  }
                }

                // Blocks are inserted before other nodes
                if(new RegExp("^("+blockTags+")$").test(preferredTagName)){
                  replacement_tags.unshift(preferredTag);
                  hasBlock = true;
                }else{
                  replacement_tags.push(preferredTag);
                }
              }

              // Style to be applied?
              if(formatting.preferred.style){
                if(formatting.preferred.onlyIfBlock){
                  replacement_block_styles += formatting.preferred.style;
                }else{
                  replacement_styles += formatting.preferred.style;
                }
              }

            }
          }

          if(!replacement_tags[0] && replacement_styles != ""){
            replacement_tags[0] = jQuery("<span></span>");
          }
          if(replacement_tags[0]){
            var prevNode = replacement_tags[0].insertBefore(node);
            if(replacement_block_styles != "" && hasBlock){
              replacement_styles += replacement_block_styles;
            }
            if(replacement_styles != ""){
              prevNode.attr("style", replacement_styles);
            }
            for(var i = 1; i < replacement_tags.length; i++){
              prevNode = replacement_tags[i].appendTo(prevNode);
            }
            prevNode.append(node.contents());
          }else{
            node.contents().insertBefore(node);
          }
          node.remove();
        })/*.appendTo(this.element)*/;
      },

      /**
       * Assign a function to a WYSIWYG event
       *
       * @param string   eventName
       * @param Function
       */
      on: function(eventName, fn){
        this.instanceEvents.on(eventName, fn);
      },

      /**
       * Unassign a function to a WYSIWYG event
       *
       * @param string   eventName
       * @param Function (optional)
       */
      off: function(eventName, fn){
        this.instanceEvents.off(eventName, fn);
      },

      /**
       * Add an event on a element or a set of elements
       *
       * @param jQuery   element Set of elements
       * @param string   type    Event type
       * @param Function fn      Event function
       */
      _addEvent: function(element, type, fn, single){
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

      /**
       * Remove some events
       *
       * @param jQuery element Set of elements (optional)
       * @param string type    Event type (optional)
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

      /**
       * Get range of current selection
       *
       * @return Range
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

      /**
       * Restore Range as it was before blur
       *
       * @param Range range
       */
      _restoreRange: function(range) {
        if (jQuery.browser.msie) {
          range.select();
        } else {
          window.getSelection().removeAllRanges();
          window.getSelection().addRange(range);
        }
      },

      /**
       * True if the range is empty
       *
       * @param  Range range
       * @return boolean
       */
      _isEmptyRange: function(range) {
        if (range.collapsed) {
          return true;
        }
        if (range.isCollapsed) {
          if (typeof range.isCollapsed === 'function') {
            return range.isCollapsed();
          }
          return range.isCollapsed;
        }
        return false;
      },

      /**
       * Get current position (top & left) of the caret
       *
       * @param  Range  range
       * @return object {top: <top offset>, left: <left offset>}
       */
      _getCaretPosition: function(range) {
        var newRange, position, tmpSpan;
        tmpSpan = jQuery("<span/>");
        newRange = document.createRange();
        newRange.setStart(range.startContainer, range.startOffset);
        newRange.insertNode(tmpSpan.get(0));
        position = tmpSpan.offset();
        tmpSpan.remove();
        return position;
      },

      /**
       * Triggered when a change occurs in the editable element
       *
       * @param  Event event
       */
      _onchange: function(event){
        var range = this._getRange();
        this._refreshButtons(range);
        jQuery(".wysiwyg-modal").hide();
        this.instanceEvents.trigger("change");
      },

      /**
       * Triggered when a key is pressed down in the editable element
       *
       * @param  Event event
       */
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

      /**
       * Triggered when the editable element get focus
       */
      _onfocus: function(){
        currentEditor = this;
        this._toggleToolbar(this.options.toolbar);
        this._repositionToolbar();

        // Blur event
        if(!this._blurEventDefined){
          this._blurEventDefined = true;
          this.instanceEvents.trigger("focus");
          var documentElement = jQuery(document.documentElement);
          this._addEvent(documentElement, "mousedown", function(event){
            for(var i = toolElements.length-1; i >= 0; i--){
              if(jQuery.contains(toolElements[i].get(0), event.target)
                || toolElements[i].get(0) == event.target){
                return;
              }
            }
            if(!jQuery.contains(this.element.get(0), event.target)
              && this.element.get(0) != event.target
              && currentEditor == this){
              this._toggleToolbar(false);
              this._blurEventDefined = false;
              this._removeEvents(documentElement, "mousedown");
              this.instanceEvents.trigger("blur");
              if(this.options.cleanup){
                this.cleanup();
              }
            }
          });
        }
      },

      /**
       * Triggered when the editable element lose focus
       */
      _onblur: function(event){
        this.lastSelection = this._getRange();
      },

      /**
       * Show / hide toolbar
       *
       * @param boolean bool true = show, false = hide
       */
      _toggleToolbar: function(bool){
        toolbar.toggle(bool);
      },

      /**
       * Update buttons state according to the current range
       *
       * @param Range range
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
            for(var formattingName in formattings){
              var formatting = formattings[formattingName];
              if(!buttonsStates[formattingName] && formatting.testNode){
                buttonsStates[formattingName] = formatting.testNode(jQuery(this));
              }
            }
          });
          for(var formattingName in buttonsStates){
            var formatting = formattings[formattingName];
            if(formatting.toggle){
              formatting.toggle(buttonsStates[formattingName]);
            }
          }
        }
      },

      /**
       * Reposition toolbar in the current editor
       */
      _repositionToolbar: function(){
        this.element.before(toolbar);
        toolbar.css(this.element.offset());
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
