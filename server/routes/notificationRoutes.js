const express = require('express');
const router = express.Router();
const { getPublicKey, saveSubscription, sendNotificationToUser } = require('../services/pushService');

// 1. GET VAPID Public Key
router.get('/vapid-key', (req, res) => {
    try {
        const publicKey = getPublicKey();
        res.status(200).json({ publicKey });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve VAPID key', details: err.message });
    }
});

// 2. POST Save Push Subscription
router.post('/subscribe', async (req, res) => {
    try {
        const { userName, subscription, deviceInfo } = req.body;
        if (!subscription) {
            return res.status(400).json({ error: 'Subscription data is required' });
        }

        const saved = await saveSubscription(userName || 'Staff', subscription, deviceInfo);
        res.status(201).json({ message: 'Push subscription registered successfully', data: saved });
    } catch (err) {
        res.status(400).json({ error: 'Failed to save push subscription', details: err.message });
    }
});

// 3. POST Send Test Push Notification
router.post('/test', async (req, res) => {
    try {
        const { userName } = req.body;
        const target = userName || 'all';

        await sendNotificationToUser(target, {
            title: '🔔 SolarCRM Push Notifications Active!',
            body: 'You will now receive instant push reminders for your assigned tasks, to-dos, and meetings.',
            icon: '/assets/icons/icon-192x192.png',
            url: '/home',
            tag: 'test-notification-' + Date.now()
        });

        res.status(200).json({ message: 'Test push notification dispatched!' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send test push notification', details: err.message });
    }
});

module.exports = router;
