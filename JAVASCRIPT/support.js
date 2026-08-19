const Support = {
    async init() {
        await this.loadTickets();
        document.getElementById('createTicketBtn')?.addEventListener('click', () => this.showCreateModal());
    },

    async loadTickets() {
        try {
            const response = await API.getTickets();
            const tickets = response.tickets || [];
            const container = document.getElementById('supportContent');
            if (!container) return;

            if (tickets.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💬</div><p>No support tickets yet</p></div>';
                return;
            }

            container.innerHTML = tickets.map(t => `
                <div class="dashboard-card mb-1">
                    <div class="flex-between">
                        <div>
                            <h4>${t.subject}</h4>
                            <small class="text-muted">${t.ticket_number} • ${Utils.formatDate(t.created_at)}</small>
                        </div>
                        <span class="badge badge-${t.status === 'open' ? 'warning' : t.status === 'resolved' ? 'success' : 'info'}">${t.status}</span>
                    </div>
                    <button class="btn btn-sm btn-outline mt-1" onclick="Support.viewTicket('${t.id}')">View Conversation</button>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading tickets:', error);
        }
    },

    showCreateModal() {
        Utils.showModal(`
            <div class="modal-header">
                <h3>Create Support Ticket</h3>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <form id="ticketForm">
                <div class="form-group"><label>Subject</label><input type="text" id="ticketSubject" required></div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="ticketCategory">
                        <option value="general">General Inquiry</option>
                        <option value="transfer">Transfer Issue</option>
                        <option value="withdrawal">Withdrawal Issue</option>
                        <option value="card">Card Issue</option>
                        <option value="security">Security Concern</option>
                        <option value="limit_request">Limit Increase Request</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <select id="ticketPriority">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                <div class="form-group"><label>Message</label><textarea id="ticketMessage" rows="4" required></textarea></div>
                <button type="submit" class="btn btn-primary btn-block">Submit Ticket</button>
            </form>
        `);

        document.getElementById('ticketForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await API.createTicket({
                    subject: document.getElementById('ticketSubject').value,
                    category: document.getElementById('ticketCategory').value,
                    priority: document.getElementById('ticketPriority').value,
                    message: document.getElementById('ticketMessage').value
                });
                Utils.showToast('Ticket created!', 'success');
                Utils.closeModal();
                await this.loadTickets();
            } catch (error) {
                Utils.showToast(error.message, 'error');
            }
        });
    },

    async viewTicket(ticketId) {
        try {
            const response = await API.request(`/support/tickets/${ticketId}/messages`);
            const messages = response.messages || [];

            Utils.showModal(`
                <div class="modal-header">
                    <h3>Conversation</h3>
                    <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
                </div>
                <div style="max-height:300px;overflow-y:auto;margin-bottom:1rem">
                    ${messages.map(m => `
                        <div style="padding:10px;margin-bottom:8px;background:${m.sender_type === 'customer' ? '#e8effc' : '#f1f5f9'};border-radius:8px">
                            <small><strong>${m.sender_type === 'customer' ? 'You' : 'Support Team'}</strong> • ${Utils.formatDateTime(m.created_at)}</small>
                            <p style="margin-top:4px">${m.message}</p>
                        </div>
                    `).join('') || '<p>No messages yet</p>'}
                </div>
                <form id="replyForm">
                    <div class="form-group"><textarea id="replyMessage" rows="3" required placeholder="Type your reply..."></textarea></div>
                    <button type="submit" class="btn btn-primary btn-block">Send Reply</button>
                </form>
            `);

            document.getElementById('replyForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    await API.replyToTicket(ticketId, document.getElementById('replyMessage').value);
                    Utils.showToast('Reply sent!', 'success');
                    Utils.closeModal();
                } catch (error) {
                    Utils.showToast(error.message, 'error');
                }
            });
        } catch (error) {
            Utils.showToast(error.message, 'error');
        }
    }
};