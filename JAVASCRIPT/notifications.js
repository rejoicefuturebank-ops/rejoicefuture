const Notifications = {
    async init() {
        await this.load();
    },

    async load() {
        try {
            const response = await API.getNotifications();
            const notifications = response.notifications || [];
            const unreadCount = response.unreadCount || 0;

            const badge = document.getElementById('notifBadge');
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }

            const list = document.getElementById('notificationList');
            if (list) {
                list.innerHTML = notifications.length === 0
                    ? '<div class="empty-state"><p>No notifications</p></div>'
                    : notifications.map(n => `
                        <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="Notifications.markRead('${n.id}')">
                            <div class="notification-title">${n.title}</div>
                            <div class="notification-message">${n.message}</div>
                            <div class="notification-time">${Utils.formatDateTime(n.created_at)}</div>
                        </div>
                    `).join('');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    },

    async markRead(id) {
        try {
            await API.markNotificationRead(id);
            await this.load();
        } catch (error) {
            console.error('Error marking read:', error);
        }
    },

    async markAllRead() {
        try {
            await API.markAllNotificationsRead();
            await this.load();
            Utils.showToast('All notifications marked as read', 'success');
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};

// Auto-refresh notifications every 30 seconds
setInterval(() => {
    if (Utils.isAuthenticated() && window.location.pathname.includes('dashboard')) {
        Notifications.load();
    }
}, 30000);