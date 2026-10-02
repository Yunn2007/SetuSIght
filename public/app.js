/**
 * SetuSight — Shared Client Application Framework
 */

const SetuApp = (function () {
  'use strict';

  const TOKEN_KEY = 'setusight_jwt_token';
  const USER_KEY = 'setusight_user_info';

  function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getCurrentUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout() {
    clearSession();
    window.location.href = '/login';
  }

  function checkAuth(allowedRoles = []) {
    const token = getAuthToken();
    const user = getCurrentUser();

    if (!token || !user) {
      clearSession();
      window.location.href = '/login';
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      showToast(`Access denied: Role '${user.role}' not authorized for this view.`, 'error');
      setTimeout(() => {
        if (user.role === 'admin') window.location.href = '/admin';
        else if (user.role === 'inspector') window.location.href = '/inspector';
        else if (user.role === 'contractor') window.location.href = '/contractor';
        else window.location.href = '/login';
      }, 1000);
      return null;
    }

    return user;
  }

  async function fetchApi(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = options.headers || {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    options.headers = headers;

    try {
      const res = await fetch(endpoint, options);
      const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status} ${res.statusText}` }));

      if (res.status === 401) {
        showToast('Session expired. Please log in again.', 'warning');
        setTimeout(() => logout(), 1000);
        throw new Error(data.error || 'Unauthorized');
      }

      if (!res.ok) {
        const errMsg = data.error || data.message || 'Request failed';
        showToast(errMsg, 'error');
        throw new Error(errMsg);
      }

      return data;
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        // Only show toast if not already shown
        if (!err.message.includes('Session expired')) {
          showToast(err.message, 'error');
        }
      }
      throw err;
    }
  }

  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4500);
  }

  function initHeader(user) {
    // Fill user info in header pill
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const avatarEl = document.getElementById('headerUserAvatar');

    if (nameEl && user) nameEl.textContent = user.name;
    if (roleEl && user) roleEl.textContent = user.role.toUpperCase();
    if (avatarEl && user) avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobileNavToggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('is-open');
      });
    }

    // Notification dropdown setup
    initNotifications();
  }

  async function initNotifications() {
    const notifBtn = document.getElementById('notifBellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifBadge = document.getElementById('notifBadge');
    const notifList = document.getElementById('notifList');
    const markAllBtn = document.getElementById('markAllReadBtn');

    if (!notifBtn || !notifDropdown) return;

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.remove('is-open');
      }
    });

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          await fetchApi('/api/notifications/read-all', { method: 'PUT' });
          loadNotifications();
        } catch (e) {}
      });
    }

    async function loadNotifications() {
      try {
        const res = await fetchApi('/api/notifications');
        if (res.success && res.data) {
          if (notifBadge) {
            notifBadge.textContent = res.unreadCount;
            notifBadge.style.display = res.unreadCount > 0 ? 'inline-block' : 'none';
          }

          if (notifList) {
            if (res.data.length === 0) {
              notifList.innerHTML = '<div class="notif-empty">No notifications yet</div>';
            } else {
              notifList.innerHTML = res.data.map(n => `
                <div class="notif-item ${n.is_read ? '' : 'is-unread'}" onclick="SetuApp.markNotificationRead('${n.id}')">
                  <span class="notif-item__title">${n.title}</span>
                  <span class="notif-item__msg">${n.message}</span>
                  <span class="notif-item__time">${new Date(n.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              `).join('');
            }
          }
        }
      } catch (e) {
        // Non-blocking
      }
    }

    loadNotifications();
  }

  async function markNotificationRead(id) {
    try {
      await fetchApi(`/api/notifications/${id}/read`, { method: 'PUT' });
      initNotifications();
    } catch (e) {}
  }

  function getStatusClass(status) {
    if (!status) return 'status--moderate';
    const s = status.toLowerCase();
    if (s.includes('good') || s.includes('completed')) return 'status--good';
    if (s.includes('moderate') || s.includes('scheduled')) return 'status--moderate';
    if (s.includes('attention') || s.includes('critical') || s.includes('overdue')) return 'status--attention';
    if (s.includes('maintenance') || s.includes('progress')) return 'status--maintenance';
    return 'status--moderate';
  }

  return {
    getAuthToken,
    getCurrentUser,
    setSession,
    clearSession,
    logout,
    checkAuth,
    fetchApi,
    showToast,
    initHeader,
    initNotifications,
    markNotificationRead,
    getStatusClass
  };
})();
