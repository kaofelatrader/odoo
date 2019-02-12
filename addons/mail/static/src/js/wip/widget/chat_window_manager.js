odoo.define('mail.wip.widget.ChatWindowManager', function (require) {
"use strict";

// var BlankThreadWindow = require('mail.wip.widget.BlankThreadWindow');
// var ThreadWindow = require('mail.wip.widget.ThreadWindow');
var config = require('web.config');
var core = require('web.core');
var utils = require('web.utils');

const { Component, QWeb } = owl;

var _t = core._t;

class ChatWindowManager extends Component {
    constructor(env) {
        super(env);
        // width of 'hidden thread window' dropdown button
        this.HIDDEN_THREAD_WINDOW_DROPDOWN_BUTTON_WIDTH = 50;
        // where thread windows are appended
        this.THREAD_WINDOW_APPENDTO = 'body';
        // width of a thread window (+ 5 pixels between windows)
        this.THREAD_WINDOW_WIDTH = 325 + 5;
        this.env = env;
        Object.assign(this.env, {
            app: { dispatch: (...args) => this.dispatch(...args) },
            qweb: new QWeb(),
        });
        this.state = {
            availableSlotsForThreadWindows: 0,
            hiddenThreadWindows: [],
            keepHiddenThreadWindowsDropdownOpen: false, // used to keep dropdown open when closing thread windows
            spaceLeftForThreadWindows: 0,
            threadWindows: [],
            $hiddenThreadWindowsDropdown: null, // jQuery element for the dropdown of hidden thread windows
        };
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Open a thread in a thread window
     *
     * @param {Object} data
     * @param {integer} data.$thread a valid thread ID
     * @param {Object} [data.options={}]
     * @param {boolean} [data.options.passively=false] if set to true, open the
     *   thread window without focusing the input and marking messages as read
     *   if it is not open yet, and do nothing otherwise.
     * @param {boolean} [data.options.keepFoldState=false] if set to true, keep
     *   the fold state of the thread
     * @return {Promise}
     */
    async openThreadWindow({ $thread, options, options: { passively=false, keepFoldState=false }={} }) {
        // valid $thread, therefore no check
        const thread = this.env.store.threads[$thread];
        if (thread.isCreatingWindow) {
            return;
        }
        let threadWindow = this._getThreadWindow({ $thread });
        if (!threadWindow) {
            thread.isCreatingWindow = true;
            try {
                await thread.fetchMessages();
                threadWindow = this._makeNewThreadWindow({ $thread, options });
                this._placeNewThreadWindow(threadWindow, passively);
                await threadWindow.appendTo($(this.THREAD_WINDOW_APPENDTO));
                this._repositionThreadWindows();
                return await this.env.store.dispatch('thread/load', { $thread });
            } catch (err) {
                // thread window could not be open, which may happen due to
                // access error while fetching messages to the document.
                // abort opening the thread window in this case.
                this.env.store.dispatch('closeThread', { $thread });
            }
            thread.isCreatingWindow = false;
        } else if (!passively) {
            if (threadWindow.isHidden) {
                this._makeThreadWindowVisible({ $thread });
            }
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Add the thread window such that it will be the left-most visible window.
     * Note that adding a new thread window may decrement the amount of
     * available slots for visible thread windows.
     * For example:
     *
     * - global width of 800px
     * - button width of 100px
     * - thread width of 250px
     *
     * Without button: 3 thread windows (3*250px = 750px < 800px)
     *    With button: 2 thread windows (2*250px + 100px = 600px < 800px)
     *
     * So in order for the thread window to be the left-most visible window,
     * we should compute available slots after insertion of the thread window.
     *
     * @private
     * @param {mail.ThreadWindow} threadWindow
     */
    _addThreadWindow(threadWindow) {
        this._threadWindows.push(threadWindow);
        this._computeAvailableSlotsForThreadWindows();
        this._threadWindows.pop();
        this._threadWindows.splice(this._availableSlotsForThreadWindows-1, 0, threadWindow);
    }
    /**
     * States whether all the thread windows are hidden or not.
     * When discuss is open, the thread windows are hidden.
     *
     * @private
     * @returns {boolean}
     */
    _areAllThreadWindowsHidden() {
        return $(this.THREAD_WINDOW_APPENDTO).hasClass('o_no_thread_window');
    }
    /**
     * Close the blank thread window.
     *
     * @private
     */
    _closeBlankThreadWindow() {
        const blankThreadWindow = this._getBlankThreadWindow();
        if (blankThreadWindow) {
            this._closeThreadWindow({ $thread: blankThreadWindow.$thread });
        }
    }
    /**
     * Close the thread window linked to the thread with local ID
     * `$thread`. If there is no window linked to this thread, do nothing.
     *
     * @private
     */
    _closeThreadWindow({ $thread }) {
        var threadWindow = this._threadWindows.find(tw => tw.$thread === $thread);
        if (!threadWindow) {
            return;
        }
        this._threadWindows = this._threadWindows.filter(tw => tw !== threadWindow);
        this._repositionThreadWindows();
        threadWindow.destroy();
    }
    /**
     * Compute the number of available slots to display thread windows on the
     * screen. This is based on the width of the screen, and the width of a
     * single thread window.
     *
     * The available slots attributes are updated as a consequence of this
     * method call.
     *
     * @private
     */
    _computeAvailableSlotsForThreadWindows() {
        if (config.device.isMobile) {
            // one thread window full screen in mobile
            this._availableSlotsForThreadWindows = 1;
            return;
        }
        var GLOBAL_WIDTH = this._getGlobalWidth();
        var THREAD_WINDOW_NUM = this._threadWindows.length;
        var availableSlots = Math.floor(GLOBAL_WIDTH/this.THREAD_WINDOW_WIDTH);
        var spaceLeft = GLOBAL_WIDTH - (Math.min(availableSlots, THREAD_WINDOW_NUM)*this.THREAD_WINDOW_WIDTH);
        if (availableSlots < THREAD_WINDOW_NUM && spaceLeft < this.HIDDEN_THREAD_WINDOW_DROPDOWN_BUTTON_WIDTH) {
            // leave at least space for the hidden windows dropdown button
            availableSlots--;
            spaceLeft += this.THREAD_WINDOW_WIDTH;
        }
        this._availableSlotsForThreadWindows = availableSlots;
        this._spaceLeftForThreadWindows = spaceLeft;
    }
    /**
     * Get the blank thread window, which is the special thread window that has
     * no thread linked to it.
     *
     * This is useful in case a DM chat window may replace the blank thread
     * window, when we want to open a DM chat from the blank thread window.
     *
     * @private
     * @returns {mail.ThreadWindow|undefined} the "blank thread" window,
     *   if it exists, otherwise undefined
     */
    _getBlankThreadWindow() {
        return this._threadWindows.find(tw => tw.$thread === null);
    }
    /**
     * Get the width of the browser, which is useful to determine how many
     * open thread windows are visible or hidden.
     *
     * @private
     * @returns {integer}
     */
    _getGlobalWidth() {
        return window.innerWidth;
    }
    /**
     * Get thread window in the hidden windows matching ID `$thread`.
     *
     * Note: hidden windows are open windows that cannot be displayed
     * due to having more thread windows open than available slots for thread
     * windows on the screen. These thread windows are displayed in the hidden
     * thread window dropdown menu.
     *
     * @private
     * @returns {mail.ThreadWindow|undefined} the hidden thread window,
     *   if exists
     */
    _getHiddenThreadWindow({ $thread }) {
        return this._hiddenThreadWindows.find(tw => tw.$thread === $thread);
    }
    /**
     * Get thread window matching provided ID
     *
     * @private
     * @returns {mail.ThreadWindow|undefined} the thread window, if exists
     */
    _getThreadWindow({ $thread }) {
        return this._threadWindows.filter(tw => tw.$thread === $thread);
    }
    /**
     * Make the hidden thread window dropdown menu, that is render it and set
     * event listener on this dropdown menu DOM element.
     *
     * @private
     */
    _makeHiddenThreadWindowsDropdown() {
        if (this._$hiddenThreadWindowsDropdown) {
            this._$hiddenThreadWindowsDropdown.remove();
        }
        if (this._hiddenThreadWindows.length) {
            this._$hiddenThreadWindowsDropdown = this._renderHiddenThreadWindowsDropdown();
            const $hiddenWindowsDropdown = this._$hiddenThreadWindowsDropdown;
            $hiddenWindowsDropdown.css({right: this.THREAD_WINDOW_WIDTH * this._availableSlotsForThreadWindows, bottom: 0 });
            $hiddenWindowsDropdown.appendTo(this.THREAD_WINDOW_APPENDTO);
            this._repositionHiddenWindowsDropdown();
            this._keepHiddenThreadWindowsDropdownOpen = false;

            $hiddenWindowsDropdown.on('click', '.o_thread_window_header', ev => {
                const $thread = $(ev.currentTarget).data('thread-local-id');
                this._makeThreadWindowVisible({ $thread });
            }).on('click', '.o_thread_window_close', ev => {
                const $thread = $(ev.currentTarget).closest('.o_thread_window_header').data('thread-local-id');
                const threadWindow = this._getHiddenThreadWindow({ $thread });
                if (threadWindow) {
                    threadWindow.close();
                    // keep the dropdown open
                    this._keepHiddenThreadWindowsDropdownOpen = true;
                }
            });
        }
    }
    /**
     * Make a new thread window linked to a thread.
     *
     * @private
     * @param {Object} data
     * @param {integer|string} data.$thread
     * @param {Object} data.options
     * @param {boolean} [data.options.passively=false]
     */
    _makeNewThreadWindow({ $thread, options: { passively=false }={} }) {
        const threadWindowOptions = Object.assign({}, { autofocus: !passively, passively });
        // return new ThreadWindow(this, { $thread, msgstore: this.msgstore }, threadWindowOptions);
    }
    /**
     * Make an open thread window fully visible on screen.
     *
     * This method assumes that the thread window is hidden (i.e. in the hidden
     * dropdown menu). To make it visible, it swap the position of this thread
     * window with the last thread window that is visible (i.e. the left-most
     * visible thread window).
     *
     * @private
     */
    _makeThreadWindowVisible({ $thread }) {
        var threadWindow = this._getThreadWindow({ $thread });
        if (!threadWindow) {
            return;
        }
        utils.swap(this._threadWindows, threadWindow, this._threadWindows[this._availableSlotsForThreadWindows-1]);
        this._repositionThreadWindows();
        threadWindow.toggleFold(false);
    }
    /**
     * Open and detach the DM chat in a thread window.
     *
     * This method assumes that no such DM chat exists locally, so it is kind
     * of a "create DM chat and open DM chat window" operation
     *
     * @private
     * @returns {$.Promise<integer>} resolved with ID of the DM chat
     */
    async _openAndDetachDMChat({ partnerID }) {
        const dmData = await this._rpc({
            model: 'mail.channel',
            method: 'channel_get_and_minimize',
            args: [[partnerID]],
        });
        this._addChannel({ channelData: dmData }); // aku todo: should be handled in messaging manager
    }
    /**
     * On opening a new thread window, place it with other thread windows:
     *
     *  - if it has been open with the blank thread window, replace the blank
     *    thread window with this one
     *  - if it has been open passively, simply but it after all windows
     *  - otherwise, make it the left-most visible thread window
     *
     * @param {mail.ThreadWindow} threadWindow a thread window that is linked
     *   to a thread (this must not be the blank thread window)
     * @param {boolean} [passively=false] if set, if the thread window does not
     *   replace the blank thread window, it is add at the tail of the list of
     *   thread windows, which might be put in the thread window hidden dropdown
     *   menu if there are not enough space on the screen.
     */
    _placeNewThreadWindow(threadWindow, passively) {
        const thread = this.env.store.state.threads[threadWindow.$thread];
        // replace the blank thread window?
        // the thread window should be a DM
        const blankThreadWindow = this._getBlankThreadWindow();
        if (
            blankThreadWindow &&
            thread.channel_type === 'chat' &&
            thread.$directPartner === blankThreadWindow.$directPartner
        ) {
            // the window takes the place of the 'blank' thread window
            const index = this._threadWindows.indexOf(blankThreadWindow);
            this._threadWindows[index] = threadWindow;
            blankThreadWindow.destroy();
        } else if (passively) {
            // simply insert the window to the left
            this._threadWindows.push(threadWindow);
        } else {
            // add window such that it is visible
            this._addThreadWindow(threadWindow);
        }
    }
    /**
     * Unfold dropdown to the left if there is enough space on the screen.
     *
     * @private
     */
    _repositionHiddenWindowsDropdown() {
        const $dropdownUL = this._$hiddenThreadWindowsDropdown.children('ul');
        if (this._spaceLeftForThreadWindows > $dropdownUL.width() + 10) {
            $dropdownUL.addClass('dropdown-menu-right');
        }
    }
    /**
     * Load the template of the hidden thread window dropdown
     *
     * @private
     * @returns {jQuery.Element}
     */
    _renderHiddenThreadWindowsDropdown() {
        const $dropdown = $(core.qweb.render('mail.HiddenThreadWindowsDropdown', {
            threadWindows: this._hiddenThreadWindows,
            open: this._keepHiddenThreadWindowsDropdownOpen,
            unreadCounter: this._hiddenThreadWindowsUnreadCounter,
            widget: {
                isMobile: () => config.device.isMobile,
            }
        }));
        return $dropdown;
    }
    /**
     * Reposition the thread windows that should be hidden on the screen.
     * Thread windows that have an index equal or greater than `index` in the
     * attribute `threadWindows` should be hidden. Those thread windows are put
     * in the hidden thread window dropdown menu.
     *
     * This function assumes that we have already computed the available slots.
     *
     * @private
     */
    _repositionHiddenThreadWindows() {
        let hiddenWindows = [];
        let hiddenUnreadCounter = 0;
        let index = this._availableSlotsForThreadWindows;
        while (index < this._threadWindows.length) {
            let threadWindow = this._threadWindows[index];
            hiddenWindows.push(threadWindow);
            hiddenUnreadCounter += threadWindow.unreadCounter;
            threadWindow.do_hide();
            index++;
        }
        this._hiddenThreadWindows = hiddenWindows;
        this._hiddenThreadWindowsUnreadCounter = hiddenUnreadCounter;
        this._makeHiddenThreadWindowsDropdown();
    }
    /**
     * Reposition the thread windows, based on the size of the screen:
     *
     *  - display thread windows by increasing order of index in
     *    `store.threadWindows` attribute, from right to left on the screen
     *  - if there is no enough space to show all windows at once, display
     *    a dropdown menu for hidden windows.
     *
     * This method should be called whenever there is a change of state of a
     * thread in a window. Also, when this method is called, all the windows
     * are visible and stacked in the top-left corner of the screen.
     *
     * @private
     */
    _repositionThreadWindows() {
        this._computeAvailableSlotsForThreadWindows();
        this._repositionVisibleThreadWindows();
        this._repositionHiddenThreadWindows();
    }
    /**
     * Reposition the thread windows that should be visible on the screen.
     *
     * This function assumes that we have already computed the available slots.
     *
     * @private
     */
    _repositionVisibleThreadWindows() {
        let index = 0;
        while (
            index < this._availableSlotsForThreadWindows &&
            index < this._threadWindows.length
        ) {
            let threadWindow = this._threadWindows[index];
            let cssProps = { bottom: 0 };
            cssProps[_t.database.parameters.direction === 'rtl' ? 'left' : 'right'] = this.THREAD_WINDOW_WIDTH*index;
            threadWindow.$el.css(cssProps);
            threadWindow.do_show();
            index++;
        }
    }
    /**
     * Update thread windows state of threads that have `message`.
     * This is either a new message or an updated message.
     *
     * @private
     * @param {Object} data
     * @param {integer} data.$message
     * @param {Object} data.options
     * @param {boolean} [data.options.keepBottom=false] if set, thread windows with
     *   this message should scroll to the bottom if their bottoms are currently
     *   visible.
     * @param {boolean} [data.options.passively=false] if set, thread windows with
     *   this message become passive, so that they are marked as read only when
     *   the focus is on the thread window.
     */
    _updateThreadWindowsFromMessage({
        $message,
        options, options: {
            keepBottom=false,
            passively=false,
        }={},
    }) {
        const message = this.env.store.state.messages[$message];
        for (let threadWindow of this._threadWindows) {
            if (message.$threads.includes(threadWindow.$thread)) {
                threadWindow.update(options);
            }
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when someone asks window manager whether the bottom of `thread` is
     * visible or not. An object `query` is provided in order to reponse on the
     * key `isVisible`.
     *
     * @private
     * @param {Object} data
     * @param {integer|string} data.$thread
     * @param {Object} data.query
     * @param {boolean} data.query.isVisible write on it
     */
    _onIsThreadBottomVisible({ $thread, query }) {
        const thread = this.env.store.state.threads[$thread];
        for (let threadWindow of this._threadWindows) {
            if (
                thread.localID === threadWindow.$thread &&
                threadWindow.isAtBottom() &&
                !threadWindow.isHidden
            ) {
                query.isVisible = true; // aku todo: find better design than pass by reference
            }
        }
    }
    /**
     * @override {mail.wip.MessagingMixin}
     * @private
     * @return {Promise}
     */
    async _onMessagingChanges({
        notification: {
            type,
            data,
        }={},
        store,
    }) {
        if (!type) {
            return;
        }
        switch (type) {
            case 'CLOSE_NEW_CONVERSATION':
                return this._onMessagingChangesCloseNewConversation();
            case 'DISCUSS_OPEN_CHANGED':
                return this._onMessagingChangesDiscussOpenChanged(data);
            case 'MESSAGES_LOADED_FROM_THREAD':
                return this._onMessagingChangesMessagesLoadedFromThread(data);
            case 'NEW_CHANNEL':
                return this._onMessagingChangesNewChannel(data);
            case 'NEW_MESSAGE':
                return this._onMessagingChangesNewMessage(data);
            case 'NEW_CONVERSATION_STARTED':
                return this._onMessagingChangesNewConversationStarted();
            case 'OPEN_DM_FROM_NEW_CONVERSATION':
                return this._onMessagingChangesOpenDMChatWindowFromNewConversation(data);
            case 'OPEN_THREAD_IN_THREAD_WINDOW':
                return this._onMessagingChangesOpenThreadInThreadWindow(data);
            case 'UNSUBSCRIBED_FROM_CHANNEL':
                return this._onMessagingChangesUnsubscribedFromChannel(data);
            case 'UPDATED_MESSAGE':
                return this._onMessagingChangesUpdatedMessage(data);
            case 'UPDATED_THREAD_UNREAD_COUNTER':
                return this._onMessagingChangesUpdatedThreadUnreadCounter(data);
        }
    }
    /**
     * @private
     */
    async _onMessagingChangesCloseNewConversation() {
        if (this.env.store.state.discuss.isOpen) {
            return;
        }
        this._closeBlankThreadWindow();
    }
    /**
     * @private
     */
    async _onMessagingChangesDiscussOpenChanged({ isOpen }) {
        if (isOpen) {
            $(this.THREAD_WINDOW_APPENDTO).addClass('o_no_thread_window');
        } else {
            $(this.THREAD_WINDOW_APPENDTO).removeClass('o_no_thread_window');
            this._repositionThreadWindows();
        }
    }
    /**
     * @private
     */
    async _onMessagingChangesMessagesLoadedFromThread({ $thread }) {
        const thread = this.env.store.state.threads[$thread];
        const threadWindow = this._getThreadWindow({ $thread });
        if (!threadWindow) {
            return;
        }
        threadWindow.scrollToBottom();
        if (
            !this._areAllThreadWindowsHidden() &&
            thread.fold_state === 'open' &&
            !threadWindow.isPassive
        ) {
            this.env.store.dispatch('markThreadAsRead', { $thread });
        }
    }
    /**
     * Show or hide window of this channel when a new channel is added.
     *
     * @private
     */
    async _onMessagingChangesNewChannel({ channelID }) {
        const channel = this.env.store.state.threads[`mail.channel_${channelID}`];
        if (channel.is_minimized) {
            this.openThreadWindow({
                $thread: channel.localID,
                options: { keepFoldState: true, passively: true },
            });
        } else {
            this._closeThreadWindow({ $thread: channel.localID });
        }
    }
    /**
     * @private
     */
    async _onMessagingChangesNewMessage({ $message }) {
        this._updateThreadWindowsFromMessage({
            $message,
            options: {
                keepBottom: true,
                passively: true,
            },
        });
    }
    /**
     * Open the blank thread window (i.e. the thread window without any thread
     * linked to it). Make it if there is no blank thread window yet.
     *
     * @private
     */
    async _onMessagingChangesNewConversationStarted() {
        if (this.env.store.state.discuss.isOpen) {
            return;
        }
        var blankThreadWindow = this._getBlankThreadWindow();
        if (!blankThreadWindow) {
            // blankThreadWindow = new BlankThreadWindow(this);
            this._addThreadWindow(blankThreadWindow);
            return blankThreadWindow.appendTo(this.THREAD_WINDOW_APPENDTO).then(this._repositionThreadWindows.bind(this));
        } else {
            if (blankThreadWindow.isHidden) {
                this._makeThreadWindowVisible({ $thread: blankThreadWindow.threadLocalID });
            } else if (blankThreadWindow.isFolded) {
                blankThreadWindow.toggleFold(false);
            }
        }
    }
    /**
     * aku todo: most logic here should be handled by messaging manager
     *
     * Open a DM chat in a thread window. This is useful when selecting a DM
     * chatin the blank thread window, so that it replaces it with the DM chat
     * window.
     *
     * @private
     */
    async _onMessagingChangesOpenDMChatWindowFromNewConversation({ partnerID }) {
        if (this.env.store.state.discuss.isOpen) {
            return;
        }
        var dm = Object.values(this.env.store.state.threads).find(thread =>
            thread.$directPartner === `res.partner_${partnerID}`);
        if (!dm) {
            this._openAndDetachDMChat({ partnerID });
        } else {
            this.openThreadWindow({ $thread: dm.localID });
        }
        this._closeBlankThreadWindow();
    }
    /**
     * @private
     */
    async _onMessagingChangesOpenThreadInThreadWindow({ $thread }) {
        this.openThreadWindow({ $thread });
    }
    /**
     * @private
     */
    async _onMessagingChangesUnsubscribedFromChannel({ channelID }) {
        this._closeThreadWindow({ $thread: `mail.channel_${channelID}` });
    }
    /**
     * @private
     */
    async _onMessagingChangesUpdatedMessage({ $message }) {
        this._updateThreadWindowsFromMessage({
            $message,
            options: {
                keepBottom: false,
            },
        });
    }
    /**
     * Called when a thread has its unread counter that has changed.
     * The unread counter on the thread windows should be updated.
     *
     * @private
     */
    async _onMessagingChangesUpdatedThreadUnreadCounter({ $thread }) {
        this._hiddenThreadWindowsUnreadCounter = 0;
        const unreadCounters = this._threadWindows.map(threadWindow => threadWindow.isHidden ? threadWindow.unreadCounter : 0);
        this._hiddenThreadWindowsUnreadCounter = unreadCounters.reduce((c1, c2)  => c1 + c2);
        if (this._$hiddenThreadWindowsDropdown) {
            this._$hiddenThreadWindowsDropdown.html(this._renderHiddenThreadWindowsDropdown().html());
            this._repositionHiddenWindowsDropdown();
        }
    }
}

// core.serviceRegistry.add('chat_window_manager', ChatWindowManager);

return ChatWindowManager;

});
