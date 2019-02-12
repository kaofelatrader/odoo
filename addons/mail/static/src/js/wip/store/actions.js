odoo.define('mail.wip.store.actions', function (require) {
"use strict";

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');

const config = require('web.config');
const core = require('web.core');
const session = require('web.session');
const utils = require('web.utils');

const _t = core._t;

/**
 * @param {Object[]} notifications
 * @return {Object[]}
 */
function filterNotificationsOnUnsubscribe(notifications) {
    const unsubscribedNotif = notifications.find(notif =>
        notif[1].info === 'unsubscribe');
    if (unsubscribedNotif) {
        notifications = notifications.filter(notif =>
            notif[0][1] !== 'mail.channel' ||
            notif[0][2] !== unsubscribedNotif[1].id);
    }
    return notifications;
}

/**
 * @param {string} htmlString
 * @return {string}
 */
function generateEmojisOnHtml(htmlString) {
    for (let emoji of emojis) {
        for (let source of emoji.sources) {
            let escapedSource = String(source).replace(
                /([.*+?=^!:${}()|[\]/\\])/g,
                '\\$1');
            let regexp = new RegExp(
                '(\\s|^)(' + escapedSource + ')(?=\\s|$)',
                'g');
            htmlString = htmlString.replace(regexp, '$1' + emoji.unicode);
        }
    }
    return htmlString;
}

/**
 * @param {Object} param0
 * @param {Object} param0.state
 * @param {Object} param1
 * @param {string} param1.$thread
 * @return {Object}
 */
function getThreadFetchMessagesKwargs({ state }, { $thread }) {
    const thread = state.threads[$thread];
    let kwargs = {
        limit: state.FETCH_LIMIT,
        context: session.user_context
    };
    if (thread.moderation) {
        // thread is a channel
        kwargs.moderated_channel_ids = [thread.id];
    }
    return kwargs;
}

const actions = {
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {string} param1.name
     * @param {integer|undefined} [param1.partnerID=undefined]
     * @param {string|undefined} [param1.public=undefined]
     * @param {string} param1.type
     */
    async 'channel/create'(
        { commit, env },
        { name, partnerID, public: publicStatus, type }
    ) {
        const data = await env.rpc({
            model: 'mail.channel',
            method: type === 'chat' ? 'channel_get' : 'channel_create',
            args: type === 'chat' ? [[partnerID]] : [name, publicStatus],
            kwargs: {
                context: {
                    ...session.user_content,
                    isMobile: config.device.isMobile
                }
            }
        });
        commit('thread/create', { ...data });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {boolean} [param1.autoselect=false]
     * @param {integer} param1.channelID
     */
    async 'channel/join'(
        { commit, env, state },
        { autoselect=false, channelID }
    ) {
        let channel = state.threads[`mail.channel_${channelID}`];
        if (channel) {
            return;
        }
        const data = await env.rpc({
            model: 'mail.channel',
            method: 'channel_join_and_get_info',
            args: [[channelID]]
        });
        channel = commit('thread/create', { ...data });
        if (autoselect && state.discuss.open) {
            commit('discuss/update', {
                $thread: channel.localID,
                domain: [],
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     */
    async 'channel/unsubscribe'(
        { env, state },
        { $thread }
    ) {
        const thread = state.threads[$thread];
        if (thread.channel_type === 'channel') {
            return env.rpc({
                model: 'mail.channel',
                method: 'action_unfollow',
                args: [[thread.id]]
            });
        }
        return env.rpc({
            model: 'mail.channel',
            method: 'channel_pin',
            args: [thread.uuid, false]
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     */
    async 'document_thread/load'(
        { commit, dispatch, env, state },
        { $thread }
    ) {
        const thread = state.threads[$thread];
        if (!thread.documentID || !thread.mustFetchMessageIDs) {
            return;
        }
        const [{ message_ids }] = await env.rpc({
            model: thread._model,
            method: 'read',
            args: [[thread.id], ['message_ids']]
        });
        const $threadCache = `${$thread}_[]`;
        let threadCache = state.threadCaches[$threadCache];
        if (!threadCache) {
            threadCache = commit('thread_cache/create', {
                $thread,
                stringifiedDomain: '[]',
            });
        }
        const loadedMessageIDs = threadCache.$messages
            .filter($message => message_ids.includes(state.messages[$message].id))
            .map($message => state.messages[$message].id);
        const shouldFetch = message_ids
            .slice(0, state.FETCH_LIMIT)
            .filter(messageID => !loadedMessageIDs.includes(messageID))
            .length > 0;
        if (!shouldFetch) {
            return;
        }
        const idsToLoad = message_ids
            .map(msgID => !loadedMessageIDs.includes(msgID))
            .slice(0, state.FETCH_LIMIT);
        const msgsData = await env.rpc({
            model: 'mail.message',
            method: 'message_format',
            args: [idsToLoad],
            context: session.user_context
        });
        const $messages = msgsData.map(data => {
            let message = commit('message/create', { ...data });
            return message.localID;
        });
        await dispatch('message/mark_as_read', { $messages });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {function} param1.ready
     */
    async init(
        { commit, dispatch, env },
        { ready }
    ) {
        await session.is_bound;
        const context = {
            isMobile: config.device.isMobile,
            ...session.user_context
        };
        const data = await env.rpc({
            route: '/mail/init_messaging',
            params: { context: context }
        });
        commit('init', data);
        env.call('bus_service', 'onNotification', null, notifs => dispatch('notification', notifs));
        ready();
        env.call('bus_service', 'startPolling');
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Array[]} domains
     */
    async 'message/mark_all_as_read'({ env }, domain) {
        await env.rpc({
            model: 'mail.message',
            method: 'mark_all_as_read',
            kwargs: {
                channel_ids: [],
                domain
            }
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.$messages
     */
    async 'message/mark_as_read'(
        { env, state },
        { $messages }
    ) {
        const ids = $messages
            .filter($message => {
                let message = state.messages[$message];
                // If too many messages, not all are fetched,
                // and some might not be found
                return !message || message.needaction_partner_ids.includes(session.partner_id);
            })
            .map($message => state.messages[$message].id);
        if (!ids.length) {
            return;
        }
        await env.rpc({
            model: 'mail.message',
            method: 'set_message_done',
            args: [ids]
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$message
     */
    async 'message/toggle_star'(
        { env, state },
        { $message }
    ) {
        return env.rpc({
            model: 'mail.message',
            method: 'toggle_message_starred',
            args: [[state.messages[$message].id]]
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     */
    async 'message/unstar_all'({ env }) {
        return env.rpc({
            model: 'mail.message',
            method: 'unstar_all',
            args: [[]]
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object[]} notifs
     */
    async notification(
        { commit, dispatch },
        notifs
    ) {
        notifs = filterNotificationsOnUnsubscribe(notifs);
        const proms = notifs.map(notif => {
            let model = notif[0][1];
            switch (model) {
                case 'ir.needaction':
                    return commit('notification/needaction', { ...notif[1] });
                case 'mail.channel':
                    return dispatch('notification/channel', {
                        channelID: notif[0][2],
                        ...notif[1]
                    });
                case 'res.partner':
                    return dispatch('notification/partner', { ...notif[1] });
                default:
                    console.warn(`[store ${this.name}] Unhandled notification "${model}"`);
                    return;
            }
        });
        return Promise.all(proms);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {integer} param1.channelID
     * @param {string|undefined} [param1.info=undefined]
     * @param {...Object} param1.kwargs
     */
    async 'notification/channel'(
        { dispatch },
        { channelID, info, ...kwargs }
    ) {
        switch (info) {
            case 'channel_fetched':
                return; // disabled seen notification feature
            case 'channel_seen':
                return dispatch('notification/channel/seen', { channelID, ...kwargs });
            case 'typing_status':
                return; // disabled typing status notification feature
            default:
                return dispatch('notification/channel/message', { channelID, info, ...kwargs });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Array|undefined} [param1.author_id=undefined]
     * @param {integer|undefined} [param1.author_id[0]=undefined]
     * @param {integer} param1.channelID
     * @param {integer[]} param1.channel_ids
     * @param {...Object} param1.kwargs
     */
    async 'notification/channel/message'(
        { commit, dispatch, state },
        { author_id, author_id: [authorPartnerID]=[], channelID, channel_ids, ...kwargs }
    ) {
        if (channel_ids.length === 1) {
            await dispatch('channel/join', { channelID: channel_ids[0] });
        }
        commit('message/create', { author_id, channel_ids, ...kwargs });
        if (authorPartnerID === session.partner_id) {
            return;
        }
        const thread = state.threads[`mail.channel_${channelID}`];
        commit('thread/update', {
            $thread: thread.localID,
            changes: { message_unread_counter: thread.message_unread_counter + 1 }
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {integer} param1.channelID
     * @param {integer} param1.last_message_id
     * @param {integer} param1.partner_id
     */
    async 'notification/channel/seen'(
        { commit },
        { channelID, last_message_id, partner_id }
    ) {
        if (session.partner_id !== partner_id) {
            return;
        }
        commit('thread/update', {
            $thread: `mail.channel_${channelID}`,
            changes: {
                seen_message_id: last_message_id,
                message_unread_counter: 0
            }
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param1
     * @param {string|undefined} [param1.info=undefined]
     * @param {string|undefined} [param1.type=undefined]
     * @param {...Object} param1.kwargs
     */
    async 'notification/partner'(
        { commit, dispatch },
        { info, type, ...kwargs }
    ) {
        if (type === 'activity_updated') {
            return; // disabled
        } else if (type === 'author') {
            return; // disabled
        } else if (type === 'deletion') {
            return; // disabled
        } else if (type === 'mail_failure') {
            return dispatch('notification/partner/mail_failure', { ...kwargs });
        } else if (type === 'mark_as_read') {
            return commit('notification/partner/mark_as_read', { ...kwargs });
        } else if (type === 'moderator') {
            return; // disabled
        } else if (type === 'toggle_star') {
            return commit('notification/partner/toggle_star', { ...kwargs });
        } else if (info === 'transient_message') {
            return commit('notification/partner/transient_message', { info, type, ...kwargs });
        } else if (info === 'unsubscribe') {
            return dispatch('notification/partner/unsubscribe', { ...kwargs });
        } else if (type === 'user_connection') {
            return dispatch('notification/partner/user_connection', { ...kwargs });
        } else {
            return dispatch('notification/partner/channel', { ...kwargs });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.channel_type
     * @param {integer} param1.id
     * @param {string|undefined} [param1.info=undefined]
     * @param {boolean} [param1.is_minimized=false]
     * @param {string} param1.name
     * @param {string} param1.state
     * @param {...Object} param1.kwargs
     */
    'notification/partner/channel'(
        { commit, env, state },
        {
            channel_type,
            id,
            info,
            is_minimized=false,
            name,
            state: channelState,
            ...kwargs
        }
    ) {
        if (channel_type !== 'channel' || channelState !== 'open') {
            return;
        }
        if (!is_minimized && info !== 'creation') {
            env.do_notify(
                _t("Invitation"),
                _t(`You have been invited to: ${name}`)
            );
        }
        if (!state.threads[`mail.channel_${id}`]) {
            commit('thread/create', {
                channel_type,
                id,
                info,
                is_minimized,
                name,
                ...kwargs
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param1
     * @param {Array} param1.elements
     */
    'notification/partner/mail_failure'(
        { commit },
        { elements }
    ) {
        for (let data of elements) {
            // todo
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.id
     */
    'notification/partner/unsubscribe'(
        { commit, env, state },
        { id }
    ) {
        const thread = state.threads[`mail.channel_${id}`];
        if (!thread) {
            return;
        }
        let message;
        if (thread.directPartner) {
            const directPartner = this.state.partners[thread.directPartner];
            message = _t(`You unpinned your conversation with <b>${directPartner.name}</b>.`);
        } else {
            message = _t(`You unsubscribed from <b>${thread.name}</b>.`);
        }
        env.do_notify(_t("Unsubscribed"), message);
        commit('thread/unpin', { $thread: thread.localID });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.partner_id
     * @param {string} param1.title
     * @param {string} param1.message
     */
    'notification/partner/user_connection'(
        { env },
        { partner_id, title, message }
    ) {
        env.call('bus_service', 'sendNotification', title, message);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {function} param1.callback
     * @param {integer} [param1.limit=10]
     * @param {string} param1.value
     */
    async 'partner/search'(
        { env, state },
        { callback, limit=10, value }
    ) {
        // prefetched partners
        let partners = [];
        const searchRegexp = new RegExp(
            _.str.escapeRegExp(utils.unaccent(value)),
            'i'
        );
        for (let partner of Object.values(state.partners)) {
            if (partners.length < limit) {
                if (
                    partner.id !== session.partner_id &&
                    searchRegexp.test(partner.name)
                ) {
                    partners.push(partner);
                }
            }
        }
        if (!partners.length) {
            partners = await env.rpc(
                {
                    model: 'res.partner',
                    method: 'im_search',
                    args: [value, limit]
                },
                { shadow: true }
            );
        }
        const suggestions = partners.map(partner => {
            return {
                id: partner.id,
                value: partner.name,
                label: partner.name
            };
        });
        await callback(_.sortBy(suggestions, 'label'));
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {Array} [param1.searchDomain=[]]
     */
    async 'thread/load'(
        { commit, dispatch, env, state },
        { $thread, searchDomain=[] }
    ) {
        const thread = state.threads[$thread];
        if (!['mail.box', 'mail.channel'].includes(thread._model)) {
            return dispatch('document_thread/load', { $thread });
        }
        const stringifiedDomain = JSON.stringify(searchDomain);
        const $threadCache = `${$thread}_${stringifiedDomain}`;
        let threadCache = state.threadCaches[$threadCache];
        if (!threadCache) {
            threadCache = commit('thread_cache/create', {
                $thread,
                stringifiedDomain,
            });
        }
        if (threadCache.loaded) {
            return;
        }
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (thread.localID === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (thread.localID === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (thread.localID === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: getThreadFetchMessagesKwargs(
                { state },
                { $thread })
        });
        commit('thread/load', {
            $thread,
            messagesData,
            searchDomain,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {Array} [param1.searchDomain=[]]
     */
    async 'thread/load_more'(
        { commit, env, state },
        { $thread, searchDomain=[] }
    ) {
        const thread = state.threads[$thread];
        const stringifiedDomain = JSON.stringify(searchDomain);
        const cache = state.threadCaches[`${$thread}_${stringifiedDomain}`];
        let domain = searchDomain.length ? searchDomain : [];
        if (thread._model === 'mail.channel') {
            domain = domain.concat([['channel_ids', 'in', [thread.id]]]);
        } else if (thread.localID === 'mail.box_inbox') {
            domain = domain.concat([['needaction', '=', true]]);
        } else if (thread.localID === 'mail.box_starred') {
            domain = domain.concat([['starred', '=', true]]);
        } else if (thread.localID === 'mail.box_moderation') {
            domain = domain.concat([['need_moderation', '=', true]]);
        }
        const minMessageID = Math.min(
            ...cache.$messages.map($message => state.messages[$message].id));
        domain = [['id', '<', minMessageID]].concat(domain);
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: getThreadFetchMessagesKwargs(
                { state },
                { $thread }
            )
        });
        commit('thread/load', {
            $thread,
            messagesData,
            searchDomain,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     */
    async 'thread/mark_as_seen'(
        { commit, env, state },
        { $thread }
    ) {
        const thread = state.threads[$thread];
        if (thread.message_unread_counter === 0) {
            return;
        }
        if (thread._model === 'mail.channel') {
            const seen_message_id = await env.rpc(
                {
                    model: 'mail.channel',
                    method: 'channel_seen',
                    args: [[thread.id]]
                },
                { shadow: true }
            );
            commit('thread/update', {
                $thread,
                changes: { seen_message_id }
            });
        }
        commit('thread/update', {
            $thread,
            changes: { message_unread_counter: 0 }
        });
    },
    /**
     * @param {Object} param0
     * @param {functon} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {Object} param1.data
     * @param {*[]} param1.data.attachment_ids
     * @param {*[]} param1.data.canned_response_ids
     * @param {integer[]} param1.data.channel_ids
     * @param {*} param1.data.command
     * @param {string} param1.data.content
     * @param {string} param1.data.message_type
     * @param {integer[]} param1.data.partner_ids
     * @param {string} param1.data.subject
     * @param {string} [param1.data.subtype='mail.mt_comment']
     * @param {integer|undefined} [param1.data.subtype_id=undefined]
     * @param {...Object} param1.data.kwargs
     * @param {Object} [param1.options]
     * @param {integer|undefined} [param1.options.res_id=undefined]
     * @param {integer|undefined} [param1.options.res_model=undefined]
     */
    async 'thread/post_message'(
        { commit, dispatch, env, state },
        {
            $thread,
            data: {
                attachment_ids,
                canned_response_ids,
                channel_ids,
                command,
                content,
                context,
                message_type,
                partner_ids,
                subject,
                subtype='mail.mt_comment',
                subtype_id,
                ...kwargs
            },
            options: { res_id, res_model } = {},
        }
    ) {
        const thread = state.threads[$thread];
        if (thread._model === 'mail.box') {
            return dispatch('thread/post_message', {
                $thread: `${res_model}_${res_id}`,
                attachment_ids,
                canned_response_ids,
                channel_ids,
                command,
                content,
                context,
                message_type,
                partner_ids,
                subject,
                subtype,
                subtype_id,
                ...kwargs
            });
        }
        // This message will be received from the mail composer as html content
        // subtype but the urls will not be linkified. If the mail composer
        // takes the responsibility to linkify the urls we end up with double
        // linkification a bit everywhere. Ideally we want to keep the content
        // as text internally and only make html enrichment at display time but
        // the current design makes this quite hard to do.
        let body = mailUtils.parseAndTransform(
            content.trim(),
            mailUtils.addLink
        );
        body = generateEmojisOnHtml(body);
        let postData;
        if (thread._model === 'mail.channel') {
            postData = {
                body,
                message_type: 'comment',
                subtype: 'mail.mt_comment'
            };
            await env.rpc({
                model: 'mail.channel',
                method: command ? 'execute_command' : 'message_post',
                args: [thread.id],
                kwargs: postData
            });
        } else {
            postData = {
                partner_ids,
                channel_ids: channel_ids.map(id => [4, id, false]),
                body,
                attachment_ids,
                canned_response_ids
            };
            if (subject) {
                postData.subject = subject;
            }
            postData = {
                ...postData,
                context,
                message_type,
                subtype,
                subtype_id
            };
            const id = await env.rpc({
                model: thread._model,
                method: 'message_post',
                args: [thread.id],
                kwargs: postData
            });
            let [msgData] = await env.rpc({
                model: 'mail.message',
                method: 'message_format',
                args: [[id]]
            });
            commit('message/create', {
                ...msgData,
                model: thread._model,
                res_id: thread.id
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.$thread
     * @param {string} param1.name
     */
    async 'thread/rename'(
        { commit, env, state },
        { $thread, name }
    ) {
        const thread = state.threads[$thread];
        if (thread.channel_type === 'chat') {
            await env.rpc({
                model: 'mail.channel',
                method: 'channel_set_custom_name',
                args: [thread.id],
                kwargs: { name }
            });
        }
        commit('thread/update', {
            $thread,
            changes: {
                custom_channel_name: name,
            }
        });
    },
};

return actions;

});
