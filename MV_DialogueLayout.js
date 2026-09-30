/*:
 * @plugindesc v1.0 Adds speaker-name windows, safe wrapping, and inline italics.
 * @author Jake Mason (portfolio adaptation)
 *
 * @param Message Margin
 * @type number
 * @min 0
 * @default 12
 * @desc Extra pixels kept clear at the right edge of message text.
 *
 * @param Help Minimum Font Size
 * @type number
 * @min 10
 * @max 28
 * @default 14
 * @desc Smallest font size used to keep a help description inside its window.
 *
 * @param Message Minimum Font Size
 * @type number
 * @min 16
 * @max 28
 * @default 20
 * @desc Smallest font size used before long dialogue is continued on a new page.
 *
 * @help
 * Install below any other message plugins; avoid overlapping text layout plugins.
 *
 * Dialogue is wrapped using the real message-window width, including the
 * smaller width available when a face is present. Explicit line breaks remain
 * valid. It shrinks long text only as much as needed, then continues excess
 * lines on another message page. Put \n<Name> by itself on the final line of
 * Show Text. This plugin removes the tag and displays Name in a separate window
 * above the message.
 *
 * Skill, item, equipment and other Window_Help descriptions are wrapped to the
 * actual help-window width. If wrapping would exceed the available number of
 * lines, the description font is reduced until the complete text fits.
 *
 * This plugin has no plugin commands.
 *
 * Text code: \IT[1] turns italics on; \IT[0] turns italics off.
 */

