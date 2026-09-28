const { Meeting, CallLog, TaskItem } = require('../models/ContactActivity');
const { SitePlan } = require('../models/SitePlan');
const { sendNotificationToUser } = require('./pushService');

// Set to keep track of notified item keys in the last hour to prevent duplicate alerts
const notifiedSet = new Set();

const checkUpcomingReminders = async () => {
    try {
        const now = new Date();
        const todayStr = now.toISOString().substring(0, 10);
        
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;

        // 1. Check Meetings for Today
        const meetings = await Meeting.findAll({
            where: { date: todayStr }
        });

        for (const meeting of meetings) {
            if (meeting.status === 'Completed' || meeting.status === 'Cancelled') continue;
            
            const notifKey = `meeting-${meeting.id}-${todayStr}`;
            if (notifiedSet.has(notifKey)) continue;

            const timeStr = (meeting.time || '').trim();
            // Check if meeting time matches current time or is upcoming
            if (timeStr.includes(currentTimeStr) || isTimeNear(timeStr, now)) {
                notifiedSet.add(notifKey);
                
                const title = `Meeting Reminder: ${meeting.purpose || 'Client Meeting'}`;
                const body = `With ${meeting.clientName || meeting.title || 'Client'} at ${meeting.time || 'scheduled time'}${meeting.location ? ' (' + meeting.location + ')' : ''}`;

                // Notify assigned engineer, coordinator, or all
                const recipients = [meeting.engineer, meeting.coordinator].filter(Boolean);
                if (recipients.length === 0 || (meeting.purpose || '').toLowerCase() === 'all') {
                    recipients.push('all');
                }

                for (const recipient of recipients) {
                    await sendNotificationToUser(recipient, {
                        title,
                        body,
                        icon: '/assets/icons/icon-192x192.png',
                        url: '/activity/meetings',
                        tag: notifKey
                    });
                }
            }
        }

        // 2. Check Tasks & To-Dos for Today
        const tasks = await TaskItem.findAll({
            where: { dueDate: todayStr }
        });

        for (const task of tasks) {
            if (task.status === 'Completed') continue;

            const notifKey = `task-${task.id}-${todayStr}`;
            if (notifiedSet.has(notifKey)) continue;

            const isTodo = (task.relatedTo || '').trim().toLowerCase() === 'to-do';
            const title = isTodo ? `To-Do Reminder: ${task.title}` : `Task Due: ${task.title}`;
            const body = `${task.description ? task.description.substring(0, 80) : 'Due today'} (${task.time || 'Today'})`;

            const recipient = task.assignedTo || 'all';
            
            // Trigger alert if time matches or if it's past due time
            const timeStr = (task.time || '').trim();
            if (!timeStr || timeStr.includes(currentTimeStr) || isTimeNear(timeStr, now)) {
                notifiedSet.add(notifKey);
                await sendNotificationToUser(recipient, {
                    title,
                    body,
                    icon: '/assets/icons/icon-192x192.png',
                    url: '/home',
                    tag: notifKey
                });
            }
        }

        // 3. Check Site Plans for Today
        const sitePlans = await SitePlan.findAll({
            where: { date: todayStr }
        });

        for (const sp of sitePlans) {
            const notifKey = `siteplan-${sp.id}-${todayStr}`;
            if (notifiedSet.has(notifKey)) continue;

            const timeStr = (sp.time || '').trim();
            if (timeStr.includes(currentTimeStr) || isTimeNear(timeStr, now)) {
                notifiedSet.add(notifKey);
                
                const title = `Site Plan Visit: ${sp.clientName || 'Site Inspection'}`;
                const body = `Site visit scheduled for ${sp.clientName || 'Client'} at ${sp.time || '10:00 AM'}${sp.description ? ' - ' + sp.description.substring(0, 60) : ''}`;

                const recipients = [sp.engineerName, sp.assignedBy].filter(Boolean);
                if (recipients.length === 0) recipients.push('all');

                for (const recipient of recipients) {
                    await sendNotificationToUser(recipient, {
                        title,
                        body,
                        icon: '/assets/icons/icon-192x192.png',
                        url: '/activity/site-plan',
                        tag: notifKey
                    });
                }
            }
        }

        // 3. Clear notified items older than 2 hours to avoid memory leak
        if (notifiedSet.size > 500) {
            notifiedSet.clear();
        }

    } catch (err) {
        console.error('Error in reminderScheduler loop:', err.message);
    }
};

/**
 * Utility to check if a time string (e.g., "10:30 AM", "14:15", "10:30") is within 15 minutes of current time
 */
const isTimeNear = (timeStr, nowObj) => {
    if (!timeStr) return false;
    try {
        const timeLower = timeStr.toLowerCase().trim();
        let hours = 0;
        let minutes = 0;

        if (timeLower.includes('am') || timeLower.includes('pm')) {
            const parts = timeLower.replace(/am|pm/g, '').trim().split(':');
            hours = parseInt(parts[0], 10) || 0;
            minutes = parseInt(parts[1], 10) || 0;
            if (timeLower.includes('pm') && hours < 12) hours += 12;
            if (timeLower.includes('am') && hours === 12) hours = 0;
        } else {
            const parts = timeLower.split(':');
            hours = parseInt(parts[0], 10) || 0;
            minutes = parseInt(parts[1], 10) || 0;
        }

        const taskTimeInMinutes = hours * 60 + minutes;
        const nowTimeInMinutes = nowObj.getHours() * 60 + nowObj.getMinutes();

        const diff = taskTimeInMinutes - nowTimeInMinutes;
        return diff >= 0 && diff <= 15;
    } catch {
        return false;
    }
};

/**
 * Start recurring cron interval
 */
const initReminderScheduler = () => {
    console.log('⏰ SolarCRM Reminder Scheduler Initialized.');
    // Run immediately once, then every 60 seconds
    checkUpcomingReminders();
    setInterval(checkUpcomingReminders, 60000);
};

module.exports = { initReminderScheduler, checkUpcomingReminders };
