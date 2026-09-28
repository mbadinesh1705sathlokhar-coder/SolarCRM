const webPush = require('web-push');
const { PushSubscriptionModel } = require('../models/PushSubscription');
const fs = require('fs');
const path = require('path');

// VAPID keys file path for persistence
const VAPID_FILE = path.join(__dirname, '../vapid_keys.json');

let vapidKeys;

if (fs.existsSync(VAPID_FILE)) {
    try {
        vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
    } catch (err) {
        vapidKeys = webPush.generateVAPIDKeys();
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    }
} else {
    vapidKeys = webPush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
}

// Configure web-push details
webPush.setVapidDetails(
    'mailto:admin@sathlokhar.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

/**
 * Get Public VAPID Key for client subscription
 */
const getPublicKey = () => vapidKeys.publicKey;

/**
 * Save or update subscription token for a user
 */
const saveSubscription = async (userName, subscription, deviceInfo = '') => {
    if (!subscription || !subscription.endpoint) {
        throw new Error('Invalid subscription object');
    }

    const existing = await PushSubscriptionModel.findOne({
        where: { endpoint: subscription.endpoint }
    });

    if (existing) {
        existing.userName = userName;
        existing.keys = subscription.keys;
        existing.deviceInfo = deviceInfo;
        await existing.save();
        return existing;
    }

    const created = await PushSubscriptionModel.create({
        userName,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        deviceInfo
    });

    return created;
};

const { Op } = require('sequelize');

/**
 * Send push notification payload to subscriptions for a specific user (or all users)
 */
const sendNotificationToUser = async (targetUserName, payload) => {
    try {
        let subscriptions = [];

        if (!targetUserName || targetUserName.toLowerCase() === 'all') {
            subscriptions = await PushSubscriptionModel.findAll();
        } else {
            // Clean target name e.g. "Dinesh (Admin)" -> "Dinesh"
            const cleanTarget = targetUserName.replace(/\(.*\)/g, '').trim();
            const firstName = cleanTarget.split(' ')[0] || cleanTarget;

            subscriptions = await PushSubscriptionModel.findAll({
                where: {
                    [Op.or]: [
                        { userName: { [Op.like]: `%${cleanTarget}%` } },
                        { userName: { [Op.like]: `%${firstName}%` } },
                        { userName: { [Op.like]: `%${targetUserName}%` } }
                    ]
                }
            });

            // If no subscription found matching specific name, fallback to all registered push devices
            if (subscriptions.length === 0) {
                subscriptions = await PushSubscriptionModel.findAll();
            }
        }

        const stringifiedPayload = JSON.stringify(payload);

        const results = await Promise.allSettled(
            subscriptions.map(sub => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                };
                return webPush.sendNotification(pushSubscription, stringifiedPayload)
                    .catch(err => {
                        if (err.statusCode === 404 || err.statusCode === 410) {
                            // Expired or invalid subscription - remove from DB
                            return sub.destroy();
                        }
                        console.error('Error sending push notification:', err.message);
                    });
            })
        );

        return results;
    } catch (err) {
        console.error('Failed to dispatch push notification:', err.message);
    }
};

module.exports = {
    getPublicKey,
    saveSubscription,
    sendNotificationToUser
};