(function() {
    'use strict';

    var parameters = PluginManager.parameters('MV_DialogueLayout');
    var messageMargin = Number(parameters['Message Margin'] || 12);
    var helpMinimumFontSize = Number(parameters['Help Minimum Font Size'] || 14);
    var messageMinimumFontSize = Number(parameters['Message Minimum Font Size'] || 20);

    var originalProcessEscapeCharacter = Window_Base.prototype.processEscapeCharacter;
    Window_Base.prototype.processEscapeCharacter = function(code, textState) {
        if (String(code).toUpperCase() === 'IT') {
            this.contents.fontItalic = this.obtainEscapeParam(textState) !== 0;
        } else {
            originalProcessEscapeCharacter.call(this, code, textState);
        }
    };

    function isStandaloneNameTag(line) {
        return /^\\n<[^>]+>\s*$/i.test(String(line));
    }

    function measuredWidth(windowObject, rawText) {
        var iconWidth = 0;
        var text = windowObject.convertEscapeCharacters(String(rawText));

        text = text.replace(/\x1bI\[\d+\]/gi, function() {
            iconWidth += Window_Base._iconWidth + 4;
            return '';
        });

        text = text.replace(/\x1b(?:C|OC|OW|FS|PX|PY)\[[^\]]*\]/gi, '');
        text = text.replace(/\x1b[A-Z]+\[[^\]]*\]/gi, '');
        text = text.replace(/\x1b[\$\.\|\^!><\{\}]/g, '');
        return windowObject.textWidth(text) + iconWidth;
    }

    function splitLongWord(windowObject, word, maximumWidth) {
        var pieces = [];
        var current = '';
        var index;

        for (index = 0; index < word.length; index += 1) {
            if (current && measuredWidth(windowObject, current + word[index]) > maximumWidth) {
                pieces.push(current);
                current = word[index];
            } else {
                current += word[index];
            }
        }
        if (current) pieces.push(current);
        return pieces;
    }

    function wrapLine(windowObject, line, maximumWidth) {
        var words;
        var output = [];
        var current = '';

        if (!line || isStandaloneNameTag(line)) return [line];
        words = String(line).trim().split(/\s+/);

        words.forEach(function(word) {
            var candidate = current ? current + ' ' + word : word;
            var pieces;

            if (measuredWidth(windowObject, candidate) <= maximumWidth) {
                current = candidate;
                return;
            }

            if (current) {
                output.push(current);
                current = '';
            }

            if (measuredWidth(windowObject, word) <= maximumWidth) {
                current = word;
                return;
            }

            pieces = splitLongWord(windowObject, word, maximumWidth);
            while (pieces.length > 1) output.push(pieces.shift());
            current = pieces[0] || '';
        });

        if (current) output.push(current);
        return output.length ? output : [''];
    }

    function wrapText(windowObject, text, maximumWidth) {
        var output = [];
        String(text || '').split('\n').forEach(function(line) {
            output = output.concat(wrapLine(windowObject, line, maximumWidth));
        });
        return output.join('\n');
    }

    function extractFinalNameTag(text) {
        var source = String(text || '');
        var match = source.match(/(?:^|\n)\s*\\n<([^>\r\n]+)>\s*$/i);
        var dialogue;

        if (!match) return { name: '', dialogue: source };
        dialogue = source.slice(0, match.index).replace(/\n\s*$/, '');
        return {
            name: String(match[1] || '').trim(),
            dialogue: dialogue
        };
    }

    function Window_PortfolioSpeakerName() {
        this.initialize.apply(this, arguments);
    }

    Window_PortfolioSpeakerName.prototype = Object.create(Window_Base.prototype);
    Window_PortfolioSpeakerName.prototype.constructor = Window_PortfolioSpeakerName;

    Window_PortfolioSpeakerName.prototype.initialize = function(messageWindow) {
        this._messageWindow = messageWindow;
        this._speakerName = '';
        Window_Base.prototype.initialize.call(this, 0, 0, 200, this.fittingHeight(1));
        this.openness = 0;
        this.deactivate();
    };

    Window_PortfolioSpeakerName.prototype.setSpeakerName = function(name) {
        name = String(name || '').trim();
        if (this._speakerName !== name) {
            this._speakerName = name;
            this.refresh();
        }
        if (name) {
            this.updatePlacement();
            this.open();
        } else {
            this.close();
        }
    };

    Window_PortfolioSpeakerName.prototype.refresh = function() {
        var desiredWidth;
        if (!this.contents) return;

        this.resetFontSettings();
        desiredWidth = this.textWidth(this._speakerName) +
            this.standardPadding() * 2 + this.textPadding() * 2 + 20;
        desiredWidth = Math.max(160, Math.min(Graphics.boxWidth, desiredWidth));

        if (this.width !== desiredWidth) {
            this.width = desiredWidth;
            this.createContents();
        }
        this.contents.clear();
        if (this._speakerName) {
            this.drawTextEx(this._speakerName, this.textPadding(), 0);
        }
        this.updatePlacement();
    };

    Window_PortfolioSpeakerName.prototype.updatePlacement = function() {
        if (!this._messageWindow) return;
        this.x = this._messageWindow.x;
        if (this._messageWindow.y >= this.height - 4) {
            this.y = this._messageWindow.y - this.height + 4;
        } else {
            this.y = this._messageWindow.y + this._messageWindow.height - 4;
        }
    };

    Window_PortfolioSpeakerName.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        this.updatePlacement();
    };

    var originalMessageInitialize = Window_Message.prototype.initialize;
    Window_Message.prototype.initialize = function() {
        originalMessageInitialize.apply(this, arguments);
        this._portfolioNameWindow = new Window_PortfolioSpeakerName(this);
    };

    var originalSubWindows = Window_Message.prototype.subWindows;
    Window_Message.prototype.subWindows = function() {
        var windows = originalSubWindows.call(this) || [];
        return windows.concat(this._portfolioNameWindow);
    };

    var originalStartMessage = Window_Message.prototype.startMessage;
    Window_Message.prototype.startMessage = function() {
        var parsed = extractFinalNameTag($gameMessage.allText());
        var maximumWidth = Math.max(96, this.contentsWidth() - this.newLineX() - messageMargin);
        var fontSize = this.standardFontSize();
        var wrappedText;
        var lines;
        var pages = [];
        var index;

        do {
            this.contents.fontSize = fontSize;
            wrappedText = wrapText(this, parsed.dialogue, maximumWidth);
            lines = wrappedText.split('\n');
            if (lines.length <= 4) break;
            fontSize -= 2;
        } while (fontSize >= messageMinimumFontSize);

        fontSize = Math.max(messageMinimumFontSize, fontSize);
        this.contents.fontSize = fontSize;
        wrappedText = wrapText(this, parsed.dialogue, maximumWidth);
        lines = wrappedText.split('\n');
        for (index = 0; index < lines.length; index += 4) {
            pages.push(lines.slice(index, index + 4).join('\n'));
        }
        wrappedText = pages.join('\f');

        this._portfolioMessageFontSize = fontSize;
        this._portfolioNameWindow.setSpeakerName(parsed.name);
        $gameMessage._texts = wrappedText.split('\n');
        originalStartMessage.call(this);
    };

    var originalMessageResetFontSettings = Window_Message.prototype.resetFontSettings;
    Window_Message.prototype.resetFontSettings = function() {
        originalMessageResetFontSettings.call(this);
        if (this._portfolioMessageFontSize) {
            this.contents.fontSize = this._portfolioMessageFontSize;
        }
    };

    var originalTerminateMessage = Window_Message.prototype.terminateMessage;
    Window_Message.prototype.terminateMessage = function() {
        if (this._portfolioNameWindow) this._portfolioNameWindow.setSpeakerName('');
        originalTerminateMessage.call(this);
        this._portfolioMessageFontSize = 0;
    };

    Window_Help.prototype.refresh = function() {
        var padding;
        var maximumWidth;
        var maximumLines;
        var fontSize;
        var wrappedText;
        var lineCount;
        var hadOwnFontSize;
        var originalStandardFontSize;

        this.contents.clear();
        if (!this._text) return;

        padding = this.textPadding();
        maximumWidth = Math.max(96, this.contentsWidth() - padding * 2);
        maximumLines = Math.max(1, Math.floor(this.contentsHeight() / this.lineHeight()));
        fontSize = this.standardFontSize();

        do {
            this.contents.fontSize = fontSize;
            wrappedText = wrapText(this, this._text, maximumWidth);
            lineCount = wrappedText.split('\n').length;
            if (lineCount <= maximumLines) break;
            fontSize -= 2;
        } while (fontSize >= helpMinimumFontSize);

        fontSize = Math.max(helpMinimumFontSize, fontSize);
        this.contents.fontSize = fontSize;
        wrappedText = wrapText(this, this._text, maximumWidth);

        hadOwnFontSize = Object.prototype.hasOwnProperty.call(this, 'standardFontSize');
        originalStandardFontSize = this.standardFontSize;
        this.standardFontSize = function() {
            return fontSize;
        };
        this.drawTextEx(wrappedText, padding, 0);

        if (hadOwnFontSize) this.standardFontSize = originalStandardFontSize;
        else delete this.standardFontSize;
    };
})();
