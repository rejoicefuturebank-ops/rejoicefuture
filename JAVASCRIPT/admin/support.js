// Admin Support Module
const AdminSupport = {
    tickets: [],

    init() {
        this.loadTickets();
        this.setupFilters();
    },

    setupFilters() {
        document.getElementById('filterTicketsBtn')?.addEventListener('click', () => {
            const status = document.getElementById('ticketStatusFilter').value;
            this.loadTickets({ status });
        });
    },

    async loadTickets(params = {}) {
        try {
            const response = await API.admin.getSupportTickets(params);
            this.tickets = response.tickets || [];
            this.render();
        } catch (error) {
            console.error('Tickets load error:', error);
        }
    },

    render() {
        const tbody = document.getElementById('supportTicketsBody');
        if (!tbody) return;

        if (this.tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8">No tickets found</td></tr>';
            return;
        }

        const statusColors = {
            'open': 'warning',
            'waiting_for_customer': 'info',
            'waiting_for_admin': 'danger',
            'under_review': 'info',
            'resolved': 'success',
            'closed': 'secondary'
        };

        tbody.innerHTML = this.tickets.map(t => `
            <tr>
                <td><code>${t.ticket_number}</code></td>
                <td>${t.subject}</td>
                <td>
                    ${t.is_guest
                        ? `${t.guest_name || 'Guest'} <span class="badge badge-secondary">Guest</span><br><small>${t.guest_email || ''}</small>`
                        : (t.users?.profiles?.full_name || t.users?.email || '—')}
                </td>
                <td>${t.category}</td>
                <td><span class="badge badge-${t.priority === 'urgent' ? 'danger' : t.priority === 'high' ? 'warning' : 'secondary'}">${t.priority}</span></td>
                <td><span class="badge badge-${statusColors[t.status] || 'secondary'}">${t.status}</span></td>
                <td>${Utils.formatDate(t.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="AdminSupport.viewTicket('${t.id}')">View</button>
                </td>
            </tr>
        `).join('');
    },

    async viewTicket(id) {
        try {
            const response = await API.request(`/admin/support/tickets/${id}`, { admin: true });
            const ticket = response;

            const messagesHtml = (ticket.support_messages || []).map(m => `
                <div style="padding:1rem;margin-bottom:0.5rem;background:${m.sender_type === 'admin' ? '#1e40af' : '#334155'};border-radius:8px;color:#f1f5f9">
                    <strong>${m.sender_type === 'admin' ? 'Admin' : 'Customer'}</strong> - ${Utils.formatDateTime(m.created_at)}
                    <p style="margin-top:0.5rem">${m.message}</p>
                    ${m.is_internal ? '<span class="badge badge-warning">Internal Note</span>' : ''}
                </div>
            `).join('');

            Utils.showModal(`
                <div class="modal-header">
                    <h3>${ticket.ticket_number} - ${ticket.subject}</h3>
                    <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
                </div>
                <div style="margin-bottom:1rem">
                    <span class="badge badge-info">${ticket.status}</span>
                    <span class="badge badge-secondary">${ticket.priority}</span>
                    <span style="color:#94a3b8;font-size:12px">User: ${
                        ticket.is_guest
                            ? `${ticket.guest_name || 'Guest'} (${ticket.guest_email || 'no email'}) — Guest, not signed in`
                            : (ticket.users?.email || '—')
                    }</span>
                </div>
                <div style="max-height:300px;overflow-y:auto;margin-bottom:1rem">
                    ${messagesHtml || '<p>No messages yet</p>'}
                </div>
                <form id="ticketReplyForm">
                    <div class="form-group">
                        <label>Reply</label>
                        <textarea id="replyMessage" rows="3" required></textarea>
                    </div>
                    <div class="flex gap-1">
                        <button type="submit" class="btn btn-primary">Send Reply</button>
                        <button type="button" class="btn btn-outline" onclick="AdminSupport.addInternalNote('${ticket.id}')">Internal Note</button>
                    </div>
                </form>
                <div class="flex gap-1 mt-2">
                    <button class="btn btn-sm btn-success" onclick="AdminSupport.updateStatus('${ticket.id}', 'resolved')">Mark Resolved</button>
                    <button class="btn btn-sm btn-outline" onclick="AdminSupport.updateStatus('${ticket.id}', 'closed')">Close</button>
                    ${ticket.limit_request_id ? `<button class="btn btn-sm btn-primary" onclick="AdminSupport.approveLimitRequest('${ticket.limit_request_id}')">Approve Limit Request</button>` : ''}
                </div>
            `);

            document.getElementById('ticketReplyForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = document.getElementById('replyMessage').value;
                try {
                    await API.admin.replyToTicket(id, message);
                    Utils.showToast('Reply sent', 'success');
                    Utils.closeModal();
                    this.loadTickets();
                } catch (error) {
                    Utils.showToast(error.message, 'error');
                }
            });
        } catch (error) {
            Utils.showToast('Failed to load ticket', 'error');
        }
    },

    async updateStatus(id, status) {
        try {
            await API.admin.updateTicketStatus(id, status);
            Utils.showToast('Status updated', 'success');
            Utils.closeModal();
            this.loadTickets();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    async addInternalNote(ticketId) {
        const note = prompt('Enter internal note:');
        if (!note) return;
        try {
            await API.admin.replyToTicket(ticketId, note, true);
            Utils.showToast('Internal note added', 'success');
            Utils.closeModal();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    },

    async approveLimitRequest(requestId) {
        const newLimit = prompt('Enter new limit value:');
        if (!newLimit) return;
        try {
            await API.admin.approveLimitRequest(requestId, {
                new_limit_values: { daily_transfer_limit: parseFloat(newLimit) },
                notes: 'Approved by admin'
            });
            Utils.showToast('Limit request approved!', 'success');
            Utils.closeModal();
            this.loadTickets();
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};