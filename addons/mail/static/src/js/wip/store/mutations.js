odoo.define('mail.wip.store.mutations', function (require) {
"use strict";

const MailFailure = require('mail.wip.model.MailFailure');
const Message = require('mail.wip.model.Message');
const Partner = require('mail.wip.model.Partner');
const Thread = require('mail.wip.model.Thread');
const ThreadCache = require('mail.wip.model.ThreadCache');

const core = require('web.core');
const session = require('web.session');

const _t = core._t;

const mutations = {
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {...Object} changes
     */
    'discuss/update'(
        { state },
        changes
    ) {
        if (changes.stringifiedDomain) {
            throw new Error('cannot set stringified domain on discuss state (read-only)');
        }
        let shouldRecomputeStringifiedDomain = false;
        if ('domain' in changes) {
            shouldRecomputeStringifiedDomain = true;
        } else if (changes.$thread !== state.discuss.$thread) {
            shouldRecomputeStringifiedDomain = true;
        }
        Object.assign(state.discuss, changes);
        if (shouldRecomputeStringifiedDomain) {
            state.discuss.stringifiedDomain = JSON.stringify(state.discuss.domain);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object} param1.channel_slots
     * @param {Array} [param1.commands=[]]
     * @param {boolean} [param1.is_moderator=false]
     * @param {Object[]} [param1.mail_failures=[]]
     * @param {Object[]} [param1.mention_partner_suggestions=[]]
     * @param {Object[]} [param1.moderation_channel_ids=[]]
     * @param {integer} [param1.moderation_counter=0]
     * @param {integer} [param1.needaction_inbox_counter=0]
     * @param {Object[]} [param1.shortcodes=[]]
     * @param {integer} [param1.starred_counter=0]
     */
    'init'(
        { commit, state },
        {
            channel_slots,
            commands=[],
            is_moderator=false,
            mail_failures=[],
            mention_partner_suggestions=[],
            menu_id,
            moderation_channel_ids=[],
            moderation_counter=0,
            needaction_inbox_counter=0,
            shortcodes=[],
            starred_counter=0
        }
    ) {
        commit('init/commands', commands); // required for channels, hence before
        commit('init/channels', channel_slots);
        commit('init/mailboxes', {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        });
        commit('init/mail_failures', mail_failures);
        commit('init/canned_responses', shortcodes);
        commit('init/mention_partner_suggestions', mention_partner_suggestions);
        state.discuss.menu_id = menu_id;
        state.hasPreviewFetched = false;
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} shortcodes
     */
    'init/canned_responses'({ state }, shortcodes) {
        const cannedResponses = shortcodes
            .map(s => {
                let { id, source, substitution } = s;
                return { id, source, substitution };
            })
            .reduce((obj, cr) => {
                obj[cr.id] = cr;
                return obj;
            }, {});
        Object.assign(state, { cannedResponses });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Object[]} [param1.channel_channel=[]]
     * @param {Object[]} [param1.channel_direct_message=[]]
     * @param {Object[]} [param1.channel_private_group=[]]
     */
    'init/channels'(
        { commit },
        {
            channel_channel=[],
            channel_direct_message=[],
            channel_private_group=[],
        }
    ) {
        for (let data of channel_channel) {
            commit('thread/insert', { _model: 'mail.channel', ...data });
        }
        for (let data of channel_direct_message) {
            commit('thread/insert', { _model: 'mail.channel', ...data });
        }
        for (let data of channel_private_group) {
            commit('thread/insert', { _model: 'mail.channel', ...data });
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object[]} commandsData
     */
    'init/commands'({ state }, commandsData) {
        const commands = commandsData
            .map(command => {
                return {
                    id: command.name,
                    ...command
                };
            })
            .reduce((obj, command) => {
                obj[command.id] = command;
                return obj;
            }, {});
        Object.assign(state, { commands });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {boolean} param1.is_moderator
     * @param {integer} param1.moderation_counter
     * @param {integer} param1.needaction_inbox_counter
     * @param {integer} param1.starred_counter
     */
    'init/mailboxes'(
        { commit },
        {
            is_moderator,
            moderation_counter,
            needaction_inbox_counter,
            starred_counter
        }
    ) {
        commit('thread/create', {
            _model: 'mail.box',
            counter: needaction_inbox_counter,
            id: 'inbox',
            name: _t("Inbox"),
        });
        commit('thread/create', {
            _model: 'mail.box',
            counter: starred_counter,
            id: 'starred',
            name: _t("Starred"),
        });
        if (is_moderator) {
            commit('thread/create', {
                _model: 'mail.box',
                counter: moderation_counter,
                id: 'moderation',
                name: _t("Moderate Messages"),
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object[]} mailFailuresData
     */
    'init/mail_failures'({ set, state }, mailFailuresData) {
        for (let data of mailFailuresData) {
            let mailFailure = new MailFailure(data);
            set(state.mailFailures, mailFailure.localID, mailFailure);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object[]} mentionPartnerSuggestionsData
     */
    'init/mention_partner_suggestions'(
        { commit },
        mentionPartnerSuggestionsData
    ) {
        for (let suggestions of mentionPartnerSuggestionsData) {
            for (let suggestion of suggestions) {
                const { email, id, name } = suggestion;
                commit('partner/insert', { email, id, name });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.author_id]
     * @param {integer} [param1.author_id[0]]
     * @param {string} [param1.author_id[1]]
     * @param {integer[]} param1.channel_ids
     * @param {string|boolean} [param1.model=false]
     * @param {integer[]} param1.needaction_partner_ids
     * @param {string} param1.record_name
     * @param {integer|boolean} [param1.res_id=false]
     * @param {integer[]} param1.starred_partner_ids
     * @param {...Object} param1.kwargs
     * @return {mail.wip.model.Message}
     */
    'message/create'(
        { commit, set, state },
        {
            author_id, author_id: [authorPartnerID, authorName]=[],
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        },
    ) {
        // 1. make message
        const message = new Message({
            author_id,
            channel_ids,
            model,
            needaction_partner_ids,
            record_name,
            res_id,
            starred_partner_ids,
            ...kwargs
        });
        const $message = message.localID;
        if (state.messages[$message]) {
            console.warn(`message with local ID "${$message}" already exists in store`);
            return;
        }
        set(state.messages, $message, message);

        // 2. author: create/update + link
        if (authorPartnerID) {
            const author = commit('partner/insert', {
                id: authorPartnerID,
                name: authorName,
            });
            commit('partner/link_message', { $message, $partner: author.localID });
        }

        // 3. threads: create/update + link
        if (message.$origin) {
            commit('thread/insert', {
                _model: model,
                id: res_id,
                name: record_name,
            });
        }
        // 3a. link message <- threads
        for (let $thread of message.$threads) {
            let $threadCache = `${$thread}_[]`;
            let cache = state.threadCaches[$threadCache];
            if (!cache) {
                cache = commit('thread_cache/create', { $thread });
            }
            commit('thread_cache/link_message', { $message, $threadCache });
        }
        return message;
    },
    /**
     * Unused for the moment, but may be useful for moderation
     *
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     */
    'message/delete'({ commit, state }, { $message }) {
        delete state.messages[$message];
        for (let cache of Object.values(state.threadCaches)) {
            if (cache.$messages.includes($message)) {
                commit('thread_cache/update', {
                    $threadCache: cache.localID,
                    changes: {
                        $message: cache.$messages.filter($msg => $msg !== $message),
                    },
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     */
    'message/insert'({ commit, state }, { id, ...kwargs }) {
        const $message = `mail.message_${id}`;
        let message = state.messages[$message];
        if (!message) {
            message = commit('message/create', { id, ...kwargs });
        } else {
            commit('message/update', { $message, changes: kwargs });
        }
        return message;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     */
    'message/set_star'({ commit, state }, { $message }) {
        const message = state.messages[$message];
        const currentPartnerID = session.partner_id;
        if (message.starred_partner_ids.includes(currentPartnerID)) {
            return;
        }
        commit('message/update', {
            $message,
            changes: {
                starred_partner_ids: message.starred_partner_ids.concat([currentPartnerID]),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     */
    'message/unset_star'({ commit, state }, { $message }) {
        const message = state.messages[$message];
        const currentPartnerID = session.partner_id;
        if (!message.starred_partner_ids.includes(currentPartnerID)) {
            return;
        }
        commit('message/update', {
            $message,
            changes: {
                starred_partner_ids: message.starred_partner_ids.filter(id => id !== currentPartnerID),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     * @param {Object} param1.changes
     * @param {Array} [param1.changes.author_id]
     */
    'message/update'(
        { commit, state },
        {
            $message,
            changes, changes: {
                author_id: [authorPartnerID, authorName]=[],
            },
        }
    ) {
        const message = state.messages[$message];
        let $prevAuthor = message.$author;
        const $prevThreads = [ ...message.$threads ];

        // 1. alter message
        message.update(changes);

        if (authorPartnerID) {
            commit('partner/insert', {
                id: authorPartnerID,
                name: authorName,
            });
        }

        // 2. author: create/update + link
        if ($prevAuthor && $prevAuthor !== message.$author) {
            commit('partner/unlink_message', { $partner: $prevAuthor, $message });
        }
        if (message.$author && $prevAuthor !== message.$author) {
            commit('partner/link_message', { $partner: message.$author, $message });
        }

        // 3. threads: create/update + link
        const $oldThreads = $prevThreads.filter($thread => !message.$threads.includes($thread));
        for (let $thread of $oldThreads) {
            let thread = state.threads[$thread];
            for (let $threadCache of thread.$caches) {
                commit('thread_cache/unlink_message', { $message, $threadCache });
            }
        }
        const $newThreads = message.$threads.filter($thread => !$prevThreads.includes($thread));
        for (let $thread of $newThreads) {
            let thread = state.threads[$thread];
            for (let $threadCache of thread.$caches) {
                commit('thread_cache/link_message', { $message, $threadCache });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {...Object} param1.data
     */
    'notification/needaction'({ commit, state }, { ...data }) {
        const message = commit('message/insert', { ...data });
        state.threads['mail.box_inbox'].counter++;
        for (let $thread of message.$threads) {
            const currentPartnerID = session.partner_id;
            const thread = state.threads[$thread];
            if (
                thread.channel_type === 'channel' &&
                message.needaction_partner_ids.includes(currentPartnerID)
            ) {
                commit('thread/update', {
                    $thread,
                    changes: {
                        message_needaction_counter: thread.message_needaction_counter + 1,
                    }
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} [param1.channel_ids=[]]
     * @param {integer[]} [param1.message_ids=[]]
     */
    'notification/partner/mark_as_read'(
        { commit, state },
        { channel_ids=[], message_ids=[] }
    ) {
        const $inbox = 'mail.box_inbox';
        const inbox = state.threads[$inbox];
        for (let $cache of inbox.$caches) {
            for (let messageID of message_ids) {
                let $message = `mail.message_${messageID}`;
                commit('thread_cache/unlink_message', {
                    $threadCache: $cache,
                    $message,
                });
            }
        }
        if (channel_ids) {
            for (let channelID of channel_ids) {
                let $channel = `mail.channel_${channelID}`;
                let channel = state.threads[$channel];
                if (!channel) {
                    continue;
                }
                commit('thread/update', {
                    $thread: $channel,
                    changes: {
                        message_needaction_counter: Math.max(
                            channel.message_needaction_counter - message_ids.length,
                            0
                        ),
                    },
                });
            }
        } else {
            // if no channel_ids specified, this is a 'mark all read' in inbox
            const channels = Object.values(state.threads).filter(thread =>
                thread._model === 'mail.channel');
            for (let channel of channels) {
                let $channel = channel.localID;
                commit('thread/update', {
                    $thread: $channel,
                    changes: { message_needaction_counter: 0 },
                });
            }
        }
        commit('thread/update', {
            $thread: $inbox,
            changes: {
                counter: inbox.counter - message_ids.length,
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer[]} param1.message_ids
     * @param {boolean} param1.starred
     */
    'notification/partner/toggle_star'(
        { commit, state },
        { message_ids=[], starred }
    ) {
        const $starredBox = 'mail.box_starred';
        const starredBox = state.threads[$starredBox];
        const $starredBoxMainCache = `${$starredBox}_[]`;
        let starredBoxMainCache = state.threadCaches[$starredBoxMainCache];
        if (!starredBoxMainCache) {
            starredBoxMainCache = commit('thread_cache/create', { $thread: $starredBox });
        }
        for (let messageID of message_ids) {
            let $message = `mail.message_${messageID}`;
            let message = state.messages[$message];
            if (!message) {
                continue;
            }
            if (starred) {
                commit('message/set_star', { $message });
                commit('thread/update', {
                    $thread: $starredBox,
                    changes: {
                        counter: starredBox.counter + 1,
                    },
                });
            } else {
                commit('message/unset_star', { $message });
                commit('thread/update', {
                    $thread: $starredBox,
                    changes: {
                        counter: starredBox.counter - 1,
                    },
                });
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array} [param1.author_id]
     * @param {...Object} param1.kwargs
     */
    'notification/partner/transient_message'(
        { commit, state },
        { author_id, ...kwargs }
    ) {
        const { length: l, [l - 1]: lastMessage } = Object.values(state.messages);
        commit('message/create', {
            ...kwargs,
            author_id: author_id || state.partners.odoobot.localID,
            id: (lastMessage ? lastMessage.id : 0) + 0.01
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {string} [param1.im_status]
     * @param {string} [param1.email]
     * @param {string} [param1.name]
     * @return {mail.wip.model.Partner}
     */
    'partner/create'({ set, state }, data) {
        const partner = new Partner({ ...data });
        if (state.partners[partner.localID]) {
            console.warn(`partner with local ID "${partner.localID}" already exists in store`);
            return;
        }
        set(state.partners, partner.localID, partner);
        // todo: links
        return partner;
    },
    /**
     * Update existing partner or create a new partner
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {mail.wip.model.Partner}
     */
    'partner/insert'({ commit, state }, { id, ...kwargs }) {
        const $partner = `res.partner_${id}`;
        let partner = state.partners[$partner];
        if (!partner) {
            partner = commit('partner/create', { id, ...kwargs });
        } else {
            commit('partner/update', { $partner, changes: kwargs });
        }
        return partner;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     * @param {string} param1.$partner
     */
    'partner/link_message'({ commit, state }, { $message, $partner }) {
        const partner = state.partners[$partner];
        if (partner.$messages.includes($message)) {
            return;
        }
        commit('partner/update', {
            $partner,
            changes: {
                $messages: partner.$messages.concat([$message])
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     * @param {string} param1.$partner
     */
    'partner/unlink_message'({ commit, state }, { $message, $partner }) {
        const partner = state.partners[$partner];
        if (partner.$messages.includes($message)) {
            return;
        }
        commit('partner/update', {
            $partner,
            changes: {
                $messages: partner.$messages.filter($msg => $msg !== $message),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$partner
     * @param {Object} param1.changes
     */
    'partner/update'({ state }, { $partner, changes }) {
        const partner = state.partners[$partner];
        partner.update(changes);
        // todo: changes of links, e.g. $messages
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string|undefined} [param1.channel_type=undefined]
     * @param {Object[]|undefined} [param1.direct_partner=undefined]
     * @param {string|undefined} [param1.direct_partner[0].im_status=undefined]
     * @param {Array} [param1.members=[]]
     * @param {string|undefined} [param1.type=undefined]
     * @param {...Object} param1.kwargs
     * @return {mail.wip.model.Thread}
     */
    'thread/create'(
        { commit, set, state },
        {
            channel_type,
            direct_partner,
            members=[],
            pin=true,
            type,
            ...kwargs
        }
    ) {
        const thread = new Thread({
            channel_type,
            direct_partner,
            members,
            type,
            ...kwargs
        });
        const $thread = thread.localID;
        if (state.threads[$thread]) {
            console.warn(`already exists thread with local ID ${$thread} in store`);
            return;
        }
        set(state.threads, $thread, thread);
        for (let member of members) {
            commit('partner/insert', member);
        }
        if (direct_partner && direct_partner[0]) {
            commit('partner/insert', direct_partner[0]);
        }
        if (pin) {
            commit('thread/pin', { $thread });
        }
        return thread;
    },
    /**
     * Update existing thread or create a new thread
     *
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1._model
     * @param {integer} param1.id
     * @param {...Object} param1.kwargs
     * @return {mail.wip.model.Thread}
     */
    'thread/insert'({ commit, state }, { _model, id, ...kwargs }) {
        const $thread = `${_model}_${id}`;
        let thread = state.threads[$thread];
        if (!thread) {
            thread = commit('thread/create', { _model, id, ...kwargs });
        } else {
            commit('thread/update', { $thread, changes: kwargs });
        }
        return thread;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {string} param1.$threadCache
     */
    'thread/link_thread_cache'({ commit, state }, { $thread, $threadCache }) {
        let thread = state.threads[$thread];
        if (!thread) {
            const separatorIndex = $thread.lastIndexOf('_');
            thread = commit('thread/create', {
                _model: $thread.substring(0, separatorIndex),
                id: Number($thread.substring(separatorIndex+1)),
            });
        }
        if (thread.$caches.includes($threadCache)) {
            return;
        }
        commit('thread/update', {
            $thread,
            changes: {
                $caches: thread.$caches.concat([$threadCache]),
            },
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.$thread]
     * @param {Object} param1.messageData
     * @param {Array} [param1.searchDomain=[]]
     */
    'thread/load'(
        { commit, state },
        { $thread, messagesData, searchDomain=[] }
    ) {
        const stringifiedDomain = JSON.stringify(searchDomain);
        const $threadCache = commit('thread_cache/insert', {
            $thread,
            allHistoryLoaded: messagesData.length < state.FETCH_LIMIT,
            loaded: true,
            stringifiedDomain,
        }).localID;
        for (let data of messagesData) {
            const $message = commit('message/insert', data).localID;
            commit('thread_cache/link_message', { $threadCache, $message });
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.$thread]
     */
    'thread/pin'({ commit }, { $thread }) {
        commit('thread/update', { $thread, changes: { pin: true } });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} [param1.$thread]
     */
    'thread/unpin'({ commit }, { $thread }) {
        commit('thread/update', { $thread, changes: { pin: false } });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {Object} param1.changes
     * @param {boolean} [param1.changes.pin]
     */
    'thread/update'({ state }, { $thread, changes }) {
        state.threads[$thread].update(changes);
        if (!('pin' in changes)) {
            return;
        }
        if (!changes.pin) {
            if (state.$pinnedThreads.includes($thread)) {
                state.$pinnedThreads = state.$pinnedThreads.filter($thr => $thr !== $thread);
            }
        } else {
            if (!state.$pinnedThreads.includes($thread)) {
                state.$pinnedThreads.push($thread);
            }
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.set
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {string} [param1.stringifiedDomain='[]']
     * @return {mail.wip.model.ThreadCache}
     */
    'thread_cache/create'(
        { commit, set, state },
        { $thread, stringifiedDomain='[]' }
    ) {
        const threadCache = new ThreadCache({
            $thread,
            stringifiedDomain,
        });
        const $threadCache = threadCache.localID;
        set(state.threadCaches, $threadCache, threadCache);
        commit('thread/link_thread_cache', { $thread, $threadCache });
        return threadCache;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {string} [param1.stringifiedDomain='[]']
     * @param {...Object} param1.kwargs
     * @return {mail.wip.model.ThreadCache}
     */
    'thread_cache/insert'(
        { commit, state },
        { $thread, stringifiedDomain='[]', ...kwargs }
    ) {
        const $threadCache = `${$thread}_${stringifiedDomain}`;
        let threadCache = state.threadCaches[$threadCache];
        if (!threadCache) {
            threadCache = commit('thread_cache/create', {
                $thread,
                stringifiedDomain,
                ...kwargs,
            });
        } else {
            commit('thread_cache/update', { $threadCache, changes: kwargs });
        }
        return threadCache;
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     * @param {string} param1.$threadCache
     */
    'thread_cache/link_message'({ commit, state }, { $message, $threadCache }) {
        const cache = state.threadCaches[$threadCache];
        const $thread = cache.$thread;
        if (!cache.$messages.includes($message)) {
            commit('thread_cache/update', {
                $threadCache,
                changes: {
                    $messages: cache.$messages.concat([$message]),
                },
            });
        }
        if ($threadCache !== `${$thread}_[]`) {
            return;
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     * @param {string} param1.$threadCache
     */
    'thread_cache/unlink_message'({ commit, state }, { $message, $threadCache }) {
        const cache = state.threadCaches[$threadCache];
        if (cache.$messages.includes($message)) {
            commit('thread_cache/update', {
                $threadCache,
                changes: {
                    $messages: cache.$messages.filter($msg => $msg !== $message),
                },
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$threadCache
     * @param {Object} param1.changes
     */
    'thread_cache/update'({ state }, { $threadCache, changes }) {
        const cache = state.threadCaches[$threadCache];
        cache.update(changes);
    },
};

return mutations;

});
